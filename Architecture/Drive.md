Here is a detailed, production-grade implementation plan for your Google Drive Server Actions.

To make this highly efficient for a PDF Studio, we cannot just query "all files"—fetching 10,000 random Google Docs and Spreadsheets will crash the Next.js payload limit and freeze the UI. We must aggressively filter the query at the Google API level so your server only processes and returns active PDF files.

Here is the blueprint for creating high-performance Drive Server Actions.

---

### 🏗️ Architecture Overview

We will create a dedicated Next.js Server Actions file (`src/actions/drive.ts`). It will handle three core operations:

1. **`getDriveFiles`**: Fetches a paginated, heavily filtered list of PDFs (both owned and shared).
2. **`downloadDriveFile`**: Streams the PDF binary data securely to the browser.
3. **`uploadToDrive`**: Pushes the modified PDF back to Google Drive using a multipart upload.

### 🚀 Phase 1: The "Perfect Fetch" Implementation

To ensure zero performance bottlenecks, we must optimize the query parameters, strict field selection, and pagination.

**Implementation Directive for Antigravity (`src/actions/drive.ts`):**

```typescript
"use server";
import { google } from "googleapis";
import { auth } from "@clerk/nextjs/server"; // Assuming you use Clerk based on your dependencies

// Helper to initialize authenticated Google Drive client
async function getDriveClient() {
  const { getToken } = auth();
  const token = await getToken({ template: "google" }); // Retrieve Google OAuth token from Clerk

  if (!token) throw new Error("Unauthorized: Google account not linked.");

  const authClient = new google.auth.OAuth2();
  authClient.setCredentials({ access_token: token });
  return google.drive({ version: "v3", auth: authClient });
}

export async function getDriveFiles(
  pageToken?: string,
  searchQuery: string = "",
) {
  const drive = await getDriveClient();

  // Constructing a highly optimized query (q)
  // 1. MUST be a PDF.
  // 2. MUST NOT be in the trash.
  // 3. Optional: Search by name if the user types in the UI.
  let q = `mimeType='application/pdf' and trashed=false`;
  if (searchQuery) {
    q += ` and name contains '${searchQuery}'`;
  }

  try {
    const response = await drive.files.list({
      q,
      // Include files from Shared Drives and files shared directly with the user
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "user", // Change to 'allDrives' if you want organization-level Team Drives included

      // PERFORMANCE CRITICAL: Only fetch exactly what the UI needs to render the list
      fields: "nextPageToken, files(id, name, modifiedTime, size, iconLink)",

      // Pagination
      pageSize: 20,
      pageToken: pageToken || undefined,

      // Order by most recently modified
      orderBy: "modifiedByMeTime desc, modifiedTime desc",
    });

    return {
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken || null,
    };
  } catch (error) {
    console.error("Drive Fetch Error:", error);
    throw new Error("Failed to fetch Google Drive files.");
  }
}
```

### 📥 Phase 2: Secure & Fast File Downloading

When a user clicks a file in the UI, you need to load its bytes into your `Zustand` Virtual File System. Do not attempt to pass large buffers directly through Next.js Server Action return values (it will hit the 2MB payload limit). Instead, return a base64 string or pipe it.

```typescript
export async function downloadDriveFile(fileId: string): Promise<string> {
  const drive = await getDriveClient();

  try {
    const response = await drive.files.get(
      { fileId: fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }, // CRITICAL: Fetch as binary
    );

    // Convert ArrayBuffer to Base64 to safely pass across the Next.js Server-to-Client boundary
    const buffer = Buffer.from(response.data as ArrayBuffer);
    return buffer.toString("base64");
  } catch (error) {
    console.error("Drive Download Error:", error);
    throw new Error("Failed to download the file.");
  }
}
```

### 📤 Phase 3: The Export / Upload Engine

When the user finishes editing, they click "Save to Drive". We need to handle two scenarios: creating a new file, or overwriting the existing one.

```typescript
export async function uploadToDrive(
  base64File: string,
  fileName: string,
  existingFileId?: string, // If provided, overwrites. If null, creates new.
) {
  const drive = await getDriveClient();
  const fileBuffer = Buffer.from(base64File, "base64");

  const media = {
    mimeType: "application/pdf",
    body: Readable.from(fileBuffer), // Use Node.js stream for memory efficiency
  };

  try {
    if (existingFileId) {
      // OVERWRITE EXISTING FILE
      const response = await drive.files.update({
        fileId: existingFileId,
        media: media,
        supportsAllDrives: true,
      });
      return { success: true, id: response.data.id };
    } else {
      // CREATE NEW FILE
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: "application/pdf",
        },
        media: media,
        supportsAllDrives: true,
      });
      return { success: true, id: response.data.id };
    }
  } catch (error) {
    console.error("Drive Upload Error:", error);
    throw new Error("Failed to save to Google Drive.");
  }
}
```

---

### ⚡ Phase 4: Performance & UX Best Practices (The "No-Lag" Guarantee)

To ensure the UI feels instant and doesn't buckle under heavy loads, implement these strategies in your React Client components:

1. **Infinite Scrolling (Pagination UI):**
   Do not fetch all files at once. Use a library like `react-intersection-observer` (or the Intersection Observer API directly). When the user scrolls to the bottom of the Drive File List, call `getDriveFiles` using the `nextPageToken` from the previous request and append the new files to the UI.
2. **Debounced Searching:**
   If you implement a search bar to find PDFs, wrap the input in a 500ms debounce. This prevents firing a Server Action for every single keystroke.
3. **Optimistic Loading:**
   When downloading a file via `downloadDriveFile`, show a skeleton loader or a loading spinner immediately.
4. **Hydrating Zustand:**
   When the base64 string arrives at the client, immediately convert it back to a `Uint8Array` and load it into your `pdf-lib` and `pdfjs-dist` pipelines.

```javascript
// Client-side helper to reconstruct the binary array
const binaryString = atob(base64Data);
const len = binaryString.length;
const bytes = new Uint8Array(len);
for (let i = 0; i < len; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
// Pass `bytes` to processFigmaStylePDF()
```

By applying aggressive MIME-type filtering at the Google API level, using streams for uploading, and paginating the results, your Drive integration will perform flawlessly regardless of how many thousands of files the user has in their Google workspace.
