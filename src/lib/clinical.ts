// MHMS Oral Screening - WHO 5th Edition Clinical Calculations
// Reference: WHO Oral Health Surveys: Basic Methods, 5th edition
//
// IMPORTANT: These calculations follow WHO 5th edition methodology.
// Key distinctions:
// - Permanent: D, M (age-dependent), F components
// - Primary: d, e (extracted due to caries), f components
// - Missing teeth interpretation depends on age for permanent dentition
// - Under age 10: missing permanent teeth should NOT be counted as M
//   (primary teeth are still being shed, permanent teeth may not have erupted)
// - Age 10+: missing permanent teeth can be counted as M (due to caries)
//   unless there is evidence of other reason

import type {
  ToothFinding,
  PermanentToothStatus,
  PrimaryToothStatus,
  PUFATooth,
  DMFTResult,
  PeriodontalFinding,
  Sextant,
  CPITNCode,
} from './types';

// All 32 permanent tooth codes
export const PERMANENT_TEETH: string[] = [
  '11', '12', '13', '14', '15', '16', '17', '18',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '31', '32', '33', '34', '35', '36', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48',
];

// All 20 primary tooth codes
export const PRIMARY_TEETH: string[] = [
  '51', '52', '53', '54', '55',
  '61', '62', '63', '64', '65',
  '71', '72', '73', '74', '75',
  '81', '82', '83', '84', '85',
];

// Age threshold for counting missing permanent teeth as M
// WHO 5th edition: below age 10, missing permanent teeth generally
// should not be attributed to caries as primary teeth are being exfoliated
// and permanent teeth may not have erupted yet.
// THIS IS CONFIGURABLE - requires MHMS clinical approval
export const AGE_THRESHOLD_FOR_M: number = 10;

/**
 * Calculate age from date of birth to screening date
 */
export function calculateAge(dateOfBirth: string, screeningDate: string): number {
  const dob = new Date(dateOfBirth);
  const screen = new Date(screeningDate);
  let age = screen.getFullYear() - dob.getFullYear();
  const monthDiff = screen.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && screen.getDate() < dob.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Calculate DMFT for permanent dentition per WHO 5th edition
 *
 * D = Decayed (decayed + filled_with_decay)
 * M = Missing due to caries (age-dependent: only if age >= threshold)
 * F = Filled (filled without decay)
 *
 * Teeth with status 'excluded', 'not_recorded', or 'missing_other' are NOT
 * counted in any component.
 */
export function calculateDMFT(
  findings: ToothFinding[],
  patientAge: number
): DMFTResult {
  let D = 0;
  let M = 0;
  let F = 0;
  let teeth = 0;

  const permanentFindings = findings.filter(f => f.dentition === 'permanent');

  for (const finding of permanentFindings) {
    const status = finding.status as PermanentToothStatus;

    // Skip excluded and not recorded
    if (status === 'excluded' || status === 'not_recorded') {
      continue;
    }

    teeth++;

    switch (status) {
      case 'decayed':
      case 'filled_decay':
        // Both count as D component
        D++;
        break;
      case 'missing_caries':
        // Age-dependent: only count as M if patient is old enough
        if (patientAge >= AGE_THRESHOLD_FOR_M) {
          M++;
        }
        // If under threshold, this tooth is not counted in DMFT
        // (it may be a primary tooth that was lost, or permanent tooth not yet erupted)
        // Per WHO 5th: do not count as M for young children
        break;
      case 'missing_other':
        // Not counted in any component (missing for other reason)
        // But the tooth was examined, so it counts toward teeth examined
        break;
      case 'filled':
        F++;
        break;
      case 'sound':
        // No component
        break;
    }
  }

  return {
    D,
    M,
    F,
    T: D + M + F,
    teeth,
  };
}

/**
 * Calculate dmft for primary dentition per WHO 5th edition
 *
 * d = Decayed (decayed + filled_with_decay)
 * e = Extracted due to caries (specific to primary dentition in WHO)
 * f = Filled (filled without decay)
 *
 * Note: In WHO 5th edition, the primary dentition uses lowercase letters
 * and includes 'e' for extracted due to caries.
 */
export function calculatedmft(findings: ToothFinding[]): DMFTResult {
  let D = 0; // d component (decayed)
  let M = 0; // e component (extracted/missing due to caries)
  let F = 0; // f component (filled)
  let teeth = 0;

  const primaryFindings = findings.filter(f => f.dentition === 'primary');

  for (const finding of primaryFindings) {
    const status = finding.status as PrimaryToothStatus;

    if (status === 'excluded' || status === 'not_recorded') {
      continue;
    }

    teeth++;

    switch (status) {
      case 'decayed':
      case 'filled_decay':
        D++;
        break;
      case 'missing_caries':
      case 'extracted_caries':
        M++; // 'e' component
        break;
      case 'missing_other':
      case 'extracted_other':
        // Not counted in any component
        break;
      case 'filled':
        F++;
        break;
      case 'sound':
        break;
    }
  }

  return {
    D,
    M,
    F,
    T: D + M + F,
    teeth,
  };
}

/**
 * Validate PUFA findings for a tooth
 * Prevents impossible states
 */
export function validatePUFA(pufa: PUFATooth): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // PUFA should only be recorded for teeth with decay (D or d component)
  // If all are absent, that's valid (no PUFA indicators)
  // At least one must be present if we're recording PUFA for a tooth

  // Check for contradictory states - per WHO, these are hierarchical
  // A tooth can have multiple PUFA indicators simultaneously
  // But we validate that at least the recording makes clinical sense

  if (!pufa.P && !pufa.U && !pufa.F && !pufa.A) {
    // All absent - valid, means no PUFA indicators for this tooth
    // This shouldn't normally be recorded (only record teeth WITH PUFA)
    errors.push('PUFA recorded with all indicators absent - consider removing this record');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Calculate PUFA summary
 */
export function calculatePUFASummary(pufaFindings: PUFATooth[]): {
  P: number; U: number; F: number; A: number; total: number;
} {
  let P = 0, U = 0, F = 0, A = 0;
  for (const pf of pufaFindings) {
    if (pf.P) P++;
    if (pf.U) U++;
    if (pf.F) F++;
    if (pf.A) A++;
  }
  return { P, U, F, A, total: P + U + F + A };
}

/**
 * Validate periodontal findings
 */
export function validatePeriodontal(findings: PeriodontalFinding[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const sextants = new Set<Sextant>();

  for (const f of findings) {
    // Check for duplicate sextants
    if (sextants.has(f.sextant)) {
      errors.push(`Duplicate entry for sextant ${f.sextant}`);
    }
    sextants.add(f.sextant);

    // Validate sextant range
    if (f.sextant < 1 || f.sextant > 6) {
      errors.push(`Invalid sextant: ${f.sextant}`);
    }

    // Validate code
    const validCodes: (CPITNCode | string)[] = [0, 1, 2, 3, 4, 'X', '9'];
    if (!validCodes.includes(f.code)) {
      errors.push(`Invalid CPITN code for sextant ${f.sextant}: ${f.code}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get sextant name for display
 */
export function getSextantName(sextant: Sextant): string {
  const names: Record<Sextant, string> = {
    1: 'Upper right (17-14)',
    2: 'Upper anterior (13-23)',
    3: 'Upper left (24-27)',
    4: 'Lower left (37-34)',
    5: 'Lower anterior (33-43)',
    6: 'Lower right (44-47)',
  };
  return names[sextant];
}

/**
 * Validate tooth code is valid for its dentition
 */
export function isValidToothCode(code: string, dentition: 'permanent' | 'primary'): boolean {
  if (dentition === 'permanent') {
    return PERMANENT_TEETH.includes(code);
  }
  return PRIMARY_TEETH.includes(code);
}

/**
 * Check for duplicate tooth entries in findings
 */
export function checkDuplicateTeeth(findings: ToothFinding[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const f of findings) {
    const key = `${f.dentition}-${f.toothCode}`;
    if (seen.has(key)) {
      duplicates.push(f.toothCode);
    }
    seen.add(key);
  }

  return duplicates;
}

/**
 * Server-side recalculation validation
 * Backend must recalculate and verify before saving
 */
export function validateScreeningCalculations(
  findings: ToothFinding[],
  submittedDMFT: DMFTResult,
  patientAge: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Recalculate DMFT
  const calculated = calculateDMFT(findings, patientAge);

  if (calculated.D !== submittedDMFT.D ||
      calculated.M !== submittedDMFT.M ||
      calculated.F !== submittedDMFT.F) {
    errors.push('DMFT calculation mismatch between client and server validation');
  }

  // Check for duplicate teeth
  const dups = checkDuplicateTeeth(findings);
  if (dups.length > 0) {
    errors.push(`Duplicate tooth entries: ${dups.join(', ')}`);
  }

  // Validate all tooth codes
  for (const f of findings) {
    if (!isValidToothCode(f.toothCode, f.dentition)) {
      errors.push(`Invalid tooth code: ${f.toothCode} for ${f.dentition} dentition`);
    }
  }

  return { valid: errors.length === 0, errors };
}
