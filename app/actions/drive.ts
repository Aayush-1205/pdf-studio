"use server";

import { google } from "googleapis";
import { Readable } from "stream";
import { auth, clerkClient } from "@clerk/nextjs/server";

// ── Token Management ───────────────────────────────────────────────────────
//
// Strategy (layered):
//  1. Try Clerk's getUserOauthAccessToken — Clerk auto-refreshes via stored SSO token.
//  2. If that fails (token expired / missing scope), read the refresh_token we saved
//     in the user's Clerk privateMetadata and call Google's token endpoint directly
//     using CLIENT_ID + CLIENT_SECRET to get a fresh access_token.
//  3. Save the new access_token back to privateMetadata for the next call.
//
// First-time setup:
//  - User must sign in with Google via Clerk with Drive scope.
//  - On webhook (or first load), persist the refresh_token in privateMetadata.
//    You can do this from a /api/auth/callback route or a Clerk webhook.
//  - Env required: CLIENT_ID, CLIENT_SECRET
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Refresh a Google access token using the stored refresh_token
 * and your app's CLIENT_ID + CLIENT_SECRET.
 */
async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing CLIENT_ID or CLIENT_SECRET in environment variables.",
    );
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Drive Auth] Google token refresh failed:", errorBody);
    throw new Error(
      `Google token refresh failed (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Google did not return an access_token during refresh.");
  }

  return data.access_token as string;
}

/**
 * Get a valid Google Drive client for the currently signed-in user.
 *
 * Tries Clerk's cached OAuth token first, then falls back to manual
 * refresh using the refresh_token stored in Clerk's privateMetadata.
 */
export async function getDriveClient() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized — please sign in first.");
  }

  const client = await clerkClient();
  let accessToken: string | null = null;

  // ── Attempt 1: Clerk's cached / auto-refreshed OAuth token ────────────
  try {
    const tokenResponse = await client.users.getUserOauthAccessToken(
      userId,
      "oauth_google",
    );
    accessToken = tokenResponse.data?.[0]?.token ?? null;
  } catch (err) {
    console.warn(
      "[Drive Auth] Clerk OAuth token fetch failed, will try manual refresh:",
      err,
    );
  }

  // ── Attempt 2: Manual refresh using stored refresh_token ──────────────
  if (!accessToken) {
    const user = await client.users.getUser(userId);
    const storedRefreshToken = user.privateMetadata?.googleRefreshToken as
      | string
      | undefined;

    if (!storedRefreshToken) {
      throw new Error(
        "No Google refresh token found. Please sign out and sign back in " +
          "with Google to grant Google Drive permissions.",
      );
    }

    try {
      accessToken = await refreshGoogleAccessToken(storedRefreshToken);

      // Persist the new access token (as a cached value — refresh_token doesn't change)
      await client.users.updateUserMetadata(userId, {
        privateMetadata: {
          ...user.privateMetadata,
          googleAccessTokenCached: accessToken,
          googleAccessTokenCachedAt: Date.now(),
        },
      });
    } catch (refreshErr) {
      console.error("[Drive Auth] Manual token refresh failed:", refreshErr);
      throw new Error(
        "Failed to refresh Google token. Please sign out and sign back in with Google.",
      );
    }
  }

  // Build the Google Drive API client
  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ access_token: accessToken });

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Server action: Persist the Google refresh_token into the user's
 * Clerk privateMetadata. Call this once after the user first signs in
 * with Google (e.g., from your auth callback or Clerk webhook).
 *
 * @param refreshToken The refresh_token from Google OAuth callback
 */
export async function saveGoogleRefreshToken(
  refreshToken: string,
): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      ...user.privateMetadata,
      googleRefreshToken: refreshToken,
    },
  });

  console.log(`[Drive Auth] Saved refresh_token for user ${userId}`);
}

// ── Types ─────────────────────────────────────────────────────────────

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  isFolder: boolean;
};

// ── Fetch items inside a single folder ──────────────────────────────────

export async function fetchDriveItems(
  folderId: string = "root",
): Promise<DriveItem[]> {
  try {
    const drive = await getDriveClient();
    const allItems: DriveItem[] = [];
    let pageToken: string | undefined;

    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false and (mimeType='application/vnd.google-apps.folder' or mimeType='application/pdf')`,
        fields:
          "nextPageToken, files(id, name, mimeType, thumbnailLink, size, createdTime, modifiedTime, parents)",
        orderBy: "folder,name",
        pageSize: 100,
        pageToken,
      });

      const files =
        response.data.files?.map((f) => ({
          ...(f as DriveItem),
          isFolder: f.mimeType === "application/vnd.google-apps.folder",
        })) || [];

      allItems.push(...files);
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return allItems;
  } catch (error: any) {
    console.error("[Drive API] Failed to fetch items:", error?.message);
    throw new Error(
      error?.message || "Failed to fetch files from Google Drive",
    );
  }
}

// ── Download a PDF ─────────────────────────────────────────────────────

export async function downloadDrivePdf(fileId: string): Promise<string> {
  try {
    const drive = await getDriveClient();
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);
    return `data:application/pdf;base64,${buffer.toString("base64")}`;
  } catch (error: any) {
    console.error(
      "[Drive API] Failed to download PDF:",
      error?.message || error,
    );
    if (error?.response) {
      try {
        const errorText = Buffer.from(
          error.response.data as ArrayBuffer,
        ).toString("utf-8");
        console.error("[Drive API] Error body:", errorText);
      } catch {}
    }
    throw new Error(
      `Failed to download PDF from Google Drive: ${error?.message || "Unknown error"}`,
    );
  }
}

// ── Upload a PDF back to Drive ─────────────────────────────────────────

export async function uploadToDrive(
  formData: FormData,
): Promise<{ id: string; name: string }> {
  try {
    const drive = await getDriveClient();

    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string;
    const parentFolderId = formData.get("parentFolderId") as string;

    if (!file) throw new Error("No file provided");

    const buffer = Buffer.from(await file.arrayBuffer());

    const fileMetadata: { name: string; mimeType: string; parents?: string[] } =
      {
        name: fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
        mimeType: "application/pdf",
      };

    if (parentFolderId && parentFolderId !== "root") {
      fileMetadata.parents = [parentFolderId];
    }

    const media = {
      mimeType: "application/pdf",
      body: Readable.from(buffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, name",
    });

    return { id: response.data.id!, name: response.data.name! };
  } catch (error: any) {
    console.error("[Drive API] Failed to upload:", error?.message || error);
    throw new Error(
      `Failed to upload PDF to Google Drive: ${error?.message || "Unknown error"}`,
    );
  }
}

// ── Create a new folder in Drive ───────────────────────────────────────

export async function createDriveFolder(
  folderName: string,
  parentFolderId: string = "root",
): Promise<{ id: string; name: string }> {
  try {
    const drive = await getDriveClient();

    const fileMetadata: {
      name: string;
      mimeType: string;
      parents?: string[];
    } = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    if (parentFolderId && parentFolderId !== "root") {
      fileMetadata.parents = [parentFolderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name",
    });

    return { id: response.data.id!, name: response.data.name! };
  } catch (error) {
    console.error("[Drive API] Failed to create folder:", error);
    throw new Error("Failed to create folder in Google Drive");
  }
}

// ── Get file metadata (to find parent folder) ──────────────────────────

export async function getFileParent(
  fileId: string,
): Promise<{ parentId: string; fileName: string }> {
  try {
    const drive = await getDriveClient();
    const response = await drive.files.get({
      fileId,
      fields: "name, parents",
    });
    const parents = response.data.parents;
    return {
      parentId: parents && parents.length > 0 ? parents[0] : "root",
      fileName: response.data.name || "document.pdf",
    };
  } catch (error) {
    console.error("[Drive API] Failed to get file parent:", error);
    return { parentId: "root", fileName: "document.pdf" };
  }
}
