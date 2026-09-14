// MHMS Oral Screening - Validation & ID Generation
// Client-side validation for immediate user feedback
// Server-side validation is the authoritative check

import type {
  Patient,
  Screening,
  RiskFactors,
  OralMucosalScreening,
  PeriodontalFinding,
  PUFATooth,
  ToothFinding,
  PhotoRecord,
} from './types';
import { PERMANENT_TEETH, PRIMARY_TEETH, isValidToothCode, checkDuplicateTeeth } from './clinical';
import { APP_CONFIG } from './config';

// ============================================================
// ID GENERATION
// ============================================================
// These are client-generated for local use only
// Server generates authoritative IDs

/**
 * Generate a client submission ID (UUID-like)
 * Used as idempotency key to prevent duplicates
 */
export function generateClientSubmissionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Generate a local patient ID (will be replaced by server ID)
 */
export function generateLocalPatientId(): string {
  return `LOCAL-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Generate a local screening ID
 */
export function generateLocalScreeningId(): string {
  return `LOCAL-SCR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

// ============================================================
// VALIDATION
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate patient data
 */
export function validatePatient(patient: Partial<Patient>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!patient.firstName || patient.firstName.trim().length === 0) {
    errors.push({ field: 'firstName', message: 'First name is required', severity: 'error' });
  }

  if (!patient.lastName || patient.lastName.trim().length === 0) {
    errors.push({ field: 'lastName', message: 'Last name is required', severity: 'error' });
  }

  if (!patient.dateOfBirth) {
    errors.push({ field: 'dateOfBirth', message: 'Date of birth is required', severity: 'error' });
  } else {
    const dob = new Date(patient.dateOfBirth);
    const now = new Date();
    if (dob > now) {
      errors.push({ field: 'dateOfBirth', message: 'Date of birth cannot be in the future', severity: 'error' });
    }
    // Check for unreasonable age (over 120)
    const age = now.getFullYear() - dob.getFullYear();
    if (age > 120) {
      errors.push({ field: 'dateOfBirth', message: 'Please check the date of birth', severity: 'warning' });
    }
  }

  if (!patient.sex) {
    errors.push({ field: 'sex', message: 'Sex is required', severity: 'error' });
  }

  if (!patient.islandId) {
    errors.push({ field: 'islandId', message: 'Island is required', severity: 'error' });
  }

  if (!patient.villageId) {
    errors.push({ field: 'villageId', message: 'Village is required', severity: 'error' });
  }

  // Name length validation
  if (patient.firstName && patient.firstName.length > 100) {
    errors.push({ field: 'firstName', message: 'First name is too long', severity: 'error' });
  }
  if (patient.lastName && patient.lastName.length > 100) {
    errors.push({ field: 'lastName', message: 'Last name is too long', severity: 'error' });
  }

  return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
}

/**
 * Validate tooth findings
 */
export function validateToothFindings(findings: ToothFinding[]): ValidationResult {
  const errors: ValidationError[] = [];

  // Check for duplicates
  const duplicates = checkDuplicateTeeth(findings);
  if (duplicates.length > 0) {
    errors.push({
      field: 'toothFindings',
      message: `Duplicate entries for teeth: ${duplicates.join(', ')}`,
      severity: 'error',
    });
  }

  // Validate each finding
  for (const f of findings) {
    if (!isValidToothCode(f.toothCode, f.dentition)) {
      errors.push({
        field: 'toothFindings',
        message: `Invalid tooth code: ${f.toothCode}`,
        severity: 'error',
      });
    }
  }

  // Check all permanent teeth are accounted for
  const permanentCodes = findings
    .filter(f => f.dentition === 'permanent')
    .map(f => f.toothCode);
  const missingPermanent = PERMANENT_TEETH.filter(t => !permanentCodes.includes(t));
  if (missingPermanent.length > 0) {
    errors.push({
      field: 'toothFindings',
      message: `${missingPermanent.length} permanent teeth not recorded`,
      severity: 'warning',
    });
  }

  return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
}

/**
 * Validate PUFA findings
 */
export function validatePUFA(pufaFindings: PUFATooth[]): ValidationResult {
  const errors: ValidationError[] = [];

  for (const pf of pufaFindings) {
    if (!isValidToothCode(pf.toothCode, pf.dentition)) {
      errors.push({
        field: 'puFindings',
        message: `Invalid tooth code in PUFA: ${pf.toothCode}`,
        severity: 'error',
      });
    }

    // PUFA should only be recorded for decayed teeth
    // This is a warning, not error, as the tooth status is validated elsewhere
    if (!pf.P && !pf.U && !pf.F && !pf.A) {
      errors.push({
        field: 'puFindings',
        message: `PUFA record for tooth ${pf.toothCode} has no indicators selected`,
        severity: 'warning',
      });
    }
  }

  return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
}

/**
 * Validate periodontal findings
 */
export function validatePeriodontal(findings: PeriodontalFinding[]): ValidationResult {
  const errors: ValidationError[] = [];
  const sextants = new Set<number>();

  for (const f of findings) {
    if (sextants.has(f.sextant)) {
      errors.push({
        field: 'periodontal',
        message: `Duplicate entry for sextant ${f.sextant}`,
        severity: 'error',
      });
    }
    sextants.add(f.sextant);

    if (f.sextant < 1 || f.sextant > 6) {
      errors.push({
        field: 'periodontal',
        message: `Invalid sextant: ${f.sextant}`,
        severity: 'error',
      });
    }

    const validCodes = [0, 1, 2, 3, 4, 'X', '9'];
    if (!validCodes.includes(f.code)) {
      errors.push({
        field: 'periodontal',
        message: `Invalid CPITN code for sextant ${f.sextant}`,
        severity: 'error',
      });
    }
  }

  return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
}

/**
 * Validate risk factors
 */
export function validateRiskFactors(risk: RiskFactors): ValidationResult {
  const errors: ValidationError[] = [];

  if (!risk.tobacco?.status) {
    errors.push({ field: 'riskFactors.tobacco', message: 'Tobacco use status is required', severity: 'error' });
  }

  if (!risk.arecaBetel?.status) {
    errors.push({ field: 'riskFactors.arecaBetel', message: 'Areca/betel use status is required', severity: 'error' });
  }

  if (!risk.alcohol?.status) {
    errors.push({ field: 'riskFactors.alcohol', message: 'Alcohol use status is required', severity: 'error' });
  }

  if (!risk.familyCancer?.present) {
    errors.push({ field: 'riskFactors.familyCancer', message: 'Family cancer history is required', severity: 'error' });
  }

  return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
}

/**
 * Validate oral mucosal screening
 */
export function validateOralMucosal(screening: OralMucosalScreening): ValidationResult {
  const errors: ValidationError[] = [];

  if (screening.abnormalityPresent === undefined || screening.abnormalityPresent === null) {
    errors.push({
      field: 'oralMucosal',
      message: 'Oral mucosal examination result is required',
      severity: 'error',
    });
  }

  if (screening.abnormalityPresent) {
    if (!screening.lesionSite) {
      errors.push({
        field: 'oralMucosal.lesionSite',
        message: 'Lesion site is required when abnormality is present',
        severity: 'error',
      });
    }
  }

  return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
}

/**
 * Validate photo before upload
 */
export function validatePhoto(file: File | Blob): ValidationResult {
  const errors: ValidationError[] = [];

  if (file.size > APP_CONFIG.maxPhotoSizeBytes) {
    errors.push({
      field: 'photo',
      message: `Image is too large. Maximum size is ${Math.round(APP_CONFIG.maxPhotoSizeBytes / 1024 / 1024)}MB`,
      severity: 'error',
    });
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/webp', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    errors.push({
      field: 'photo',
      message: 'Only JPEG, WebP, or PNG images are accepted',
      severity: 'error',
    });
  }

  if (file.size === 0) {
    errors.push({
      field: 'photo',
      message: 'Image file is empty',
      severity: 'error',
    });
  }

  return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
}

/**
 * Validate complete screening before submission
 */
export function validateScreeningSubmission(screening: Partial<Screening>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!screening.patientId) {
    errors.push({ field: 'patient', message: 'Patient is required', severity: 'error' });
  }

  if (!screening.eventId) {
    errors.push({ field: 'event', message: 'Event is required', severity: 'error' });
  }

  if (!screening.dateOfScreening) {
    errors.push({ field: 'dateOfScreening', message: 'Screening date is required', severity: 'error' });
  }

  // Validate tooth findings exist
  if (!screening.toothFindings || screening.toothFindings.length === 0) {
    errors.push({ field: 'toothFindings', message: 'Tooth findings are required', severity: 'error' });
  } else {
    const toothResult = validateToothFindings(screening.toothFindings);
    errors.push(...toothResult.errors);
  }

  // Validate periodontal
  if (screening.periodontalFindings) {
    const perResult = validatePeriodontal(screening.periodontalFindings);
    errors.push(...perResult.errors);
  }

  // Validate oral mucosal
  if (screening.oralMucosalScreening) {
    const mucResult = validateOralMucosal(screening.oralMucosalScreening);
    errors.push(...mucResult.errors);
  }

  // Validate risk factors
  if (screening.riskFactors) {
    const riskResult = validateRiskFactors(screening.riskFactors);
    errors.push(...riskResult.errors);
  }

  return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
}
