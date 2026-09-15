/**
 * MHMS Oral Screening v1 - Google Apps Script Backend
 * Kiribati Ministry of Health and Medical Services
 *
 * SECURITY NOTES:
 * - This script handles sensitive health information
 * - Authorization is enforced server-side
 * - No secrets are exposed to the client
 * - All validation happens on the server
 * - Spreadsheet/Drive IDs are server-configured only
 *
 * DEPLOYMENT:
 * 1. Create a Google Sheet with the required sheet tabs
 * 2. Create a Google Drive folder for clinical photographs
 * 3. Deploy this script as a Web App (Execute as: Me, Access: Anyone with MHMS account)
 * 4. Copy the Web App URL to the frontend configuration
 */

// ============================================================
// SERVER-SIDE CONFIGURATION (DO NOT EXPOSE TO CLIENT)
// ============================================================
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',
  PHOTO_FOLDER_ID: 'YOUR_PHOTO_FOLDER_ID',

  AUTHORIZED_USERS: {
    'ktitintaake@gmail.com': 'SUPERVISOR',
    'nauantabuaka@gmail.com': 'SUPERVISOR',
    'antje.reiher@mhms.gov.ki': 'SUPERVISOR',
    'motenakau@gmail.com': 'ADMIN',
    'mootenakau@gmail.com': 'SUPERVISOR',
    'tebakai.taneriwe@gmail.com': 'SUPERVISOR',
    'mburabonita@gmail.com': 'SUPERVISOR',
    'atekaibeti@gmail.com': 'SUPERVISOR',
    'raerakaitu@gmail.com': 'SUPERVISOR',
    'aotiubaik95@gmail.com': 'SUPERVISOR',
    'jrkotua2020@gmail.com': 'SUPERVISOR',
    'roromaurin@gmail.com': 'SUPERVISOR',
    'ruthtimeon8697@gmail.com': 'SUPERVISOR',
    'bootiribabaiti@gmail.com': 'SUPERVISOR',
    'katenatikaareti2014@gmail.com': 'SUPERVISOR',
    'ruciravi@gmail.com': 'SUPERVISOR',
    'jbtiorina2509@gmail.com': 'SUPERVISOR',
    'knarereba@gmail.com': 'SUPERVISOR',
    'btoatokia@gmail.com': 'SUPERVISOR',
    'teweramire@gmail.com': 'SUPERVISOR',
    'teemwamilha@gmail.com': 'SUPERVISOR',
    'rtaeribwa@gmail.com': 'SUPERVISOR',
    'tbauro04@gmail.com': 'SUPERVISOR',
    'temaeul@gmail.com': 'SUPERVISOR',
    'nakara.ribabaiti@gmail.com': 'SUPERVISOR',
    'nikunau9@gmail.com': 'SUPERVISOR',
    'rktunet5@gmail.com': 'SUPERVISOR',
    'toatatitaake@gmail.com': 'SUPERVISOR',
    'mvianeitib78@gmail.com': 'SUPERVISOR',
    'msterawea.70@gmail.com': 'SUPERVISOR',
    'kmwemwe72@gmail.com': 'SUPERVISOR',
  },
  // Production: only users listed above are authorized.
  // 'Rabangaki BioMed' was excluded because it is not a login email address.
  ALLOW_ANY_AUTHENTICATED_USER: false,

  SHEETS: {
    PATIENTS: 'Patients',
    SCREENINGS: 'Screenings',
    TOOTH_FINDINGS: 'Tooth_Findings',
    PUFA: 'PUFA',
    CPITN: 'CPITN',
    CANCER_SCREENING: 'Cancer_Screening',
    RISK_FACTORS: 'Risk_Factors',
    PHOTOS: 'Photos',
    REFERRALS: 'Referrals',
    USERS: 'Users',
    ISLANDS: 'Islands',
    VILLAGES: 'Villages',
    EVENTS: 'Events',
    AUDIT_LOG: 'Audit_Log',
  },

  MAX_REQUEST_SIZE: 10 * 1024 * 1024,
  MAX_PHOTO_SIZE: 5 * 1024 * 1024,
  MAX_RETRIES: 5,

  AGE_THRESHOLD_FOR_M: 10,
};

// ============================================================
// WEB APP ENTRY POINTS
// ============================================================

/**
 * Handle GET requests
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const userEmail = getSessionEmail();

    if (!isAuthorized(userEmail)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    switch (action) {
      case 'get_reference_data':
        return jsonResponse(getReferenceData());
      case 'get_patients':
        return jsonResponse(getPatients(userEmail));
      case 'get_screening':
        return jsonResponse(getScreening(e.parameter.screeningId, userEmail));
      case 'sync_status':
        return jsonResponse(getSyncStatus(userEmail));
      default:
        return jsonResponse({ success: false, error: 'Unknown action' }, 400);
    }
  } catch (error) {
    logError('doGet', error);
    return jsonResponse({ success: false, error: 'An error occurred. Please try again.' }, 500);
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    // Validate request size
    if (e.postData && e.postData.length > CONFIG.MAX_REQUEST_SIZE) {
      return jsonResponse({ success: false, error: 'Request too large' }, 413);
    }

    const userEmail = getSessionEmail();

    if (!isAuthorized(userEmail)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Parse request body
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return jsonResponse({ success: false, error: 'Invalid request format' }, 400);
    }

    // Validate required fields
    if (!body.action || !body.clientSubmissionId) {
      return jsonResponse({ success: false, error: 'Missing required fields' }, 400);
    }

    const action = body.action;
    const clientSubmissionId = body.clientSubmissionId;

    // Check idempotency - prevent duplicate submissions
    if (isDuplicateSubmission(clientSubmissionId)) {
      return jsonResponse({ success: true, duplicate: true, message: 'Submission already processed' });
    }

    switch (action) {
      case 'sync_patient':
        return syncPatient(body, userEmail);
      case 'sync_screening':
        return syncScreening(body, userEmail);
      case 'sync_photo':
        return syncPhoto(body, userEmail);
      case 'sync_referral':
        return syncReferral(body, userEmail);
      default:
        return jsonResponse({ success: false, error: 'Unknown action' }, 400);
    }
  } catch (error) {
    logError('doPost', error);
    return jsonResponse({ success: false, error: 'An error occurred. Your data is safely stored on your device.' }, 500);
  }
}

// ============================================================
// AUTHORIZATION
// ============================================================

function getSessionEmail() {
  try {
    return Session.getActiveUser().getEmail();
  } catch (e) {
    return '';
  }
}

function isAuthorized(email) {
  if (!email) return false;
  if (CONFIG.ALLOW_ANY_AUTHENTICATED_USER) return true;
  if (!CONFIG.AUTHORIZED_USERS[email]) return false;
  return true;
}

function getUserRole(email) {
  if (CONFIG.ALLOW_ANY_AUTHENTICATED_USER) return 'ADMIN';
  return CONFIG.AUTHORIZED_USERS[email] || null;
}
function requireRole(email, requiredRoles) {
  const role = getUserRole(email);
  if (!role || !requiredRoles.includes(role)) {
    throw new Error('Insufficient permissions');
  }
  return role;
}

// ============================================================
// IDEMPOTENCY
// ============================================================

function isDuplicateSubmission(clientSubmissionId) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const auditSheet = ss.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);
  if (!auditSheet) return false;

  const data = auditSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === clientSubmissionId) { // Column B: clientSubmissionId
      return true;
    }
  }
  return false;
}

function recordSubmission(clientSubmissionId, type, userEmail) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let auditSheet = ss.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);
  if (!auditSheet) {
    auditSheet = ss.insertSheet(CONFIG.SHEETS.AUDIT_LOG);
    auditSheet.appendRow(['Timestamp', 'ClientSubmissionId', 'Type', 'User', 'Status']);
  }
  auditSheet.appendRow([new Date().toISOString(), clientSubmissionId, type, userEmail, 'processed']);
}

// ============================================================
// PATIENT SYNC
// ============================================================

function syncPatient(body, userEmail) {
  const role = requireRole(userEmail, ['SCREENER', 'SUPERVISOR', 'ADMIN']);
  const payload = body.payload;

  // Validate payload
  if (!payload.firstName || !payload.lastName || !payload.dateOfBirth || !payload.sex) {
    return jsonResponse({ success: false, error: 'Missing required patient fields' }, 400);
  }

  // Validate date
  if (!isValidDate(payload.dateOfBirth)) {
    return jsonResponse({ success: false, error: 'Invalid date of birth' }, 400);
  }

  // Validate sex
  if (!['male', 'female', 'other', 'unknown'].includes(payload.sex)) {
    return jsonResponse({ success: false, error: 'Invalid sex value' }, 400);
  }

  // Generate server-side patient ID
  const patientId = generatePatientId();

  // Save to sheet
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.PATIENTS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.PATIENTS);
    sheet.appendRow(['Patient_ID', 'ClientSubmissionId', 'FirstName', 'LastName', 'DOB', 'Sex', 'Island_ID', 'Village_ID', 'Phone', 'Notes', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'Version']);
  }

  sheet.appendRow([
    patientId,
    body.clientSubmissionId,
    payload.firstName,
    payload.lastName,
    payload.dateOfBirth,
    payload.sex,
    payload.islandId || '',
    payload.villageId || '',
    payload.phone || '',
    payload.notes || '',
    new Date().toISOString(),
    userEmail,
    new Date().toISOString(),
    userEmail,
    1,
  ]);

  recordSubmission(body.clientSubmissionId, 'patient', userEmail);

  return jsonResponse({ success: true, patientId: patientId });
}

// ============================================================
// SCREENING SYNC
// ============================================================

function syncScreening(body, userEmail) {
  const role = requireRole(userEmail, ['SCREENER', 'SUPERVISOR', 'ADMIN']);
  const payload = body.payload;

  // Validate required fields
  if (!payload.patientId || !payload.eventId || !payload.dateOfScreening) {
    return jsonResponse({ success: false, error: 'Missing required screening fields' }, 400);
  }

  // Validate tooth findings
  if (!payload.toothFindings || !Array.isArray(payload.toothFindings)) {
    return jsonResponse({ success: false, error: 'Invalid tooth findings' }, 400);
  }

  // Server-side DMFT recalculation and validation
  const patientAge = getPatientAge(payload.patientId, payload.dateOfScreening);
  const dmftValidation = validateDMFTServerSide(payload.toothFindings, payload.dmftResult, patientAge);
  if (!dmftValidation.valid) {
    return jsonResponse({ success: false, error: 'DMFT validation failed: ' + dmftValidation.errors.join(', ') }, 400);
  }

  // Validate periodontal
  if (payload.periodontalFindings && Array.isArray(payload.periodontalFindings)) {
    const perioValidation = validatePeriodontalServerSide(payload.periodontalFindings);
    if (!perioValidation.valid) {
      return jsonResponse({ success: false, error: 'Periodontal validation failed' }, 400);
    }
  }

  // Generate server-side screening ID
  const screeningId = generateScreeningId();

  // Save screening
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.SCREENINGS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.SCREENINGS);
    sheet.appendRow(['Screening_ID', 'ClientSubmissionId', 'Patient_ID', 'Event_ID', 'Screener', 'Date', 'DMFT_D', 'DMFT_M', 'DMFT_F', 'DMFT_T', 'dmft_d', 'dmft_e', 'dmft_f', 'dmft_t', 'Status', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'Version']);
  }

  const dmft = payload.dmftResult || { D: 0, M: 0, F: 0, T: 0 };
  const dmftPrimary = payload.dmftResultPrimary || { D: 0, M: 0, F: 0, T: 0 };

  sheet.appendRow([
    screeningId,
    body.clientSubmissionId,
    payload.patientId,
    payload.eventId,
    userEmail,
    payload.dateOfScreening,
    dmft.D, dmft.M, dmft.F, dmft.T,
    dmftPrimary.D, dmftPrimary.M, dmftPrimary.F, dmftPrimary.T,
    'synced',
    new Date().toISOString(),
    userEmail,
    new Date().toISOString(),
    userEmail,
    1,
  ]);

  // Save tooth findings
  saveToothFindings(ss, screeningId, payload.toothFindings);

  // Save PUFA
  if (payload.puFindings && payload.puFindings.length > 0) {
    savePUFA(ss, screeningId, payload.puFindings);
  }

  // Save periodontal
  if (payload.periodontalFindings && payload.periodontalFindings.length > 0) {
    saveCPITN(ss, screeningId, payload.periodontalFindings);
  }

  // Save oral mucosal screening
  if (payload.oralMucosalScreening) {
    saveCancerScreening(ss, screeningId, payload.oralMucosalScreening);
  }

  // Save risk factors
  if (payload.riskFactors) {
    saveRiskFactors(ss, screeningId, payload.riskFactors);
  }

  recordSubmission(body.clientSubmissionId, 'screening', userEmail);

  return jsonResponse({ success: true, screeningId: screeningId });
}

// ============================================================
// PHOTO SYNC
// ============================================================

function syncPhoto(body, userEmail) {
  const role = requireRole(userEmail, ['SCREENER', 'SUPERVISOR', 'ADMIN']);
  const payload = body.payload;

  if (!payload.screeningId || !payload.dataUrl) {
    return jsonResponse({ success: false, error: 'Missing photo data' }, 400);
  }

  // Validate image data
  if (!payload.dataUrl.startsWith('data:image/')) {
    return jsonResponse({ success: false, error: 'Invalid image format' }, 400);
  }

  // Generate photo ID
  const photoId = generatePhotoId();

  // Upload to Google Drive (PRIVATE folder)
  let driveFileId = '';
  try {
    const imageData = payload.dataUrl.split(',')[1];
    const blob = Utilities.newBlob(Utilities.base64Decode(imageData), payload.mimeType || 'image/jpeg', photoId + '.jpg');

    const folder = DriveApp.getFolderById(CONFIG.PHOTO_FOLDER_ID);
    const file = folder.createFile(blob);

    // Ensure file is PRIVATE
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);

    driveFileId = file.getId();
  } catch (driveError) {
    logError('Photo upload', driveError);
    return jsonResponse({ success: false, error: 'Photo upload failed. Screening data is saved.' }, 500);
  }

  // Save photo metadata to sheet
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.PHOTOS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.PHOTOS);
    sheet.appendRow(['Photo_ID', 'ClientSubmissionId', 'Screening_ID', 'Patient_ID', 'Timestamp', 'LesionSite', 'Uploader', 'DriveFileId', 'Status', 'FileSize', 'MimeType', 'CreatedAt']);
  }

  sheet.appendRow([
    photoId,
    body.clientSubmissionId,
    payload.screeningId,
    payload.patientId || '',
    payload.timestamp || new Date().toISOString(),
    payload.lesionSite || '',
    userEmail,
    driveFileId,
    'synced',
    payload.fileSize || 0,
    payload.mimeType || 'image/jpeg',
    new Date().toISOString(),
  ]);

  recordSubmission(body.clientSubmissionId, 'photo', userEmail);

  return jsonResponse({ success: true, photoId: photoId, driveFileId: driveFileId });
}

// ============================================================
// REFERRAL SYNC
// ============================================================

function syncReferral(body, userEmail) {
  const role = requireRole(userEmail, ['SCREENER', 'SUPERVISOR', 'ADMIN']);
  const payload = body.payload;

  if (!payload.screeningId || !payload.patientId || !payload.reason) {
    return jsonResponse({ success: false, error: 'Missing required referral fields' }, 400);
  }

  // Validate urgency
  if (!['routine', 'urgent', 'immediate'].includes(payload.urgency)) {
    return jsonResponse({ success: false, error: 'Invalid urgency value' }, 400);
  }

  const referralId = generateReferralId();

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.REFERRALS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.REFERRALS);
    sheet.appendRow(['Referral_ID', 'ClientSubmissionId', 'Screening_ID', 'Patient_ID', 'Reason', 'Urgency', 'Status', 'Notes', 'CreatedAt', 'CreatedBy']);
  }

  sheet.appendRow([
    referralId,
    body.clientSubmissionId,
    payload.screeningId,
    payload.patientId,
    payload.reason,
    payload.urgency,
    'pending',
    payload.notes || '',
    new Date().toISOString(),
    userEmail,
  ]);

  recordSubmission(body.clientSubmissionId, 'referral', userEmail);

  return jsonResponse({ success: true, referralId: referralId });
}

// ============================================================
// SERVER-SIDE VALIDATION
// ============================================================

function validateDMFTServerSide(toothFindings, submittedDMFT, patientAge) {
  const errors = [];
  const permanentTeeth = ['11','12','13','14','15','16','17','18','21','22','23','24','25','26','27','28','31','32','33','34','35','36','37','38','41','42','43','44','45','46','47','48'];
  const validStatuses = ['sound','decayed','filled_decay','filled','missing_caries','missing_other','excluded','not_recorded'];

  let D = 0, M = 0, F = 0;
  const seen = {};

  for (const f of toothFindings) {
    if (f.dentition !== 'permanent') continue;

    // Check duplicate
    if (seen[f.toothCode]) {
      errors.push('Duplicate tooth: ' + f.toothCode);
      continue;
    }
    seen[f.toothCode] = true;

    // Validate status
    if (!validStatuses.includes(f.status)) {
      errors.push('Invalid status for tooth ' + f.toothCode);
      continue;
    }

    switch (f.status) {
      case 'decayed':
      case 'filled_decay':
        D++;
        break;
      case 'missing_caries':
        if (patientAge >= CONFIG.AGE_THRESHOLD_FOR_M) {
          M++;
        }
        break;
      case 'filled':
        F++;
        break;
    }
  }

  // Verify submitted values match
  if (submittedDMFT) {
    if (submittedDMFT.D !== D || submittedDMFT.M !== M || submittedDMFT.F !== F) {
      errors.push('DMFT calculation mismatch');
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

function validatePeriodontalServerSide(findings) {
  const errors = [];
  const validCodes = [0, 1, 2, 3, 4, 'X', '9'];
  const sextants = {};

  for (const f of findings) {
    if (f.sextant < 1 || f.sextant > 6) {
      errors.push('Invalid sextant: ' + f.sextant);
    }
    if (sextants[f.sextant]) {
      errors.push('Duplicate sextant: ' + f.sextant);
    }
    sextants[f.sextant] = true;
    if (!validCodes.includes(f.code)) {
      errors.push('Invalid code for sextant ' + f.sextant);
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generatePatientId() {
  const props = PropertiesService.getScriptProperties();
  let counter = parseInt(props.getProperty('patient_counter') || '0');
  counter++;
  props.setProperty('patient_counter', counter.toString());
  return 'KIR-' + String(counter).padStart(6, '0');
}

function generateScreeningId() {
  const date = Utilities.formatDate(new Date(), 'Pacific/Tarawa', 'yyyyMMdd');
  const props = PropertiesService.getScriptProperties();
  const key = 'screening_counter_' + date;
  let counter = parseInt(props.getProperty(key) || '0');
  counter++;
  props.setProperty(key, counter.toString());
  return 'SCR-' + date + '-' + String(counter).padStart(6, '0');
}

function generatePhotoId() {
  const props = PropertiesService.getScriptProperties();
  let counter = parseInt(props.getProperty('photo_counter') || '0');
  counter++;
  props.setProperty('photo_counter', counter.toString());
  return 'PHO-' + String(counter).padStart(6, '0');
}

function generateReferralId() {
  const date = Utilities.formatDate(new Date(), 'Pacific/Tarawa', 'yyyyMMdd');
  const props = PropertiesService.getScriptProperties();
  const key = 'referral_counter_' + date;
  let counter = parseInt(props.getProperty(key) || '0');
  counter++;
  props.setProperty(key, counter.toString());
  return 'REF-' + date + '-' + String(counter).padStart(6, '0');
}

function isValidDate(dateStr) {
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d.getTime());
}

function getPatientAge(patientId, screeningDate) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PATIENTS);
  if (!sheet) return 0;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === patientId) {
      const dob = new Date(data[i][4]); // DOB column
      const screen = new Date(screeningDate);
      let age = screen.getFullYear() - dob.getFullYear();
      const m = screen.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && screen.getDate() < dob.getDate())) age--;
      return Math.max(0, age);
    }
  }
  return 0;
}

function saveToothFindings(ss, screeningId, findings) {
  let sheet = ss.getSheetByName(CONFIG.SHEETS.TOOTH_FINDINGS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.TOOTH_FINDINGS);
    sheet.appendRow(['Screening_ID', 'ToothCode', 'Dentition', 'Status']);
  }
  for (const f of findings) {
    sheet.appendRow([screeningId, f.toothCode, f.dentition, f.status]);
  }
}

function savePUFA(ss, screeningId, findings) {
  let sheet = ss.getSheetByName(CONFIG.SHEETS.PUFA);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.PUFA);
    sheet.appendRow(['Screening_ID', 'ToothCode', 'Dentition', 'P', 'U', 'F', 'A']);
  }
  for (const f of findings) {
    sheet.appendRow([screeningId, f.toothCode, f.dentition, f.P, f.U, f.F, f.A]);
  }
}

function saveCPITN(ss, screeningId, findings) {
  let sheet = ss.getSheetByName(CONFIG.SHEETS.CPITN);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.CPITN);
    sheet.appendRow(['Screening_ID', 'Sextant', 'Code', 'Notes']);
  }
  for (const f of findings) {
    sheet.appendRow([screeningId, f.sextant, f.code, f.notes || '']);
  }
}

function saveCancerScreening(ss, screeningId, screening) {
  let sheet = ss.getSheetByName(CONFIG.SHEETS.CANCER_SCREENING);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.CANCER_SCREENING);
    sheet.appendRow(['Screening_ID', 'AbnormalityPresent', 'LesionSite', 'Appearance', 'Duration', 'Symptoms', 'Notes', 'ReferralDecision', 'Urgency']);
  }
  sheet.appendRow([
    screeningId,
    screening.abnormalityPresent,
    screening.lesionSite || '',
    screening.lesionAppearance || '',
    screening.lesionDuration || '',
    screening.lesionSymptoms || '',
    screening.clinicalNotes || '',
    screening.referralDecision || '',
    screening.referralUrgency || '',
  ]);
}

function saveRiskFactors(ss, screeningId, risk) {
  let sheet = ss.getSheetByName(CONFIG.SHEETS.RISK_FACTORS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.RISK_FACTORS);
    sheet.appendRow(['Screening_ID', 'TobaccoStatus', 'TobaccoType', 'TobaccoFreq', 'TobaccoYears', 'ArecaStatus', 'ArecaFreq', 'ArecaYears', 'ArecaTobaccoMixed', 'AlcoholStatus', 'AlcoholFreq', 'AlcoholAmount', 'AlcoholYears', 'FamilyCancer', 'FamilyRelationship', 'FamilyCancerType', 'Immunosuppression', 'OtherNotes']);
  }
  sheet.appendRow([
    screeningId,
    risk.tobacco?.status || '',
    risk.tobacco?.type || '',
    risk.tobacco?.frequency || '',
    risk.tobacco?.yearsUsed || '',
    risk.arecaBetel?.status || '',
    risk.arecaBetel?.frequency || '',
    risk.arecaBetel?.yearsUsed || '',
    risk.arecaBetel?.tobaccoMixed || false,
    risk.alcohol?.status || '',
    risk.alcohol?.frequency || '',
    risk.alcohol?.typicalAmount || '',
    risk.alcohol?.yearsUsed || '',
    risk.familyCancer?.present || '',
    risk.familyCancer?.relationship || '',
    risk.familyCancer?.cancerType || '',
    risk.immunosuppression || false,
    risk.otherRiskFactors || '',
  ]);
}

function jsonResponse(data, code) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function logError(context, error) {
  // Log only non-sensitive operational information
  // NEVER log patient data, PHI, or stack traces that might contain PHI
  console.log('ERROR [' + context + ']: ' + (error.message || 'Unknown error'));
}

// ============================================================
// REFERENCE DATA
// ============================================================

function getReferenceData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const result = {};

  // Islands
  const islandsSheet = ss.getSheetByName(CONFIG.SHEETS.ISLANDS);
  if (islandsSheet) {
    const data = islandsSheet.getDataRange().getValues();
    result.islands = data.slice(1).map(row => ({ islandId: row[0], name: row[1] }));
  }

  // Villages
  const villagesSheet = ss.getSheetByName(CONFIG.SHEETS.VILLAGES);
  if (villagesSheet) {
    const data = villagesSheet.getDataRange().getValues();
    result.villages = data.slice(1).map(row => ({ villageId: row[0], islandId: row[1], name: row[2] }));
  }

  // Events
  const eventsSheet = ss.getSheetByName(CONFIG.SHEETS.EVENTS);
  if (eventsSheet) {
    const data = eventsSheet.getDataRange().getValues();
    result.events = data.slice(1).map(row => ({ eventId: row[0], name: row[1], date: row[2], location: row[3], active: row[4] }));
  }

  return { success: true, data: result };
}

function getPatients(userEmail) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PATIENTS);
  if (!sheet) return { success: true, patients: [] };

  const data = sheet.getDataRange().getValues();
  const patients = data.slice(1).map(row => ({
    patientId: row[0],
    firstName: row[2],
    lastName: row[3],
    dateOfBirth: row[4],
    sex: row[5],
    islandId: row[6],
    villageId: row[7],
  }));

  return { success: true, patients: patients };
}

function getScreening(screeningId, userEmail) {
  // Return screening data for authorized users
  return { success: true, screening: null }; // TODO: implement full retrieval
}

function getSyncStatus(userEmail) {
  return { success: true, online: true };
}
