# MHMS Oral Screening v1

**Kiribati Ministry of Health and Medical Services — Community Dental Screening Application**

A lightweight digital oral-health screening application for MHMS community dental screening programs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (GitHub Pages)                    │
│  React + Vite + Tailwind CSS                                 │
│  - Mobile-first wizard UI                                    │
│  - IndexedDB offline storage                                 │
│  - Client-side validation                                    │
│  - Photo capture & compression                               │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS (sync when online)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               BACKEND (Google Apps Script)                    │
│  - Server-side validation                                    │
│  - Authorization enforcement                                 │
│  - Idempotency (duplicate prevention)                        │
│  - ID generation (authoritative)                             │
└───────────┬───────────────────────────────┬─────────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────┐     ┌─────────────────────────────┐
│   Google Sheets        │     │   Google Drive (PRIVATE)     │
│   (Database/CRM)       │     │   (Clinical Photographs)     │
│                        │     │                              │
│   - Patients           │     │   - No public access         │
│   - Screenings         │     │   - Authorized users only    │
│   - Tooth_Findings     │     │   - Metadata in Sheets       │
│   - PUFA               │     │                              │
│   - CPITN              │     └─────────────────────────────┘
│   - Cancer_Screening   │
│   - Risk_Factors       │
│   - Photos (metadata)  │
│   - Referrals          │
│   - Users              │
│   - Islands/Villages   │
│   - Events             │
│   - Audit_Log          │
└────────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Google account with access to Google Sheets, Drive, and Apps Script
- GitHub account for deployment

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Google Apps Script Deployment

1. Create a new Google Apps Script project
2. Copy the contents of `apps-script/Code.gs` into the script editor
3. Configure `CONFIG` object:
   - Set `SPREADSHEET_ID` to your Google Sheet ID
   - Set `PHOTO_FOLDER_ID` to your private Drive folder ID
   - Add authorized user emails to `AUTHORIZED_USERS`
4. Deploy as Web App:
   - Execute as: **Me**
   - Who has access: **Anyone** (authorization is enforced in code)
5. Copy the Web App URL
6. Set the URL in the frontend: `localStorage.setItem('mhms_backend_url', 'YOUR_URL')`

### Google Sheets Setup

Create a new Google Sheet with the following tabs (sheets will be auto-created on first sync):

| Tab Name | Purpose |
|----------|---------|
| Patients | Patient records |
| Screenings | Screening records |
| Tooth_Findings | Per-tooth DMFT/dmft data |
| PUFA | PUFA/pufa findings |
| CPITN | Periodontal findings |
| Cancer_Screening | Oral mucosal screening |
| Risk_Factors | Patient risk factors |
| Photos | Photo metadata (NOT image data) |
| Referrals | Referral records |
| Users | Authorized users |
| Islands | Kiribati islands reference |
| Villages | Villages by island |
| Events | Screening events |
| Audit_Log | Submission audit trail |

**IMPORTANT:** Set sharing to restricted. Never make the sheet public.

### Google Drive Setup

1. Create a new folder for clinical photographs
2. Set folder permissions to **restricted** (only authorized users)
3. Copy the folder ID to `CONFIG.PHOTO_FOLDER_ID` in the Apps Script
4. **NEVER** set the folder to "Anyone with the link"

### GitHub Pages Deployment

```bash
# Build the application
npm run build

# The dist/ folder is ready for GitHub Pages
# Push to your gh-pages branch or configure GitHub Pages
```

---

## Configuration

### Environment

| Setting | Location | Description |
|---------|----------|-------------|
| Backend URL | `localStorage('mhms_backend_url')` | Apps Script Web App URL |
| Spreadsheet ID | Apps Script `CONFIG` | Google Sheet ID |
| Photo Folder ID | Apps Script `CONFIG` | Private Drive folder |
| Authorized Users | Apps Script `CONFIG` | Email → Role mapping |

**NEVER** put secrets in frontend code. The frontend is public on GitHub Pages.

---

## User Roles

| Role | Permissions |
|------|-------------|
| **SCREENER** | Create/search patients, create screenings, capture photos, create referrals |
| **SUPERVISOR** | All screener permissions + review/approve records, correct entries |
| **ADMIN** | All permissions + manage users, islands, villages, events, view reports |

Authorization is enforced **server-side**. Frontend role checks are for UI only.

---

## Offline Behavior

The application is designed for intermittent connectivity in Kiribati:

1. **Open app** → Loads cached reference data from IndexedDB
2. **Conduct screening** → Data saved locally in IndexedDB
3. **Capture photos** → Queued locally with metadata
4. **See status** → "Saved on this device" confirmation
5. **When online** → Automatic sync begins
6. **Server confirms** → Records marked as synced
7. **If sync fails** → Records remain queued, retry automatically

**Data loss prevention:**
- Records are NEVER deleted until server confirms sync
- Idempotency keys prevent duplicate submissions
- Browser refresh does not lose unsynchronized data
- Crash recovery via IndexedDB persistence

### Sync Status States

| Status | Meaning |
|--------|---------|
| Draft | In-progress, not yet saved |
| Saved on device | Stored locally, not yet uploaded |
| Syncing | Being uploaded to server |
| Synced | Confirmed by server |
| Sync failed | Upload failed, will retry |

---

## Clinical Calculations

### WHO 5th Edition DMFT/dmft

**Permanent dentition (DMFT):**
- D = Decayed (includes filled with secondary caries)
- M = Missing due to caries (age-dependent: only if age ≥ 10)
- F = Filled without caries
- Based on 32 teeth

**Primary dentition (dmft):**
- d = Decayed
- e/m = Extracted/missing due to caries
- f = Filled without caries
- Based on 20 teeth

**Key rule:** Below age 10, missing permanent teeth are NOT counted as M per WHO 5th edition (primary teeth are being exfoliated, permanent teeth may not have erupted).

### PUFA/pufa

Recorded per-tooth for decayed teeth:
- P = Pulpal involvement
- U = Ulceration from dental cause
- F = Fistula
- A = Abscess

---

## Photo Handling

1. User captures photo via device camera
2. Client validates file type and size
3. Photo is compressed/resize on-device
4. Photo is queued in IndexedDB
5. On sync: uploaded to PRIVATE Google Drive
6. Photo metadata saved to Google Sheets
7. Drive file is set to PRIVATE (no public access)

**Limits:**
- Max 5MB per photo (before compression)
- Max 10 photos per screening
- Accepted formats: JPEG, WebP, PNG

---

## Security Model

### What is protected:
- Patient health information (PHI)
- Clinical photographs
- User access control

### Security measures:
- Server-side authorization (not just frontend)
- Idempotency keys prevent duplicate submissions
- Input validation on both client and server
- No secrets in frontend code
- No PHI in GitHub repository
- No PHI in browser console logs
- Private Google Drive for photos
- Restricted Google Sheets access
- Safe error messages (no stack traces to users)

### Security review checklist:
- [x] No XSS via innerHTML (uses React/textContent)
- [x] No exposed credentials in frontend
- [x] Server-side authorization
- [x] Input validation
- [x] Request size limits
- [x] Safe error messages
- [x] No PHI in logs
- [x] Private Drive files
- [x] Idempotency protection

---

## Testing

### Clinical Calculation Tests

Test cases for WHO 5th edition DMFT:

| Scenario | Expected D | Expected M | Expected F | Expected DMFT |
|----------|-----------|-----------|-----------|---------------|
| All sound teeth | 0 | 0 | 0 | 0 |
| 3 decayed, age 15 | 3 | 0 | 0 | 3 |
| 2 filled, age 20 | 0 | 0 | 2 | 2 |
| 1 missing (caries), age 25 | 0 | 1 | 0 | 1 |
| 1 missing (caries), age 8 | 0 | 0 | 0 | 0 |
| 1 missing (other reason), age 30 | 0 | 0 | 0 | 0 |
| Mixed: 2D + 1M + 3F, age 20 | 2 | 1 | 3 | 6 |

### Manual Testing Checklist

- [ ] Application loads on mobile (Android)
- [ ] Application loads on desktop
- [ ] Patient registration works
- [ ] Patient search works
- [ ] Island → Village dependency works
- [ ] Tooth chart is usable on phone
- [ ] DMFT calculation is correct
- [ ] dmft calculation is correct
- [ ] PUFA recording works
- [ ] Periodontal sextant coding works
- [ ] Oral mucosal screening works
- [ ] Risk factors progressive disclosure works
- [ ] Photo capture works
- [ ] Photo validation rejects invalid files
- [ ] Offline: data survives browser refresh
- [ ] Offline: sync works when connectivity returns
- [ ] Duplicate submission is prevented
- [ ] Error messages are safe (no stack traces)
- [ ] No PHI in browser console

---

## Backup & Recovery

### Google Sheets
- Enable Google Sheets version history
- Export weekly backup to local storage
- Consider Google Workspace backup tools

### Google Drive (Photos)
- Photos are in a private folder
- Enable Drive versioning
- Consider periodic export of photo metadata

### Apps Script
- Use Apps Script versioning (Manage Versions)
- Keep a copy of Code.gs in this repository

### GitHub
- All frontend code is versioned in Git
- Use branches for development

### Restoration Procedure
1. Restore Google Sheet from backup/export
2. Re-deploy Apps Script from repository copy
3. Rebuild and redeploy frontend from GitHub
4. Verify configuration (Spreadsheet ID, Drive folder, users)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| App won't load | Check browser console for errors. Clear cache. |
| Data not syncing | Check internet connection. Check backend URL in localStorage. |
| Photos not uploading | Check file size. Check Drive folder permissions. |
| "Unauthorized" error | Check user email is in AUTHORIZED_USERS. |
| Duplicate IDs | Idempotency key issue. Check Audit_Log sheet. |
| DMFT seems wrong | Check patient age. Under 10: M is not counted. |

---

## Documentation Status

| Document | Status |
|----------|--------|
| README.md | ✅ IMPLEMENTED |
| CLINICAL-GOVERNANCE.md | ✅ IMPLEMENTED |
| Apps Script deployment guide | ✅ IN THIS FILE |
| API documentation | ⚙️ CONFIGURATION REQUIRED |
| User training materials | ⚙️ TO BE CREATED |

---

## Known Limitations (v1)

1. No real-time collaboration (single user per device)
2. No advanced reporting (basic Sheets-based reporting)
3. No patient photo in records (clinical photos only)
4. No multi-language support (English only)
5. Photo compression is basic (browser-native)
6. No push notifications for sync status

---

## License

Proprietary — Kiribati Ministry of Health and Medical Services

---

*Version 1.0 — 2026*
