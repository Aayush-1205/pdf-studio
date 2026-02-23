This is a solid, professional roadmap. You are moving from a "feature-heavy" mindset to a "user-journey" mindset, which is exactly how production-grade SaaS products are built.

Below is the **Phase One Blueprint**. This guide is designed for you to feed directly into the Antigravity IDE to establish the core routing, state management, and user flow of **PDF Studio**.

---

## 🏗️ Phase 1: Core Architecture & User Flow

The goal of this phase is to move from a single-page script to a multi-page application with **persistent state**.

### 1. Site Structure & Routing

The application will use a standard URL-based navigation system to ensure the "Back" button and "Refresh" work as expected.

| Page               | URL Path       | Function                                                 |
| ------------------ | -------------- | -------------------------------------------------------- |
| **Home / Landing** | `/`            | Hero section, "Why PDF Studio", and the Tool Grid.       |
| **Tool Selection** | `/{tool-name}` | e.g., `/merge` or `/edit`. Contains the **Upload Zone**. |
| **Workspace**      | `/editor`      | The actual PDF editing interface.                        |

### 2. The "Gateway" (Home & Tool Selection)

Users cannot enter the editor without a file.

- **The Tool Grid:** Display cards for "Merge," "Compress," "Edit," "Rotate," etc.
- **The Guardrail:** If a user clicks a tool, they are taken to a landing page for that tool with a large **Drag & Drop Upload Zone**.
- **Instructional Overlay:** Use a "3-Step" visual guide:

1. **Upload:** Select your PDF from your device.
2. **Modify:** Use our professional tools to edit or merge.
3. **Download:** Export your production-ready file.

### 3. Persistent State (The "No-Loss" Rule)

To ensure the PDF remains even after a **Page Refresh**, we will use the **Virtual File System (VFS)** mentioned in your report.

- **Mechanism:** When a file is uploaded, the main thread must store the file's `ArrayBuffer` into **IndexedDB** (using a library like `idb` or `localForage`).
- **Hydration:** On the `/editor` page, the first task in the `useEffect` hook (or component mount) is to check IndexedDB. If a file exists, load it into the `pdf.js` viewer immediately.
- **URL Context:** The URL should reflect the active tool (e.g., `/editor?mode=merge`).

### 4. The Workspace "Switch"

Inside the `/editor` view, the user should not feel "trapped" in one tool.

- **Dynamic Toolbar:** Add a "Global Tools" button in the header.
- **Cross-Tool Persistence:** Because we are using a centralized store (like Zustand or Redux) and IndexedDB, if a user switches from "Edit" to "Merge," the changes made in the "Edit" session (the overlays) must be saved to the store so they reappear when the user switches back.

---

## 🛠️ Implementation Guide for Antigravity IDE

You can copy and paste the following instructions into your IDE to begin building Phase 1:

> **System Prompt for Antigravity:**
> "Initialize Phase 1 of the PDF Studio project.
>
> 1. **Setup Routing:** Implement Next.js (or React Router) with paths for `/`, `/edit`, `/merge`, and `/editor`.
> 2. **Implement File Persistence:** Create a `FileService` using **IndexedDB**. When a user uploads a PDF on any tool page, save the `Uint8Array` to IndexedDB.
> 3. **Smart Loading:** Configure the `/editor` page to automatically check IndexedDB on mount. If a file is found, render it using the existing `pdf.js` logic.
> 4. **Unified UI:** Create a 'Tool Switcher' component inside the editor. Ensure that switching tools does not clear the current PDF from memory.
> 5. **User Guidance:** Build a 'Landing Zone' component for `/edit` and `/merge` that explicitly instructs the user to 'Upload a file to begin' and prevents navigation to `/editor` until the file is successfully indexed."

---

### What's next?

Once you have the **routing** and **persistence** working (where you can refresh the page and your PDF stays there), we will move to **Phase Two**.

In Phase Two, we will tackle the **"Bake Gap"** (Exporting) and **"Font Matching"** issues using the technical strategies we discussed earlier.
