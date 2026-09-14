// MHMS Oral Screening - Type Definitions
// All clinical and application types

// ============================================================
// PATIENT
// ============================================================
export interface Patient {
  patientId: string; // Server-generated: KIR-000001
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date
  sex: 'male' | 'female' | 'other' | 'unknown';
  islandId: string;
  villageId: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
  clientSubmissionId: string; // Idempotency key
}

// ============================================================
// TOOTH FINDINGS (DMFT/dmft per WHO 5th edition)
// ============================================================
// Permanent tooth codes: 11-18, 21-28, 31-38, 41-48 (32 teeth)
// Primary tooth codes: 51-55, 61-65, 71-75, 81-85 (20 teeth)

export type PermanentToothCode =
  | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18'
  | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28'
  | '31' | '32' | '33' | '34' | '35' | '36' | '37' | '38'
  | '41' | '42' | '43' | '44' | '45' | '46' | '47' | '48';

export type PrimaryToothCode =
  | '51' | '52' | '53' | '54' | '55'
  | '61' | '62' | '63' | '64' | '65'
  | '71' | '72' | '73' | '74' | '75'
  | '81' | '82' | '83' | '84' | '85';

// WHO 5th edition caries codes for permanent teeth
export type PermanentToothStatus =
  | 'sound'        // No caries, no fillings
  | 'decayed'      // Caries present (D)
  | 'filled_decay' // Filled with secondary caries (counts as D)
  | 'filled'       // Filled, no caries (F)
  | 'missing_caries' // Missing due to caries (M) - age-dependent
  | 'missing_other'  // Missing for other reason (not counted in M)
  | 'excluded'     // Tooth excluded (e.g. congenitally missing, orthodontic extraction)
  | 'not_recorded'; // Not examined

// WHO 5th edition caries codes for primary teeth
export type PrimaryToothStatus =
  | 'sound'
  | 'decayed'        // Caries (d)
  | 'filled_decay'   // Filled with secondary caries (counts as d)
  | 'filled'         // Filled, no caries (f)
  | 'missing_caries' // Missing due to caries (m)
  | 'missing_other'  // Missing for other reason
  | 'excluded'
  | 'not_recorded'
  | 'extracted_caries' // Extracted due to caries (for primary - specific to WHO)
  | 'extracted_other'; // Extracted for other reason

export interface ToothFinding {
  toothCode: string;
  status: PermanentToothStatus | PrimaryToothStatus;
  dentition: 'permanent' | 'primary';
}

// ============================================================
// PUFA / pufa
// ============================================================
export type PUFAStatus = 'absent' | 'present';

export interface PUFATooth {
  toothCode: string;
  dentition: 'permanent' | 'primary';
  P: boolean; // Pulpal involvement
  U: boolean; // Ulceration
  F: boolean; // Fistula
  A: boolean; // Abscess
}

// ============================================================
// PERIODONTAL (CPITN/CPI)
// ============================================================
export type Sextant = 1 | 2 | 3 | 4 | 5 | 6;

// CPITN codes - configurable per MHMS protocol
export type CPITNCode = 0 | 1 | 2 | 3 | 4 | 'X' | '9';
// 0 = Healthy
// 1 = Bleeding on probing
// 2 = Calculus
// 3 = Shallow pocket (4-5mm)
// 4 = Deep pocket (6mm+)
// X = Excluded (fewer than 2 functional teeth)
// 9 = Not recorded

export interface PeriodontalFinding {
  sextant: Sextant;
  code: CPITNCode;
  notes?: string;
}

// ============================================================
// ORAL MUCOSAL / CANCER SCREENING
// ============================================================
export interface OralMucosalScreening {
  abnormalityPresent: boolean;
  lesionSite?: string;
  lesionAppearance?: string;
  lesionDuration?: string;
  lesionSymptoms?: string;
  clinicalNotes?: string;
  referralDecision?: 'refer' | 'monitor' | 'no_action';
  referralUrgency?: 'routine' | 'urgent' | 'immediate';
  // Configurable referral criteria met
  referralCriteriaMet?: string[];
}

// ============================================================
// RISK FACTORS
// ============================================================
export interface TobaccoRisk {
  status: 'never' | 'current' | 'former' | 'unknown';
  type?: string;
  frequency?: string;
  yearsUsed?: number;
}

export interface ArecaBetelRisk {
  status: 'never' | 'current' | 'former' | 'unknown';
  frequency?: string;
  yearsUsed?: number;
  tobaccoMixed?: boolean;
}

export interface AlcoholRisk {
  status: 'never' | 'current' | 'former' | 'unknown';
  frequency?: string;
  typicalAmount?: string;
  yearsUsed?: number;
}

export interface FamilyCancerRisk {
  present: 'no' | 'yes' | 'unknown';
  relationship?: string;
  cancerType?: string;
  ageAtDiagnosis?: number;
}

export interface RiskFactors {
  tobacco: TobaccoRisk;
  arecaBetel: ArecaBetelRisk;
  alcohol: AlcoholRisk;
  familyCancer: FamilyCancerRisk;
  immunosuppression?: boolean;
  immunosuppressionNotes?: string;
  hpvHistory?: string;
  otherRiskFactors?: string;
}

// ============================================================
// SCREENING
// ============================================================
export type SyncStatus = 'draft' | 'saved_local' | 'syncing' | 'synced' | 'sync_failed';

export interface Screening {
  screeningId: string; // Server-generated: SCR-YYYYMMDD-000001
  patientId: string;
  eventId: string;
  screenerId: string;
  dateOfScreening: string; // ISO date

  // Clinical data
  toothFindings: ToothFinding[];
  dmftResult?: DMFTResult;
  dmftResultPrimary?: DMFTResult;
  puFindings: PUFATooth[];
  periodontalFindings: PeriodontalFinding[];
  oralMucosalScreening: OralMucosalScreening;
  riskFactors: RiskFactors;

  // Status
  status: SyncStatus;
  clientSubmissionId: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
  retryCount: number;
  lastError?: string;
}

export interface DMFTResult {
  D: number; // Decayed
  M: number; // Missing due to caries
  F: number; // Filled
  T: number; // Total (D+M+F)
  teeth: number; // Total teeth examined
}

// ============================================================
// PHOTO
// ============================================================
export interface PhotoRecord {
  photoId: string; // Server-generated: PHO-000001
  screeningId: string;
  patientId: string;
  timestamp: string;
  lesionSite?: string;
  uploaderId: string;
  driveFileId?: string; // Set after upload
  status: SyncStatus;
  clientSubmissionId: string;
  localBlobUrl?: string; // For local preview
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

// ============================================================
// REFERRAL
// ============================================================
export interface Referral {
  referralId: string; // Server-generated: REF-YYYYMMDD-000001
  screeningId: string;
  patientId: string;
  reason: string;
  urgency: 'routine' | 'urgent' | 'immediate';
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  createdBy: string;
  clientSubmissionId: string;
}

// ============================================================
// REFERENCE DATA
// ============================================================
export interface Island {
  islandId: string;
  name: string;
}

export interface Village {
  villageId: string;
  islandId: string;
  name: string;
}

export interface ScreeningEvent {
  eventId: string;
  name: string;
  date: string; // ISO date or empty for recurring
  location: string;
  active: boolean; // false = archived (hidden from dropdown but preserved for history)
  createdAt: string;
  createdBy: string;
  archivedAt?: string;
  archivedBy?: string;
}

export interface User {
  userId: string;
  email: string;
  name: string;
  role: 'SCREENER' | 'SUPERVISOR' | 'ADMIN';
  active: boolean;
}

// ============================================================
// SYNC QUEUE
// ============================================================
export interface SyncQueueItem {
  localId: string;
  clientSubmissionId: string;
  type: 'patient' | 'screening' | 'photo' | 'referral';
  payload: any;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  syncStatus: SyncStatus;
  lastError?: string;
  payloadVersion: number;
}
