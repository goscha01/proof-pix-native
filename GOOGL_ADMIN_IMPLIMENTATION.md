Nice — below is a clear, **actionable step-by-step plan** you can paste into your IDE or give to an AI coder. It’s written as discrete tasks with implementation notes, API calls, sample snippets, and acceptance tests. The plan assumes **React Native only (no backend)** and uses an **admin-owned Google Apps Script web endpoint** as an upload gateway so team members can upload *without seeing* folder contents.

---

# Step-by-step implementation plan (for AI coder / IDE)

## Overview / goals

1. Admin connects their Google account (OAuth) from the React Native app.
2. App creates an upload folder in admin’s Drive.
3. App programmatically creates & deploys a tiny Apps Script web app (owned by admin) whose `doPost` writes uploaded files into that folder.
4. Admin invites team members by generating invite tokens/links (managed locally & stored in the Apps Script properties).
5. Team members upload photos to the Apps Script endpoint using the invite link (upload-only — they cannot list or read files).
6. App enforces team size limits according to the admin’s plan (client-side).

---

## Prerequisites (what to prepare before coding)

* Create a **Google Cloud Project** and enable:

  * Google Drive API
  * Google Apps Script API
* Configure **OAuth consent** (internal/external) and add redirect URIs used by your RN app.
* Generate OAuth client ID for mobile (or web depending on RN flow).
* In your React Native project, add:

  * `@react-native-google-signin/google-signin` (or `expo-google-auth-session` if using Expo)
  * `react-native-fs` or similar for file handling (optional)
* Prepare a safe place to store tokens/metadata in the app (secure store / AsyncStorage).
* Note quotas and limits: Drive and Apps Script quotas apply.

---

## High-level task list (deliverable tasks for the AI coder)

### Task 1 — Integrate Google Sign-In (admin authentication)

**Goal:** Admin can sign in with Google and obtain an OAuth access token with Drive and Apps Script scopes.

**Steps:**

1. Add and configure Google Sign-in in RN.
2. Request scopes:

   * `https://www.googleapis.com/auth/drive.file` — to create files/folders the app uses.
   * `https://www.googleapis.com/auth/script.projects` and `https://www.googleapis.com/auth/script.deployments` and optionally `https://www.googleapis.com/auth/script.external_request` (if using Apps Script API).
   * `https://www.googleapis.com/auth/drive` may be needed for script creation/deploy directory operations — use minimal required scopes.
3. After sign-in, store:

   * `accessToken` (short-lived)
   * `idToken` (if needed)
   * refresh token (platform permitting; Android/iOS flows vary)

**Acceptance criteria:**

* Admin signs in and the app receives an OAuth token and can call Drive API and Apps Script API with it.

**Sample (conceptual) RN snippet:**

```js
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: '<YOUR_WEB_CLIENT_ID>',
  scopes: ['https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/script.projects','https://www.googleapis.com/auth/script.deployments']
});

async function signInAdmin() {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const tokens = await GoogleSignin.getTokens(); // accessToken / idToken
  // store tokens securely
}
```

---

### Task 2 — Create the upload folder in admin’s Drive

**Goal:** Programmatically create a dedicated folder (e.g., `MyApp Uploads - <org>`) and store `folderId`.

**Steps:**

1. Call Drive API `files.create` with body:

   * `name`: folder name
   * `mimeType`: `application/vnd.google-apps.folder`
2. Save `folderId` locally on admin device (SecureStore or AsyncStorage).

**API call example (fetch):**

```
POST https://www.googleapis.com/drive/v3/files
Headers: Authorization: Bearer <ACCESS_TOKEN>
Body (JSON): { "name": "MyApp Uploads - Acme", "mimeType": "application/vnd.google-apps.folder" }
```

**Acceptance criteria:**

* Folder created and `folderId` returned and stored.

---

### Task 3 — Prepare Apps Script code (upload endpoint)

**Goal:** Create an Apps Script project that exposes a `doPost(e)` endpoint which:

* Validates an invite token.
* Accepts multipart/form-data or base64 file payloads.
* Saves incoming files to the `folderId`.
* Uses `PropertiesService` to keep a list of valid tokens (set by admin).

**Sample Apps Script (server-side) — `Code.gs`:**

```javascript
// Simple upload endpoint: POST with multipart/form-data or JSON { filename, contentBase64, token }
function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var allowed = JSON.parse(props.getProperty('INVITE_TOKENS') || '[]'); // array of tokens
    var folderId = props.getProperty('UPLOAD_FOLDER_ID');
    
    // extract token and file
    var token = e.parameter && e.parameter.token;
    if (!token || allowed.indexOf(token) === -1) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // handle base64 JSON body (safer for RN): { filename, contentBase64 }
    var body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : null;
    if (body && body.filename && body.contentBase64) {
      var blob = Utilities.newBlob(Utilities.base64Decode(body.contentBase64), '', body.filename);
      var folder = DriveApp.getFolderById(folderId);
      var file = folder.createFile(blob);
      return ContentService.createTextOutput(JSON.stringify({ success: true, fileId: file.getId() })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // else, respond bad request
    return ContentService.createTextOutput(JSON.stringify({ error: 'Bad request' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

**Notes:**

* Use `postData.contents` with JSON `{ filename, contentBase64, token }` for simplicity on RN side.
* Use `PropertiesService` keys:

  * `UPLOAD_FOLDER_ID`
  * `INVITE_TOKENS` — JSON array of allowed tokens
  * `PLAN_LIMIT` — max invites allowed
* All writes happen under the admin account because the script is owned/deployed by admin.

**Acceptance criteria:**

* The script code exists and the `doPost` can accept a base64 upload + token and create a file inside the folder.

---

### Task 4 — Programmatically create & deploy the Apps Script project (admin does this in-app)

**Goal:** Use the Apps Script REST API to create a project, update code, set script properties, and create a deployment (web app) that anyone with link can `POST` to.

**High-level steps (API calls using admin’s access token):**

1. **Create a new Apps Script project**

   ```
   POST https://script.googleapis.com/v1/projects
   Body: { title: "MyApp Upload Gateway - <adminEmail>" }
   ```
2. **Update project content** (code file) using `projects.updateContent`.

   * PUT `/v1/projects/{scriptId}/content` with `files` containing `Code.gs` text.
3. **Set script properties** (use `PropertiesService` via the script itself or use the Script API to set defaults. Alternatively, call a `doPost` endpoint to initialize properties after deployment).
4. **Create an OAuth-enabled deployment (web app)** using `projects.deployments.create` with deployment manifest that exposes web app `executeAs: USER_ACCESSING` or `executeAs: OWNER` (we want OWNER/admin executing).

   * You need to set `manifest` with `webapp` configuration.

**Important notes:**

* Apps Script web apps deployed to run as owner will run with admin permissions. The web app must be deployed with access `anyone` or `anyoneWithLink` (depends on security — choose `anyoneWithLink` to allow anyone with the link to POST).
* Using `anyoneWithLink` means anyone with link and a valid token can upload; token validation is critical.

**Acceptance criteria:**

* After programmatic deployment, a working `webAppUrl` (exec URL) is returned and saved in admin app.

---

### Task 5 — Hook up admin UI: generate invites and manage them

**Goal:** Admin can:

* See current `folderId` and script `execUrl`.
* Add/remove invite tokens (max limited by plan).
* Generate an invite link (`execUrl?token=<uuid>`) or pass token separately.

**Steps:**

1. Provide UI to:

   * Create new token (UUIDv4).
   * Add token to local list (and push to script properties via an admin call).
   * Remove token (delete from script properties).
2. Use the Apps Script API to invoke a small management endpoint (or call `doPost` with special `action=update_tokens`) to update `INVITE_TOKENS` and `UPLOAD_FOLDER_ID`. Alternatively, when creating script, set script properties via the Apps Script API or execute a setup function via `scripts.run` endpoint.

**Minimal example to update script properties (call from admin app using Script API):**

* Create a helper function in your Apps Script:

```javascript
function updateScriptProperties(payload) {
  var props = PropertiesService.getScriptProperties();
  if (payload.folderId) props.setProperty('UPLOAD_FOLDER_ID', payload.folderId);
  if (payload.inviteTokens) props.setProperty('INVITE_TOKENS', JSON.stringify(payload.inviteTokens));
  if (payload.planLimit) props.setProperty('PLAN_LIMIT', payload.planLimit.toString());
  return true;
}
```

* Call using `https://script.googleapis.com/v1/scripts/{scriptId}:run` with admin access token to call `updateScriptProperties`.

**Acceptance criteria:**

* Admin can create tokens and the Apps Script `INVITE_TOKENS` reflects them. Team members using token can upload.

---

### Task 6 — Team member upload flow (React Native)

**Goal:** Team users can upload a file (photo) to `execUrl` using token — client sends base64 JSON to the `doPost` script.

**Steps:**

1. On team device, open invite link or paste token.
2. For each photo:

   * Read file as base64.
   * POST to `execUrl` with JSON body:

     ```json
     {
       "token": "<invite-token>",
       "filename": "IMG_001.jpg",
       "contentBase64": "<base64 string>"
     }
     ```
3. Handle response (success/failure).

**Sample RN upload code (fetch):**

```js
async function uploadPhoto(execUrl, token, filename, base64content) {
  const body = JSON.stringify({ token, filename, contentBase64: base64content });
  const resp = await fetch(execUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  const json = await resp.json();
  return json;
}
```

**Acceptance criteria:**

* Team member can upload a photo using the invite token and the file appears in admin’s folder in Drive (without the team member seeing folder contents).

---

### Task 7 — Enforce plan limits (client-only enforcement)

**Goal:** App prevents admin from creating more invite tokens than their plan allows.

**Implementation ideas:**

* Keep `PLAN_LIMIT` in admin UI (hard-coded or stored in script properties).
* When admin requests a new token, check local count vs `PLAN_LIMIT`.
* Optionally, store plan metadata in `PropertiesService` (so script knows limit too).

**Acceptance criteria:**

* Admin cannot exceed invite creation beyond plan limit. UI shows remaining invites.

---

### Task 8 — Error handling, logging, and testing

**Acceptance / test cases:**

1. **Admin sign-in:** Admin tokens valid and can call Drive and Script APIs.
2. **Folder creation:** Folder created and visible in admin Drive.
3. **Script deployment:** `execUrl` returned and accessible.
4. **Token management:** Admin adds token, token stored in script properties.
5. **Upload:** Team member POST with token; file appears in admin folder.
6. **Unauthorized:** Wrong token returns `Unauthorized`.
7. **Plan limit:** Creating >limit tokens is blocked.

**Edge cases:**

* Expired access token: refresh flow in RN must re-auth.
* Quota errors from Apps Script or Drive: show friendly message.
* Large uploads: Apps Script has payload limits (~50 MB?). For large files, consider chunking or direct Drive API uploads (but that exposes more complexity).

---

## Security considerations & tradeoffs (explain to the coder)

* **Apps Script `anyoneWithLink`** + token = anyone with link + valid token can upload. Tokens must be unguessable (UUIDv4).
* Because there’s no server, tokens are stored in script properties; admin must secure their account.
* Apps Script payload size may be limited; for very large photos, consider client resizing or compressing before upload.
* Drive quotas and Apps Script quotas apply; monitor and rate-limit uploads.
* If you need stricter security (e.g., revoke tokens remotely, logs), consider adding a lightweight backend later.

---

## Optional: Programmatic vs manual script deployment

* **Programmatic (recommended for smooth UX):** use the Apps Script REST API to create project, update code, and deploy. Requires handling `projects.create`, `content.update`, `deployments.create`, and `scripts.run` calls.
* **Manual:** Provide a one-time guide for admin to copy/paste script into script.google.com, set properties, and “Deploy as web app.” Use this method if programmatic deployment runs into permission complexity.

---

## Deliverable checklist for the AI coder (exact tasks)

1. Implement Google Sign-In integration w/ requested scopes.
2. Implement Drive `create folder` call and persist `folderId`.
3. Implement Apps Script code `doPost`, `updateScriptProperties` (exact code above).
4. Implement programmatic Apps Script creation & deployment (call Apps Script REST API) and store `execUrl`. If programmatic fails, provide clear fallback manual flow.
5. Implement admin UI to manage invites (create UUID tokens, show remaining invites).
6. Implement function that calls `scripts.run` to call `updateScriptProperties` with `folderId`, `INVITE_TOKENS`.
7. Implement team-side upload function (read file → base64 → POST).
8. Add client-side enforcement for plan limits.
9. Add tests for each acceptance criteria, and error handling for token/expired auth and quota errors.
10. Document manual admin recovery steps (how to remove a token, redeploy script, get `folderId`).

---

## Helpful API endpoints & references (for coder)

* Drive create file/folder: `POST https://www.googleapis.com/drive/v3/files`
* Apps Script REST: `https://script.googleapis.com/v1/projects`, `...:run`, `.../deployments`
* Use `Authorization: Bearer <ACCESS_TOKEN>` for all calls.

---

## Final notes for the coder / AI in IDE

* Make file uploads as base64 JSON (simple, works well in RN).
* Keep server logic minimal in Apps Script.
* Provide both programmatic deployment and a short manual deployment fallback in the UI (copy/paste).
* Provide a debug view in admin settings that shows current tokens, exec URL, folderId, and plan limits.

---

If you want, I can now:

* Generate the full Apps Script project files (exact `Code.gs`) ready to upload.
* Generate a ready-to-paste RN module for Google SignIn + Drive folder creation + upload example (including token generation).
* Produce curl examples for the Apps Script REST API steps to deploy the script programmatically.

Which one should I generate next?
