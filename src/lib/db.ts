// MHMS Oral Screening - IndexedDB Offline Storage
// Handles offline-first data persistence and sync queue

import type { SyncQueueItem, SyncStatus, Patient, Screening, PhotoRecord, Referral } from './types';

const DB_NAME = 'mhms_oral_screening';
const DB_VERSION = 1;

// Store names
const STORES = {
  PATIENTS: 'patients',
  SCREENINGS: 'screenings',
  PHOTOS: 'photos',
  REFERRALS: 'referrals',
  SYNC_QUEUE: 'sync_queue',
  REFERENCE_DATA: 'reference_data',
} as const;

let dbInstance: IDBDatabase | null = null;

/**
 * Open the IndexedDB database
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open database'));

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Patients store
      if (!db.objectStoreNames.contains(STORES.PATIENTS)) {
        const patientStore = db.createObjectStore(STORES.PATIENTS, { keyPath: 'clientSubmissionId' });
        patientStore.createIndex('patientId', 'patientId', { unique: true });
        patientStore.createIndex('lastName', 'lastName', { unique: false });
      }

      // Screenings store
      if (!db.objectStoreNames.contains(STORES.SCREENINGS)) {
        const screeningStore = db.createObjectStore(STORES.SCREENINGS, { keyPath: 'clientSubmissionId' });
        screeningStore.createIndex('screeningId', 'screeningId', { unique: true });
        screeningStore.createIndex('patientId', 'patientId', { unique: false });
        screeningStore.createIndex('status', 'status', { unique: false });
      }

      // Photos store
      if (!db.objectStoreNames.contains(STORES.PHOTOS)) {
        const photoStore = db.createObjectStore(STORES.PHOTOS, { keyPath: 'clientSubmissionId' });
        photoStore.createIndex('photoId', 'photoId', { unique: true });
        photoStore.createIndex('screeningId', 'screeningId', { unique: false });
      }

      // Referrals store
      if (!db.objectStoreNames.contains(STORES.REFERRALS)) {
        const referralStore = db.createObjectStore(STORES.REFERRALS, { keyPath: 'clientSubmissionId' });
        referralStore.createIndex('referralId', 'referralId', { unique: true });
        referralStore.createIndex('screeningId', 'screeningId', { unique: false });
      }

      // Sync queue
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'localId' });
        queueStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        queueStore.createIndex('clientSubmissionId', 'clientSubmissionId', { unique: true });
        queueStore.createIndex('type', 'type', { unique: false });
      }

      // Reference data (islands, villages, events, users)
      if (!db.objectStoreNames.contains(STORES.REFERENCE_DATA)) {
        db.createObjectStore(STORES.REFERENCE_DATA, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Save a record to the local database
 */
export async function saveLocal<T extends { clientSubmissionId: string }>(
  storeName: string,
  record: T
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to save to ${storeName}`));
  });
}

/**
 * Get a record from local database by clientSubmissionId
 */
export async function getLocal<T>(storeName: string, clientSubmissionId: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(clientSubmissionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error(`Failed to get from ${storeName}`));
  });
}

/**
 * Get all records from a store
 */
export async function getAllLocal<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(`Failed to get all from ${storeName}`));
  });
}

/**
 * Get records by index value
 */
export async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: string
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(`Failed to query index ${indexName}`));
  });
}

/**
 * Delete a record from local database
 * CRITICAL: Only call this AFTER server confirms successful sync
 */
export async function deleteLocal(storeName: string, clientSubmissionId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(clientSubmissionId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to delete from ${storeName}`));
  });
}

// ============================================================
// SYNC QUEUE OPERATIONS
// ============================================================

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to add to sync queue'));
  });
}

/**
 * Get all pending sync items
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('syncStatus');
    const statuses: SyncStatus[] = ['saved_local', 'sync_failed'];
    const results: SyncQueueItem[] = [];

    let completed = 0;
    for (const status of statuses) {
      const request = index.getAll(status);
      request.onsuccess = () => {
        results.push(...(request.result || []));
        completed++;
        if (completed === statuses.length) {
          resolve(results);
        }
      };
      request.onerror = () => {
        completed++;
        if (completed === statuses.length) {
          resolve(results);
        }
      };
    }
  });
}

/**
 * Update sync queue item status
 */
export async function updateSyncStatus(
  localId: string,
  status: SyncStatus,
  error?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const getRequest = store.get(localId);

    getRequest.onsuccess = () => {
      const item = getRequest.result as SyncQueueItem;
      if (!item) {
        resolve();
        return;
      }
      item.syncStatus = status;
      item.updatedAt = new Date().toISOString();
      if (status === 'sync_failed') {
        item.retryCount++;
        item.lastError = error || 'Unknown error';
      }
      if (status === 'syncing') {
        // Don't increment retry count for syncing
      }
      const putRequest = store.put(item);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error('Failed to update sync status'));
    };
    getRequest.onerror = () => reject(new Error('Failed to get sync item'));
  });
}

/**
 * Remove item from sync queue (only after confirmed sync)
 */
export async function removeFromSyncQueue(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const request = store.delete(localId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to remove from sync queue'));
  });
}

// ============================================================
// REFERENCE DATA
// ============================================================

/**
 * Save reference data (islands, villages, events, users)
 */
export async function saveReferenceData(key: string, data: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.REFERENCE_DATA, 'readwrite');
    const store = tx.objectStore(STORES.REFERENCE_DATA);
    const request = store.put({ key, data, updatedAt: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to save reference data'));
  });
}

/**
 * Get reference data
 */
export async function getReferenceData<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.REFERENCE_DATA, 'readonly');
    const store = tx.objectStore(STORES.REFERENCE_DATA);
    const request = store.get(key);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.data as T);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(new Error('Failed to get reference data'));
  });
}

// ============================================================
// EVENT OPERATIONS
// ============================================================

import type { ScreeningEvent } from './types';

const EVENTS_KEY = 'screening_events';

/**
 * Initialize events with default if none exist
 */
export async function initializeEvents(): Promise<void> {
  const events = await getAllEventsWithArchived();
  if (events.length === 0) {
    // Seed with default event
    const defaultEvent: ScreeningEvent = {
      eventId: 'EVT-DEFAULT',
      name: 'General Screening',
      date: '',
      location: '',
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    };
    await saveEvent(defaultEvent);
  }
}

/**
 * Get all events (optionally filter by active status)
 */
export async function getAllEvents(includeArchived: boolean = false): Promise<ScreeningEvent[]> {
  const events = await getReferenceData<ScreeningEvent[]>(EVENTS_KEY);
  if (!events) return [];
  if (includeArchived) return events;
  return events.filter(e => e.active);
}

/**
 * Get all events including archived
 */
export async function getAllEventsWithArchived(): Promise<ScreeningEvent[]> {
  const events = await getReferenceData<ScreeningEvent[]>(EVENTS_KEY);
  return events || [];
}

/**
 * Save an event (create or update)
 */
export async function saveEvent(event: ScreeningEvent): Promise<void> {
  const events = await getAllEventsWithArchived();
  const existingIndex = events.findIndex(e => e.eventId === event.eventId);

  if (existingIndex >= 0) {
    events[existingIndex] = event;
  } else {
    events.push(event);
  }

  await saveReferenceData(EVENTS_KEY, events);
}

/**
 * Archive an event (soft delete - hides from active list)
 */
export async function archiveEvent(eventId: string, archivedBy: string): Promise<void> {
  const events = await getAllEventsWithArchived();
  const event = events.find(e => e.eventId === eventId);

  if (event) {
    event.active = false;
    event.archivedAt = new Date().toISOString();
    event.archivedBy = archivedBy;
    await saveReferenceData(EVENTS_KEY, events);
  }
}

/**
 * Unarchive an event (restore to active)
 */
export async function unarchiveEvent(eventId: string): Promise<void> {
  const events = await getAllEventsWithArchived();
  const event = events.find(e => e.eventId === eventId);

  if (event) {
    event.active = true;
    event.archivedAt = undefined;
    event.archivedBy = undefined;
    await saveReferenceData(EVENTS_KEY, events);
  }
}

/**
 * Delete an event permanently
 * Only safe if no screenings reference this event
 */
export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  // Check if any screenings reference this event
  const screenings = await getAllScreenings();
  const hasScreenings = screenings.some(s => s.eventId === eventId);

  if (hasScreenings) {
    return {
      success: false,
      error: 'Cannot delete event: screenings are associated with this event. Archive it instead.'
    };
  }

  // Safe to delete
  const events = await getAllEventsWithArchived();
  const filtered = events.filter(e => e.eventId !== eventId);
  await saveReferenceData(EVENTS_KEY, filtered);

  return { success: true };
}

/**
 * Generate a new event ID
 */
export function generateEventId(): string {
  return `EVT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
}

// ============================================================
// PATIENT OPERATIONS
// ============================================================

export async function savePatient(patient: Patient): Promise<void> {
  await saveLocal(STORES.PATIENTS, patient);
}

export async function getPatient(clientSubmissionId: string): Promise<Patient | null> {
  return getLocal<Patient>(STORES.PATIENTS, clientSubmissionId);
}

export async function getAllPatients(): Promise<Patient[]> {
  return getAllLocal<Patient>(STORES.PATIENTS);
}

export async function searchPatients(query: string): Promise<Patient[]> {
  const all = await getAllPatients();
  const lower = query.toLowerCase();
  return all.filter(p =>
    p.firstName.toLowerCase().includes(lower) ||
    p.lastName.toLowerCase().includes(lower) ||
    p.patientId.toLowerCase().includes(lower)
  );
}

// ============================================================
// SCREENING OPERATIONS
// ============================================================

export async function saveScreening(screening: Screening): Promise<void> {
  await saveLocal(STORES.SCREENINGS, screening);
}

export async function getScreening(clientSubmissionId: string): Promise<Screening | null> {
  return getLocal<Screening>(STORES.SCREENINGS, clientSubmissionId);
}

export async function getScreeningsByPatient(patientId: string): Promise<Screening[]> {
  return getByIndex<Screening>(STORES.SCREENINGS, 'patientId', patientId);
}

export async function getAllScreenings(): Promise<Screening[]> {
  return getAllLocal<Screening>(STORES.SCREENINGS);
}

// ============================================================
// PHOTO OPERATIONS
// ============================================================

export async function savePhoto(photo: PhotoRecord): Promise<void> {
  await saveLocal(STORES.PHOTOS, photo);
}

export async function getPhotosByScreening(screeningId: string): Promise<PhotoRecord[]> {
  return getByIndex<PhotoRecord>(STORES.PHOTOS, 'screeningId', screeningId);
}

// ============================================================
// REFERRAL OPERATIONS
// ============================================================

export async function saveReferral(referral: Referral): Promise<void> {
  await saveLocal(STORES.REFERRALS, referral);
}

export async function getReferralsByScreening(screeningId: string): Promise<Referral[]> {
  return getByIndex<Referral>(STORES.REFERRALS, 'screeningId', screeningId);
}

// ============================================================
// SYNC ENGINE
// ============================================================

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 30000; // 30 seconds

/**
 * Get the Apps Script web app URL from configuration
 */
function getBackendUrl(): string {
  // This should be configured during deployment
  // For now, return empty to indicate not configured
  return localStorage.getItem('mhms_backend_url') || '';
}

/**
 * Sync a single item to the backend
 */
async function syncItem(item: SyncQueueItem): Promise<boolean> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    await updateSyncStatus(item.localId, 'sync_failed', 'Backend URL not configured');
    return false;
  }

  await updateSyncStatus(item.localId, 'syncing');

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain
      body: JSON.stringify({
        action: `sync_${item.type}`,
        clientSubmissionId: item.clientSubmissionId,
        payload: item.payload,
        payloadVersion: item.payloadVersion,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Server confirmed - safe to remove from queue
      await removeFromSyncQueue(item.localId);
      // Update the local record status to synced
      if (item.type === 'screening') {
        const screening = await getScreening(item.clientSubmissionId);
        if (screening) {
          screening.status = 'synced';
          screening.screeningId = result.screeningId || screening.screeningId;
          await saveScreening(screening);
        }
      } else if (item.type === 'patient') {
        const patient = await getPatient(item.clientSubmissionId);
        if (patient) {
          patient.patientId = result.patientId || patient.patientId;
          await savePatient(patient);
        }
      }
      return true;
    } else {
      throw new Error(result.error || 'Server rejected submission');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    if (item.retryCount >= MAX_RETRIES) {
      await updateSyncStatus(item.localId, 'sync_failed', errorMsg);
    } else {
      await updateSyncStatus(item.localId, 'sync_failed', errorMsg);
    }
    return false;
  }
}

/**
 * Process all pending sync items
 */
export async function processSyncQueue(
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const pending = await getPendingSyncItems();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    if (item.retryCount >= MAX_RETRIES) {
      failed++;
      continue;
    }
    const result = await syncItem(item);
    if (result) {
      success++;
    } else {
      failed++;
    }
    if (onProgress) {
      onProgress(i + 1, pending.length);
    }
  }

  return { success, failed };
}

/**
 * Check if online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get sync status summary
 */
export async function getSyncSummary(): Promise<{
  pending: number;
  syncing: number;
  failed: number;
  total: number;
}> {
  const all = await getAllLocal<SyncQueueItem>(STORES.SYNC_QUEUE);
  return {
    pending: all.filter(i => i.syncStatus === 'saved_local').length,
    syncing: all.filter(i => i.syncStatus === 'syncing').length,
    failed: all.filter(i => i.syncStatus === 'sync_failed').length,
    total: all.length,
  };
}
