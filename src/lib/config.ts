// MHMS Oral Screening - Configuration
// Reference data for Kiribati geographic hierarchy and application settings

import type { Island, Village } from './types';

// ============================================================
// KIRIBATI GEOGRAPHIC DATA
// ============================================================
// Based on Kiribati island groups. Village data should be maintained
// by MHMS administrators. This is a starter set.
// CONFIGURATION REQUIRED: Complete village lists need MHMS input

export const ISLANDS: Island[] = [
  // Gilbert Islands
  { islandId: 'KIR-TW', name: 'Tarawa' },
  { islandId: 'KIR-AB', name: 'Abaiang' },
  { islandId: 'KIR-AM', name: 'Amau' },
  { islandId: 'KIR-AN', name: 'Anaura' },
  { islandId: 'KIR-AR', name: 'Aranuka' },
  { islandId: 'KIR-BO', name: 'Beru' },
  { islandId: 'KIR-BT', name: 'Butaritari' },
  { islandId: 'KIR-KU', name: 'Kuria' },
  { islandId: 'KIR-MI', name: 'Maiana' },
  { islandId: 'KIR-MN', name: 'Manea' },
  { islandId: 'KIR-MK', name: 'Makin' },
  { islandId: 'KIR-MR', name: 'Marakei' },
  { islandId: 'KIR-NI', name: 'Nikunau' },
  { islandId: 'KIR-NO', name: 'Nonouti' },
  { islandId: 'KIR-ON', name: 'Onotoa' },
  { islandId: 'KIR-TM', name: 'Tamana' },
  { islandId: 'KIR-AB2', name: 'Abemama' },
  // Line Islands
  { islandId: 'KIR-CE', name: 'Christmas Island (Kiritimati)' },
  { islandId: 'KIR-FL', name: 'Flint Island' },
  { islandId: 'KIR-WA', name: 'Washington Island (Teraina)' },
  // Phoenix Islands
  { islandId: 'KIR-CA', name: 'Canton (Kanton)' },
];

// Villages by island - starter data, CONFIGURATION REQUIRED
export const VILLAGES: Village[] = [
  // Tarawa (South Tarawa - most populated)
  { villageId: 'VIL-BT', islandId: 'KIR-TW', name: 'Betio' },
  { villageId: 'VIL-BK', islandId: 'KIR-TW', name: 'Bikenibeu' },
  { villageId: 'VIL-TE', islandId: 'KIR-TW', name: 'Teaoraereke' },
  { villageId: 'VIL-BA', islandId: 'KIR-TW', name: 'Bairiki' },
  { villageId: 'VIL-BO', islandId: 'KIR-TW', name: 'Bonriki' },
  { villageId: 'VIL-EW', islandId: 'KIR-TW', name: 'Eita' },
  { villageId: 'VIL-AM', islandId: 'KIR-TW', name: 'Ammama' },
  { villageId: 'VIL-TB', islandId: 'KIR-TW', name: 'Tabonibara' },
  { villageId: 'VIL-NA', islandId: 'KIR-TW', name: 'Nawerewere' },
  // Christmas Island
  { villageId: 'VIL-LN', islandId: 'KIR-CE', name: 'London' },
  { villageId: 'VIL-PB', islandId: 'KIR-CE', name: 'Poland' },
  { villageId: 'VIL-WA', islandId: 'KIR-CE', name: 'Wales' },
  // Butaritari
  { villageId: 'VIL-UM', islandId: 'KIR-BT', name: 'Ukiangang' },
  { villageId: 'VIL-TK', islandId: 'KIR-BT', name: 'Tanimaiaki' },
  // Abaiang
  { villageId: 'VIL-TU', islandId: 'KIR-AB', name: 'Tubou' },
  { villageId: 'VIL-BU', islandId: 'KIR-AB', name: 'Buota' },
  // Add more as needed - administrators can update via admin panel
];

/**
 * Get villages for a given island
 */
export function getVillagesForIsland(islandId: string): Village[] {
  return VILLAGES.filter(v => v.islandId === islandId);
}

// ============================================================
// APPLICATION CONFIGURATION
// ============================================================

export const APP_CONFIG = {
  // Backend URL - set during deployment
  // This is PUBLIC (frontend is on GitHub Pages)
  // No secrets should be stored here
  backendUrl: '',

  // Photo limits
  maxPhotoSizeBytes: 5 * 1024 * 1024, // 5MB before compression
  targetPhotoWidth: 1200,
  targetPhotoQuality: 0.8,
  maxPhotosPerScreening: 10,

  // Sync settings
  maxSyncRetries: 5,
  syncRetryDelayMs: 30000,
  autoSyncIntervalMs: 60000, // Check every 60 seconds

  // Request limits
  maxRequestSizeBytes: 10 * 1024 * 1024, // 10MB

  // Clinical configuration (REQUIRES MHMS APPROVAL)
  ageThresholdForM: 10, // Age below which missing permanent teeth are not counted as M

  // Referral criteria (REQUIRES MHMS CLINICAL APPROVAL)
  // These are provisional - must be reviewed by MHMS dental team
  referralCriteria: {
    oralMucosal: {
      description: 'Configurable criteria for oral mucosal lesion referral',
      criteria: [
        'Lesion present for more than 2 weeks',
        'Unexplained ulceration',
        'Red or white patch (erythroplakia/leukoplakia)',
        'Unexplained swelling or lump',
        'Unexplained numbness',
        'Difficulty swallowing',
        'Fixed mass in neck',
      ],
      // Note: These criteria require MHMS clinical approval
      requiresApproval: true,
    },
    periodontal: {
      description: 'Configurable criteria for periodontal referral',
      criteria: [
        'CPITN code 4 (deep pocket 6mm+) in any sextant',
        'Multiple sextants with CPITN code 3',
      ],
      requiresApproval: true,
    },
    caries: {
      description: 'Configurable criteria for caries referral',
      criteria: [
        'Severe early childhood caries',
        'Multiple decayed teeth requiring urgent treatment',
        'Pulpal involvement (PUFA P component)',
        'Abscess or fistula present',
      ],
      requiresApproval: true,
    },
  },
};

// ============================================================
// USER ROLES
// ============================================================

export const ROLES = {
  SCREENER: {
    label: 'Screener',
    permissions: [
      'create_patient',
      'search_patient',
      'create_screening',
      'capture_photo',
      'create_referral',
    ],
  },
  SUPERVISOR: {
    label: 'Supervisor',
    permissions: [
      'create_patient',
      'search_patient',
      'create_screening',
      'capture_photo',
      'create_referral',
      'review_screening',
      'review_referral',
      'review_photos',
      'correct_records',
    ],
  },
  ADMIN: {
    label: 'Administrator',
    permissions: [
      'create_patient',
      'search_patient',
      'create_screening',
      'capture_photo',
      'create_referral',
      'review_screening',
      'review_referral',
      'review_photos',
      'correct_records',
      'manage_users',
      'manage_islands',
      'manage_villages',
      'manage_events',
      'view_reports',
    ],
  },
} as const;

// ============================================================
// DEFAULT EVENTS
// ============================================================
// Events are now managed in IndexedDB via db.ts
// A default "General Screening" event is seeded on first load
// See: initializeEvents() in db.ts
