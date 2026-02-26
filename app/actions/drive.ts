"use server";

import { google } from "googleapis";
import { Readable } from "stream";
import { auth, clerkClient } from "@clerk/nextjs/server";

// ── Per-User Drive Client via Clerk OAuth ─────────────────────────────
//
// Instead of storing tokens in .env, Clerk manages Google OAuth tokens
// per user. Each signed-in user accesses THEIR OWN Google Drive.
//
// Prerequisites:
//   1. Clerk Dashboard > Social Connections > Google → Enabled
//   2. Add scope: https://www.googleapis.com/auth/drive
//   3. Users sign in with Google via Clerk (grants Drive scope)
//
// No GOOGLE_REFRESH_TOKEN, CLIENT_ID_KEY, CLIENT_SECRET, or DRIVE_KEY needed.
// ───────────────────────────────────────────────────────────────────────

async function getDriveClient() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized — please sign in first.");
  }

  // Clerk fetches a fresh (auto-refreshed) Google OAuth access token
  const client = await clerkClient();
  const provider = "oauth_google";

  try {
    const tokenResponse = await client.users.getUserOauthAccessToken(
      userId,
      provider,
    );

    const accessToken = tokenResponse.data?.[0]?.token;

    if (!accessToken) {
      throw new Error(
        "No Google access token found. You must sign out and sign back in with Google to grant Drive permissions.",
      );
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    return google.drive({ version: "v3", auth: oauth2Client });
  } catch (error) {
    console.error("[Drive API] Error getting OAuth token from Clerk:", error);
    throw new Error(
      "Failed to authenticate with Google Drive. Please sign out and sign in again to grant permissions.",
    );
  }
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

// ── Fetch items inside a single folder ────────────────────────────────

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
  } catch (error) {
    console.error("Failed to fetch Google Drive items:", error);
    throw new Error("Failed to fetch files from Google Drive");
  }
}

// ── Download a PDF ────────────────────────────────────────────────────

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
      "[Drive API] Failed to download PDF from Drive:",
      error?.message || error,
    );
    if (error?.response) {
      // If responseType is arraybuffer, the error response data might be an arraybuffer too, so convert it if possible
      try {
        const errorText = Buffer.from(
          error.response.data as ArrayBuffer,
        ).toString("utf-8");
        console.error("[Drive API] Error response body:", errorText);
      } catch {
        console.error("[Drive API] Error response:", error.response);
      }
    }
    throw new Error(
      `Failed to download PDF from Google Drive: ${error?.message || "Unknown error"}`,
    );
  }
}

// ── Upload a PDF back to Drive ────────────────────────────────────────

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
    console.error(
      "[Drive API] Failed to upload to Drive:",
      error?.message || error,
    );
    if (error?.response) {
      console.error("[Drive API] Error response body:", error.response.data);
    }
    throw new Error(
      `Failed to upload PDF to Google Drive: ${error?.message || "Unknown error"}`,
    );
  }
}

// ── Create a new folder in Drive ──────────────────────────────────────

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
    console.error("Failed to create folder:", error);
    throw new Error("Failed to create folder in Google Drive");
  }
}

// ── Get file metadata (to find parent folder) ─────────────────────────

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
    console.error("Failed to get file parent:", error);
    return { parentId: "root", fileName: "document.pdf" };
  }
}
