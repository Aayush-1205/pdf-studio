"use server";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

/**
 * Generates the Google OAuth authorization URL that the user must visit
 * to grant Drive access. The URL includes offline access to get a refresh_token.
 *
 * Redirect URI: [origin]/api/auth/google-callback
 * Required env vars: CLIENT_ID
 */
export async function getGoogleDriveAuthUrl(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const clientId = process.env.CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing CLIENT_ID environment variable.");
  }

  // Determine the app origin from the request headers
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const redirectUri = `${origin}/api/auth/google-callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
    ].join(" "),
    access_type: "offline", // CRITICAL: needed to get a refresh_token
    prompt: "consent", // Force re-consent so Google always returns refresh_token
    state: userId, // Pass userId as state for CSRF protection
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
