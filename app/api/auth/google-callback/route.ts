import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * GET /api/auth/google-callback?code=...&state=...
 *
 * This route handles the Google OAuth callback when using a custom
 * OAuth flow (not Clerk's built-in flow) to capture the refresh_token.
 *
 * Use this if you need to store the refresh_token for manual renewal.
 * You must have set up a Google OAuth 2.0 credential in Google Cloud Console
 * with this redirect URI: [your-domain]/api/auth/google-callback
 *
 * Required env vars: CLIENT_ID, CLIENT_SECRET
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    console.error("[Google OAuth Callback] Error from Google:", error);
    return NextResponse.redirect(
      new URL(`/editor?drive_error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/editor?drive_error=missing_code", request.url),
    );
  }

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/auth/google-callback`;

  if (!clientId || !clientSecret) {
    console.error("[Google OAuth Callback] Missing CLIENT_ID or CLIENT_SECRET");
    return NextResponse.redirect(
      new URL("/editor?drive_error=server_config", request.url),
    );
  }

  try {
    // Exchange the authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error(
        "[Google OAuth Callback] Token exchange failed:",
        errorBody,
      );
      return NextResponse.redirect(
        new URL("/editor?drive_error=token_exchange_failed", request.url),
      );
    }

    const tokens = await tokenResponse.json();
    const refreshToken = tokens.refresh_token as string | undefined;
    const accessToken = tokens.access_token as string | undefined;

    if (!refreshToken) {
      // This happens if the user already granted access and Google only returns
      // an access_token. Redirect back — Clerk's token will still work.
      console.warn(
        "[Google OAuth Callback] No refresh_token in response. Access already granted previously.",
      );
      return NextResponse.redirect(
        new URL("/editor?drive_connected=1", request.url),
      );
    }

    // Persist the refresh_token into Clerk's user privateMetadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    await client.users.updateUserMetadata(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        googleRefreshToken: refreshToken,
        googleAccessTokenCached: accessToken,
        googleAccessTokenCachedAt: Date.now(),
      },
    });

    console.log(
      `[Google OAuth Callback] Saved refresh_token for user ${userId}`,
    );

    return NextResponse.redirect(
      new URL("/editor?drive_connected=1", request.url),
    );
  } catch (err) {
    console.error("[Google OAuth Callback] Unexpected error:", err);
    return NextResponse.redirect(
      new URL("/editor?drive_error=unexpected", request.url),
    );
  }
}
