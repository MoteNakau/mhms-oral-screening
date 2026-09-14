// MHMS Oral Screening v1 - Main Application
// Kiribati Ministry of Health and Medical Services
// Community Dental Screening Application

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Patient,
  Screening,
  ToothFinding,
  PUFATooth,
  PeriodontalFinding,
  OralMucosalScreening,
  RiskFactors,
  Referral,
  SyncStatus,
  Sextant,
  CPITNCode,
  PermanentToothStatus,
  PrimaryToothStatus,
} from './lib/types';
import { calculateDMFT, calculatedmft, calculateAge, getSextantName, PERMANENT_TEETH, PRIMARY_TEETH } from './lib/clinical';
import { ISLANDS, VILLAGES, getVillagesForIsland, APP_CONFIG } from './lib/config';
import {
  generateClientSubmissionId,
  generateLocalPatientId,
  generateLocalScreeningId,
  validatePatient,
  validateScreeningSubmission,
  validatePhoto,
} from './lib/validation';
import {
  openDB,
  savePatient,
  saveScreening,
  savePhoto,
  saveReferral,
  getAllPatients,
  searchPatients,
  getPendingSyncItems,
  addToSyncQueue,
  processSyncQueue,
  isOnline,
  getSyncSummary,
  getAllScreenings,
  getAllEvents,
  initializeEvents,
} from './lib/db';
import type { ScreeningEvent } from './lib/types';
import ToothChart from './components/ToothChart';
import EventManager from './components/EventManager';

// ============================================================
// WIZARD STEPS
// ============================================================
const STEPS = [
  { id: 'event', label: 'Event', icon: '📋' },
  { id: 'patient', label: 'Patient', icon: '👤' },
  { id: 'risk', label: 'Risk Factors', icon: '⚠️' },
  { id: 'dmft', label: 'DMFT/dmft', icon: '🦷' },
  { id: 'pufa', label: 'PUFA/pufa', icon: '🔍' },
  { id: 'perio', label: 'Periodontal', icon: '📊' },
  { id: 'mucosal', label: 'Oral Mucosal', icon: '👁️' },
  { id: 'review', label: 'Review', icon: '✅' },
] as const;

type StepId = typeof STEPS[number]['id'];

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  // Navigation
  const [currentStep, setCurrentStep] = useState<StepId>('event');
  const [showMenu, setShowMenu] = useState(false);

  // Patient data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [patientForm, setPatientForm] = useState<Partial<Patient>>({
    sex: 'male',
  });

  // Event
  const [events, setEvents] = useState<ScreeningEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [showEventManager, setShowEventManager] = useState(false);

  // Screening data
  const [screeningDate, setScreeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [toothFindings, setToothFindings] = useState<ToothFinding[]>([]);
  const [puFindings, setPuFindings] = useState<PUFATooth[]>([]);
  const [periodontalFindings, setPeriodontalFindings] = useState<PeriodontalFinding[]>([]);
  const [oralMucosal, setOralMucosal] = useState<OralMucosalScreening>({
    abnormalityPresent: false,
  });
  const [riskFactors, setRiskFactors] = useState<RiskFactors>({
    tobacco: { status: 'never' },
    arecaBetel: { status: 'never' },
    alcohol: { status: 'never' },
    familyCancer: { present: 'no' },
  });

  // DMFT results
  const [dmftResult, setDmftResult] = useState({ D: 0, M: 0, F: 0, T: 0, teeth: 0 });
  const [dmftResultPrimary, setDmftResultPrimary] = useState({ D: 0, M: 0, F: 0, T: 0, teeth: 0 });

  // Referral
  const [referralNeeded, setReferralNeeded] = useState(false);
  const [referralReason, setReferralReason] = useState('');
  const [referralUrgency, setReferralUrgency] = useState<'routine' | 'urgent' | 'immediate'>('routine');

  // Confirmation
  const [confirmed, setConfirmed] = useState(false);

  // Sync status
  const [online, setOnline] = useState(isOnline());
  const [syncSummary, setSyncSummary] = useState({ pending: 0, syncing: 0, failed: 0, total: 0 });
  const [syncing, setSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Photo
  const [photos, setPhotos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ============================================================
  // INITIALIZATION
  // ============================================================
  useEffect(() => {
    openDB().then(async () => {
      await initializeEvents();
      await loadEvents();
      loadPatients();
      updateSyncSummary();
    });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function loadEvents() {
    const activeEvents = await getAllEvents(false);
    setEvents(activeEvents);
    // Auto-select first event if none selected
    if (!selectedEvent && activeEvents.length > 0) {
      setSelectedEvent(activeEvents[0].eventId);
    }
  }

  // Auto-calculate DMFT when findings change
  useEffect(() => {
    if (selectedPatient?.dateOfBirth) {
      const age = calculateAge(selectedPatient.dateOfBirth, screeningDate);
      setDmftResult(calculateDMFT(toothFindings, age));
    }
    setDmftResultPrimary(calculatedmft(toothFindings));
  }, [toothFindings, selectedPatient, screeningDate]);

  // Update sync summary periodically
  useEffect(() => {
    const interval = setInterval(updateSyncSummary, 10000);
    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // DATA OPERATIONS
  // ============================================================
  async function loadPatients() {
    const all = await getAllPatients();
    setPatients(all);
  }

  async function updateSyncSummary() {
    const summary = await getSyncSummary();
    setSyncSummary(summary);
  }

  function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.length >= 2) {
      const results = patients.filter(p =>
        p.firstName.toLowerCase().includes(query.toLowerCase()) ||
        p.lastName.toLowerCase().includes(query.toLowerCase()) ||
        p.patientId.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }

  function selectPatient(patient: Patient) {
    setSelectedPatient(patient);
    setIsNewPatient(false);
    setSearchResults([]);
    setSearchQuery('');
  }

  function handleToothClick(toothCode: string, status: PermanentToothStatus | PrimaryToothStatus) {
    const dentition = PERMANENT_TEETH.includes(toothCode) ? 'permanent' : 'primary';
    setToothFindings(prev => {
      const existing = prev.findIndex(f => f.toothCode === toothCode);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { toothCode, status, dentition };
        return updated;
      }
      return [...prev, { toothCode, status, dentition }];
    });
  }

  function handlePUFAToggle(toothCode: string, indicator: 'P' | 'U' | 'F' | 'A') {
    const dentition = PERMANENT_TEETH.includes(toothCode) ? 'permanent' : 'primary';
    setPuFindings(prev => {
      const existing = prev.findIndex(f => f.toothCode === toothCode);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], [indicator]: !updated[existing][indicator] };
        // Remove if all are false
        const item = updated[existing];
        if (!item.P && !item.U && !item.F && !item.A) {
          return updated.filter((_, i) => i !== existing);
        }
        return updated;
      }
      // New entry
      const newItem: PUFATooth = { toothCode, dentition, P: false, U: false, F: false, A: false };
      newItem[indicator] = true;
      return [...prev, newItem];
    });
  }

  function handlePeriodontalChange(sextant: Sextant, code: CPITNCode) {
    setPeriodontalFindings(prev => {
      const existing = prev.findIndex(f => f.sextant === sextant);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { sextant, code };
        return updated;
      }
      return [...prev, { sextant, code }];
    });
  }

  // ============================================================
  // SAVE & SUBMIT
  // ============================================================
  async function handleSave() {
    setSaveStatus('saving');
    try {
      // Save patient if new
      let patientId = selectedPatient?.patientId || '';
      if (isNewPatient) {
        const patientValidation = validatePatient(patientForm);
        if (!patientValidation.valid) {
          const errMap: Record<string, string> = {};
          patientValidation.errors.forEach(e => { errMap[e.field] = e.message; });
          setErrors(errMap);
          setSaveStatus('error');
          return;
        }

        const newPatient: Patient = {
          patientId: generateLocalPatientId(),
          firstName: patientForm.firstName || '',
          lastName: patientForm.lastName || '',
          dateOfBirth: patientForm.dateOfBirth || '',
          sex: patientForm.sex || 'male',
          islandId: patientForm.islandId || '',
          villageId: patientForm.villageId || '',
          phone: patientForm.phone,
          notes: patientForm.notes,
          createdAt: new Date().toISOString(),
          createdBy: 'local',
          updatedAt: new Date().toISOString(),
          updatedBy: 'local',
          version: 1,
          clientSubmissionId: generateClientSubmissionId(),
        };
        await savePatient(newPatient);
        patientId = newPatient.patientId;
        setSelectedPatient(newPatient);

        // Add to sync queue
        await addToSyncQueue({
          localId: newPatient.clientSubmissionId,
          clientSubmissionId: newPatient.clientSubmissionId,
          type: 'patient',
          payload: newPatient,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          retryCount: 0,
          syncStatus: 'saved_local',
          payloadVersion: 1,
        });
      }

      // Save screening
      const screeningId = generateLocalScreeningId();
      const clientSubmissionId = generateClientSubmissionId();
      const screening: Screening = {
        screeningId,
        patientId,
        eventId: selectedEvent,
        screenerId: 'local',
        dateOfScreening: screeningDate,
        toothFindings,
        dmftResult,
        dmftResultPrimary,
        puFindings,
        periodontalFindings,
        oralMucosalScreening: oralMucosal,
        riskFactors,
        status: 'saved_local',
        clientSubmissionId,
        createdAt: new Date().toISOString(),
        createdBy: 'local',
        updatedAt: new Date().toISOString(),
        updatedBy: 'local',
        version: 1,
        retryCount: 0,
      };
      await saveScreening(screening);

      // Add to sync queue
      await addToSyncQueue({
        localId: clientSubmissionId,
        clientSubmissionId,
        type: 'screening',
        payload: screening,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retryCount: 0,
        syncStatus: 'saved_local',
        payloadVersion: 1,
      });

      // Save referral if needed
      if (referralNeeded && referralReason) {
        const refSubmissionId = generateClientSubmissionId();
        const referral: Referral = {
          referralId: `LOCAL-REF-${Date.now().toString(36)}`,
          screeningId,
          patientId,
          reason: referralReason,
          urgency: referralUrgency,
          status: 'pending',
          createdAt: new Date().toISOString(),
          createdBy: 'local',
          clientSubmissionId: refSubmissionId,
        };
        await saveReferral(referral);
        await addToSyncQueue({
          localId: refSubmissionId,
          clientSubmissionId: refSubmissionId,
          type: 'referral',
          payload: referral,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          retryCount: 0,
          syncStatus: 'saved_local',
          payloadVersion: 1,
        });
      }

      // Save photos
      for (const photo of photos) {
        const photoSubmissionId = generateClientSubmissionId();
        const photoRecord = {
          photoId: `LOCAL-PHO-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          screeningId,
          patientId,
          timestamp: new Date().toISOString(),
          uploaderId: 'local',
          status: 'saved_local' as SyncStatus,
          clientSubmissionId: photoSubmissionId,
          localBlobUrl: URL.createObjectURL(photo),
          fileSize: photo.size,
          mimeType: photo.type,
          createdAt: new Date().toISOString(),
        };
        await savePhoto(photoRecord as any);
        await addToSyncQueue({
          localId: photoSubmissionId,
          clientSubmissionId: photoSubmissionId,
          type: 'photo',
          payload: { ...photoRecord, dataUrl: await fileToDataUrl(photo) },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          retryCount: 0,
          syncStatus: 'saved_local',
          payloadVersion: 1,
        });
      }

      setSaveStatus('saved');
      await updateSyncSummary();
      await loadPatients();
    } catch (err) {
      setSaveStatus('error');
    }
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await processSyncQueue();
      await updateSyncSummary();
    } finally {
      setSyncing(false);
    }
  }

  function resetForm() {
    setSelectedPatient(null);
    setIsNewPatient(false);
    setPatientForm({ sex: 'male' });
    setToothFindings([]);
    setPuFindings([]);
    setPeriodontalFindings([]);
    setOralMucosal({ abnormalityPresent: false });
    setRiskFactors({
      tobacco: { status: 'never' },
      arecaBetel: { status: 'never' },
      alcohol: { status: 'never' },
      familyCancer: { present: 'no' },
    });
    setReferralNeeded(false);
    setReferralReason('');
    setReferralUrgency('routine');
    setConfirmed(false);
    setPhotos([]);
    setErrors({});
    setSaveStatus('idle');
    // Reset event to first available
    setSelectedEvent(events.length > 0 ? events[0].eventId : '');
    setCurrentStep('event');
  }

  // ============================================================
  // PHOTO HANDLING
  // ============================================================
  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validatePhoto(file);
      if (!validation.valid) {
        alert(validation.errors.map(e => e.message).join('\n'));
        continue;
      }
      if (photos.length >= APP_CONFIG.maxPhotosPerScreening) {
        alert(`Maximum ${APP_CONFIG.maxPhotosPerScreening} photos per screening`);
        break;
      }
      setPhotos(prev => [...prev, file]);
    }
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const canGoNext = currentStepIndex < STEPS.length - 1;
  const canGoPrev = currentStepIndex > 0;

  function goNext() {
    if (canGoNext) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  }

  function goPrev() {
    if (canGoPrev) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0066cc] text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🦷</span>
            <div>
              <h1 className="text-sm font-bold leading-tight">MHMS Oral Screening</h1>
              <p className="text-xs opacity-80">Kiribati MoH</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Sync status indicator */}
            <button
              onClick={handleSync}
              disabled={syncing || syncSummary.pending === 0}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/20 hover:bg-white/30 disabled:opacity-50"
              title={syncSummary.pending > 0 ? `${syncSummary.pending} items to sync` : 'All synced'}
            >
              {syncing ? '⏳' : online ? '🔄' : '📴'}
              <span className="hidden sm:inline">
                {syncSummary.pending > 0 ? `${syncSummary.pending}` : 'Synced'}
              </span>
            </button>
            {/* Menu */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded hover:bg-white/20"
              aria-label="Menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Connection status bar */}
        {!online && (
          <div className="bg-yellow-500 text-yellow-900 text-xs text-center py-1 font-medium">
            📴 Offline — Data saved on this device only
          </div>
        )}
        {syncSummary.failed > 0 && (
          <div className="bg-red-500 text-white text-xs text-center py-1 font-medium">
            ⚠️ {syncSummary.failed} item(s) failed to sync — tap sync to retry
          </div>
        )}
      </header>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}>
          <div className="absolute right-2 top-14 bg-white rounded-lg shadow-xl border p-2 w-48" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { resetForm(); setShowMenu(false); }}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
            >
              🆕 New Screening
            </button>
            <button
              onClick={() => { setShowEventManager(true); setShowMenu(false); }}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
            >
              📋 Manage Events
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm disabled:opacity-50"
            >
              🔄 Sync Now
            </button>
            <hr className="my-1" />
            <div className="px-3 py-1 text-xs text-gray-500">
              Pending: {syncSummary.pending} | Failed: {syncSummary.failed}
            </div>
          </div>
        </div>
      )}

      {/* Event Manager Modal */}
      {showEventManager && (
        <EventManager
          onClose={() => {
            setShowEventManager(false);
            loadEvents(); // Refresh events after closing manager
          }}
        />
      )}

      {/* Step indicator */}
      <div className="max-w-lg mx-auto px-4 py-2">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STEPS.map((step, i) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors
                ${currentStep === step.id
                  ? 'bg-[#0066cc] text-white'
                  : i < currentStepIndex
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500'
                }`}
            >
              {step.icon} {step.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 pb-24">
        {/* STEP: Event */}
        {currentStep === 'event' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Screening Event</h2>
            <div className="card space-y-3">
              <div>
                <label className="form-label">Event</label>
                <select
                  className="form-select"
                  value={selectedEvent}
                  onChange={e => setSelectedEvent(e.target.value)}
                >
                  <option value="">Select an event...</option>
                  {events.map(event => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.name}{event.date ? ` (${event.date})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Date of Screening</label>
                <input
                  type="date"
                  className="form-input"
                  value={screeningDate}
                  onChange={e => setScreeningDate(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowEventManager(true)}
                className="btn-secondary w-full text-sm"
              >
                ⚙️ Manage Events
              </button>
            </div>
            <div className="text-xs text-gray-500">
              Select the screening event and confirm the date. Use "Manage Events" to create, archive, or delete events.
            </div>
          </div>
        )}

        {/* STEP: Patient */}
        {currentStep === 'patient' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Patient</h2>

            {!selectedPatient && !isNewPatient && (
              <div className="space-y-3">
                {/* Search */}
                <div className="card space-y-2">
                  <label className="form-label">Search Existing Patient</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Name or ID..."
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                  />
                  {searchResults.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {searchResults.map(p => (
                        <button
                          key={p.clientSubmissionId}
                          onClick={() => selectPatient(p)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        >
                          <div className="font-medium">{p.firstName} {p.lastName}</div>
                          <div className="text-xs text-gray-500">{p.patientId} • {p.dateOfBirth}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-center text-gray-500 text-sm">— or —</div>

                <button
                  onClick={() => setIsNewPatient(true)}
                  className="btn-primary w-full"
                >
                  ➕ Register New Patient
                </button>
              </div>
            )}

            {isNewPatient && (
              <div className="card space-y-3">
                <h3 className="font-semibold">New Patient Registration</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={patientForm.firstName || ''}
                      onChange={e => setPatientForm({ ...patientForm, firstName: e.target.value })}
                    />
                    {errors.firstName && <p className="text-red-600 text-xs mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={patientForm.lastName || ''}
                      onChange={e => setPatientForm({ ...patientForm, lastName: e.target.value })}
                    />
                    {errors.lastName && <p className="text-red-600 text-xs mt-1">{errors.lastName}</p>}
                  </div>
                </div>
                <div>
                  <label className="form-label">Date of Birth *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={patientForm.dateOfBirth || ''}
                    onChange={e => setPatientForm({ ...patientForm, dateOfBirth: e.target.value })}
                  />
                  {errors.dateOfBirth && <p className="text-red-600 text-xs mt-1">{errors.dateOfBirth}</p>}
                </div>
                <div>
                  <label className="form-label">Sex *</label>
                  <select
                    className="form-select"
                    value={patientForm.sex || 'male'}
                    onChange={e => setPatientForm({ ...patientForm, sex: e.target.value as any })}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Island *</label>
                  <select
                    className="form-select"
                    value={patientForm.islandId || ''}
                    onChange={e => setPatientForm({ ...patientForm, islandId: e.target.value, villageId: '' })}
                  >
                    <option value="">Select island...</option>
                    {ISLANDS.map(i => (
                      <option key={i.islandId} value={i.islandId}>{i.name}</option>
                    ))}
                  </select>
                  {errors.islandId && <p className="text-red-600 text-xs mt-1">{errors.islandId}</p>}
                </div>
                <div>
                  <label className="form-label">Village *</label>
                  <select
                    className="form-select"
                    value={patientForm.villageId || ''}
                    onChange={e => setPatientForm({ ...patientForm, villageId: e.target.value })}
                    disabled={!patientForm.islandId}
                  >
                    <option value="">Select village...</option>
                    {patientForm.islandId && getVillagesForIsland(patientForm.islandId).map(v => (
                      <option key={v.villageId} value={v.villageId}>{v.name}</option>
                    ))}
                  </select>
                  {errors.villageId && <p className="text-red-600 text-xs mt-1">{errors.villageId}</p>}
                  {patientForm.islandId && getVillagesForIsland(patientForm.islandId).length === 0 && (
                    <p className="text-yellow-600 text-xs mt-1">No villages configured for this island. Contact admin.</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Phone (optional)</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={patientForm.phone || ''}
                    onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
                  />
                </div>
                <button
                  onClick={() => { setIsNewPatient(false); setSelectedPatient({ ...patientForm, patientId: 'pending' } as Patient); }}
                  className="btn-primary w-full"
                  disabled={!patientForm.firstName || !patientForm.lastName || !patientForm.dateOfBirth || !patientForm.islandId || !patientForm.villageId}
                >
                  Continue with this patient
                </button>
              </div>
            )}

            {selectedPatient && !isNewPatient && (
              <div className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-lg">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                    <div className="text-sm text-gray-500">ID: {selectedPatient.patientId}</div>
                    <div className="text-sm text-gray-500">DOB: {selectedPatient.dateOfBirth}</div>
                    <div className="text-sm text-gray-500">Sex: {selectedPatient.sex}</div>
                  </div>
                  <button
                    onClick={() => { setSelectedPatient(null); setIsNewPatient(false); }}
                    className="text-sm text-[#0066cc] underline"
                  >
                    Change
                  </button>
                </div>
                {selectedPatient.dateOfBirth && (
                  <div className="mt-2 text-sm text-gray-600">
                    Age: {calculateAge(selectedPatient.dateOfBirth, screeningDate)} years
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP: Risk Factors */}
        {currentStep === 'risk' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Risk Factors</h2>

            {/* Tobacco */}
            <div className="card space-y-2">
              <label className="form-label">🚬 Tobacco Use</label>
              <select
                className="form-select"
                value={riskFactors.tobacco.status}
                onChange={e => setRiskFactors({ ...riskFactors, tobacco: { ...riskFactors.tobacco, status: e.target.value as any } })}
              >
                <option value="never">Never</option>
                <option value="current">Current user</option>
                <option value="former">Former user</option>
                <option value="unknown">Unknown</option>
              </select>
              {riskFactors.tobacco.status !== 'never' && (
                <div className="space-y-2 pl-2 border-l-2 border-gray-200">
                  <div>
                    <label className="text-xs text-gray-600">Type</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., smoked, chewed..."
                      value={riskFactors.tobacco.type || ''}
                      onChange={e => setRiskFactors({ ...riskFactors, tobacco: { ...riskFactors.tobacco, type: e.target.value } })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Years used</label>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        value={riskFactors.tobacco.yearsUsed || ''}
                        onChange={e => setRiskFactors({ ...riskFactors, tobacco: { ...riskFactors.tobacco, yearsUsed: parseInt(e.target.value) || undefined } })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Frequency</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., daily..."
                        value={riskFactors.tobacco.frequency || ''}
                        onChange={e => setRiskFactors({ ...riskFactors, tobacco: { ...riskFactors.tobacco, frequency: e.target.value } })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Areca/Betel */}
            <div className="card space-y-2">
              <label className="form-label">🌿 Areca / Betel Nut</label>
              <select
                className="form-select"
                value={riskFactors.arecaBetel.status}
                onChange={e => setRiskFactors({ ...riskFactors, arecaBetel: { ...riskFactors.arecaBetel, status: e.target.value as any } })}
              >
                <option value="never">Never</option>
                <option value="current">Current user</option>
                <option value="former">Former user</option>
                <option value="unknown">Unknown</option>
              </select>
              {riskFactors.arecaBetel.status !== 'never' && (
                <div className="space-y-2 pl-2 border-l-2 border-gray-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Years used</label>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        value={riskFactors.arecaBetel.yearsUsed || ''}
                        onChange={e => setRiskFactors({ ...riskFactors, arecaBetel: { ...riskFactors.arecaBetel, yearsUsed: parseInt(e.target.value) || undefined } })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Frequency</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., daily..."
                        value={riskFactors.arecaBetel.frequency || ''}
                        onChange={e => setRiskFactors({ ...riskFactors, arecaBetel: { ...riskFactors.arecaBetel, frequency: e.target.value } })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={riskFactors.arecaBetel.tobaccoMixed || false}
                      onChange={e => setRiskFactors({ ...riskFactors, arecaBetel: { ...riskFactors.arecaBetel, tobaccoMixed: e.target.checked } })}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-sm">Mixed with tobacco</span>
                  </label>
                </div>
              )}
            </div>

            {/* Alcohol */}
            <div className="card space-y-2">
              <label className="form-label">🍺 Alcohol Use</label>
              <select
                className="form-select"
                value={riskFactors.alcohol.status}
                onChange={e => setRiskFactors({ ...riskFactors, alcohol: { ...riskFactors.alcohol, status: e.target.value as any } })}
              >
                <option value="never">Never</option>
                <option value="current">Current</option>
                <option value="former">Former</option>
                <option value="unknown">Unknown</option>
              </select>
              {riskFactors.alcohol.status !== 'never' && (
                <div className="space-y-2 pl-2 border-l-2 border-gray-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Years used</label>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        value={riskFactors.alcohol.yearsUsed || ''}
                        onChange={e => setRiskFactors({ ...riskFactors, alcohol: { ...riskFactors.alcohol, yearsUsed: parseInt(e.target.value) || undefined } })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Frequency</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., weekly..."
                        value={riskFactors.alcohol.frequency || ''}
                        onChange={e => setRiskFactors({ ...riskFactors, alcohol: { ...riskFactors.alcohol, frequency: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Typical amount</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., 2-3 drinks..."
                      value={riskFactors.alcohol.typicalAmount || ''}
                      onChange={e => setRiskFactors({ ...riskFactors, alcohol: { ...riskFactors.alcohol, typicalAmount: e.target.value } })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Family Cancer History */}
            <div className="card space-y-2">
              <label className="form-label">👨‍👩‍👧 Family Cancer History</label>
              <select
                className="form-select"
                value={riskFactors.familyCancer.present}
                onChange={e => setRiskFactors({ ...riskFactors, familyCancer: { ...riskFactors.familyCancer, present: e.target.value as any } })}
              >
                <option value="no">No known family history</option>
                <option value="yes">Yes</option>
                <option value="unknown">Unknown</option>
              </select>
              {riskFactors.familyCancer.present === 'yes' && (
                <div className="space-y-2 pl-2 border-l-2 border-gray-200">
                  <div>
                    <label className="text-xs text-gray-600">Relationship</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., mother, father..."
                      value={riskFactors.familyCancer.relationship || ''}
                      onChange={e => setRiskFactors({ ...riskFactors, familyCancer: { ...riskFactors.familyCancer, relationship: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Cancer type</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., oral, throat..."
                      value={riskFactors.familyCancer.cancerType || ''}
                      onChange={e => setRiskFactors({ ...riskFactors, familyCancer: { ...riskFactors.familyCancer, cancerType: e.target.value } })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Additional */}
            <div className="card space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={riskFactors.immunosuppression || false}
                  onChange={e => setRiskFactors({ ...riskFactors, immunosuppression: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm font-medium">Immunosuppression</span>
              </label>
              {riskFactors.immunosuppression && (
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Notes..."
                  value={riskFactors.immunosuppressionNotes || ''}
                  onChange={e => setRiskFactors({ ...riskFactors, immunosuppressionNotes: e.target.value })}
                />
              )}
              <div>
                <label className="text-xs text-gray-600">Other risk factors / notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={riskFactors.otherRiskFactors || ''}
                  onChange={e => setRiskFactors({ ...riskFactors, otherRiskFactors: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP: DMFT */}
        {currentStep === 'dmft' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">DMFT / dmft</h2>
            <p className="text-xs text-gray-500">
              WHO 5th edition methodology. Tap a tooth, then select its status.
            </p>

            {/* DMFT Summary */}
            <div className="card">
              <div className="text-sm font-semibold mb-2">Permanent Dentition (DMFT)</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-red-50 rounded p-2">
                  <div className="text-lg font-bold text-red-700">{dmftResult.D}</div>
                  <div className="text-xs text-red-600">D</div>
                </div>
                <div className="bg-gray-100 rounded p-2">
                  <div className="text-lg font-bold text-gray-700">{dmftResult.M}</div>
                  <div className="text-xs text-gray-600">M</div>
                </div>
                <div className="bg-blue-50 rounded p-2">
                  <div className="text-lg font-bold text-blue-700">{dmftResult.F}</div>
                  <div className="text-xs text-blue-600">F</div>
                </div>
                <div className="bg-purple-50 rounded p-2">
                  <div className="text-lg font-bold text-purple-700">{dmftResult.T}</div>
                  <div className="text-xs text-purple-600">DMFT</div>
                </div>
              </div>
            </div>

            {/* Permanent tooth chart */}
            <ToothChart
              dentition="permanent"
              findings={toothFindings.filter(f => f.dentition === 'permanent')}
              onToothClick={handleToothClick}
            />

            {/* Primary dentition */}
            <div className="card">
              <div className="text-sm font-semibold mb-2">Primary Dentition (dmft)</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-red-50 rounded p-2">
                  <div className="text-lg font-bold text-red-700">{dmftResultPrimary.D}</div>
                  <div className="text-xs text-red-600">d</div>
                </div>
                <div className="bg-gray-100 rounded p-2">
                  <div className="text-lg font-bold text-gray-700">{dmftResultPrimary.M}</div>
                  <div className="text-xs text-gray-600">e/m</div>
                </div>
                <div className="bg-blue-50 rounded p-2">
                  <div className="text-lg font-bold text-blue-700">{dmftResultPrimary.F}</div>
                  <div className="text-xs text-blue-600">f</div>
                </div>
                <div className="bg-purple-50 rounded p-2">
                  <div className="text-lg font-bold text-purple-700">{dmftResultPrimary.T}</div>
                  <div className="text-xs text-purple-600">dmft</div>
                </div>
              </div>
            </div>

            <ToothChart
              dentition="primary"
              findings={toothFindings.filter(f => f.dentition === 'primary')}
              onToothClick={handleToothClick}
            />

            {selectedPatient?.dateOfBirth && calculateAge(selectedPatient.dateOfBirth, screeningDate) < APP_CONFIG.ageThresholdForM && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                ⚠️ Patient is under {APP_CONFIG.ageThresholdForM} years. Missing permanent teeth are NOT counted as M per WHO 5th edition.
              </div>
            )}
          </div>
        )}

        {/* STEP: PUFA */}
        {currentStep === 'pufa' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">PUFA / pufa</h2>
            <p className="text-xs text-gray-500">
              Record pulp/ulcer/fistula/abscess for decayed teeth. Tap a tooth to toggle indicators.
            </p>

            {/* PUFA summary */}
            <div className="card">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-red-50 rounded p-2">
                  <div className="text-lg font-bold text-red-700">{puFindings.filter(f => f.P).length}</div>
                  <div className="text-xs text-red-600">P (Pulp)</div>
                </div>
                <div className="bg-orange-50 rounded p-2">
                  <div className="text-lg font-bold text-orange-700">{puFindings.filter(f => f.U).length}</div>
                  <div className="text-xs text-orange-600">U (Ulcer)</div>
                </div>
                <div className="bg-yellow-50 rounded p-2">
                  <div className="text-lg font-bold text-yellow-700">{puFindings.filter(f => f.F).length}</div>
                  <div className="text-xs text-yellow-600">F (Fistula)</div>
                </div>
                <div className="bg-purple-50 rounded p-2">
                  <div className="text-lg font-bold text-purple-700">{puFindings.filter(f => f.A).length}</div>
                  <div className="text-xs text-purple-600">A (Abscess)</div>
                </div>
              </div>
            </div>

            {/* Show only decayed teeth for PUFA */}
            <div className="card">
              <div className="text-sm font-semibold mb-2">Select teeth with PUFA indicators:</div>
              <div className="text-xs text-gray-500 mb-3">
                Only teeth recorded as decayed (D/d) are shown below.
              </div>
              {(() => {
                const decayedTeeth = toothFindings.filter(
                  f => f.status === 'decayed' || f.status === 'filled_decay'
                );
                if (decayedTeeth.length === 0) {
                  return <p className="text-gray-500 text-sm">No decayed teeth recorded. Return to DMFT step.</p>;
                }
                return (
                  <div className="space-y-2">
                    {decayedTeeth.map(tf => {
                      const pufa = puFindings.find(p => p.toothCode === tf.toothCode);
                      return (
                        <div key={tf.toothCode} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <span className="font-mono font-bold text-sm w-8">{tf.toothCode}</span>
                          <div className="flex gap-1 flex-1">
                            {(['P', 'U', 'F', 'A'] as const).map(indicator => (
                              <button
                                key={indicator}
                                type="button"
                                onClick={() => handlePUFAToggle(tf.toothCode, indicator)}
                                className={`px-3 py-2 rounded text-xs font-bold min-h-[44px] min-w-[44px]
                                  ${pufa?.[indicator]
                                    ? 'bg-red-500 text-white'
                                    : 'bg-white border border-gray-300 text-gray-600'
                                  }`}
                              >
                                {indicator}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* STEP: Periodontal */}
        {currentStep === 'perio' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Periodontal (CPITN)</h2>
            <p className="text-xs text-gray-500">
              Record CPITN code for each sextant. Codes: 0=Healthy, 1=Bleeding, 2=Calculus, 3=Pocket 4-5mm, 4=Pocket 6mm+, X=Excluded, 9=Not recorded
            </p>

            <div className="space-y-2">
              {([1, 2, 3, 4, 5, 6] as Sextant[]).map(sextant => {
                const finding = periodontalFindings.find(f => f.sextant === sextant);
                return (
                  <div key={sextant} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">Sextant {sextant}</div>
                        <div className="text-xs text-gray-500">{getSextantName(sextant)}</div>
                      </div>
                      <select
                        className="form-select w-32"
                        value={finding?.code ?? ''}
                        onChange={e => handlePeriodontalChange(sextant, e.target.value as CPITNCode)}
                      >
                        <option value="">Select...</option>
                        <option value="0">0 - Healthy</option>
                        <option value="1">1 - Bleeding</option>
                        <option value="2">2 - Calculus</option>
                        <option value="3">3 - Pocket 4-5mm</option>
                        <option value="4">4 - Pocket 6mm+</option>
                        <option value="X">X - Excluded</option>
                        <option value="9">9 - Not recorded</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              ℹ️ Periodontal coding requires MHMS clinical confirmation. Current implementation follows WHO CPITN methodology.
            </div>
          </div>
        )}

        {/* STEP: Oral Mucosal */}
        {currentStep === 'mucosal' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Oral Mucosal Screening</h2>

            <div className="card space-y-3">
              <label className="form-label">Abnormality Present?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOralMucosal({ ...oralMucosal, abnormalityPresent: false, lesionSite: undefined, lesionAppearance: undefined, lesionDuration: undefined, lesionSymptoms: undefined })}
                  className={`flex-1 py-3 rounded-lg font-medium text-sm border-2 min-h-[44px]
                    ${oralMucosal.abnormalityPresent === false
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : 'border-gray-200 bg-white text-gray-600'
                    }`}
                >
                  ✅ No abnormality
                </button>
                <button
                  type="button"
                  onClick={() => setOralMucosal({ ...oralMucosal, abnormalityPresent: true })}
                  className={`flex-1 py-3 rounded-lg font-medium text-sm border-2 min-h-[44px]
                    ${oralMucosal.abnormalityPresent === true
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : 'border-gray-200 bg-white text-gray-600'
                    }`}
                >
                  ⚠️ Abnormality found
                </button>
              </div>
            </div>

            {oralMucosal.abnormalityPresent && (
              <div className="card space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
                  ⚠️ Suspicious oral lesion identified — clinical assessment/referral required.
                  This is a screening finding, not a diagnosis.
                </div>

                <div>
                  <label className="form-label">Site / Location *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., lateral tongue, floor of mouth..."
                    value={oralMucosal.lesionSite || ''}
                    onChange={e => setOralMucosal({ ...oralMucosal, lesionSite: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Appearance</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., white patch, ulcer, red patch..."
                    value={oralMucosal.lesionAppearance || ''}
                    onChange={e => setOralMucosal({ ...oralMucosal, lesionAppearance: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Duration</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., 2 weeks, 3 months..."
                    value={oralMucosal.lesionDuration || ''}
                    onChange={e => setOralMucosal({ ...oralMucosal, lesionDuration: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Symptoms</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., pain, numbness, difficulty swallowing..."
                    value={oralMucosal.lesionSymptoms || ''}
                    onChange={e => setOralMucosal({ ...oralMucosal, lesionSymptoms: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Clinical Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Additional observations..."
                    value={oralMucosal.clinicalNotes || ''}
                    onChange={e => setOralMucosal({ ...oralMucosal, clinicalNotes: e.target.value })}
                  />
                </div>

                {/* Photo capture */}
                <div>
                  <label className="form-label">Clinical Photograph</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/webp,image/png"
                    capture="environment"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary w-full"
                  >
                    📷 Capture Photo
                  </button>
                  {photos.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {photos.length} photo(s) captured — will be stored securely
                    </div>
                  )}
                </div>

                {/* Referral decision */}
                <div className="border-t pt-3">
                  <label className="form-label">Referral Decision</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setReferralNeeded(true); setOralMucosal({ ...oralMucosal, referralDecision: 'refer' }); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 min-h-[44px]
                        ${referralNeeded ? 'border-red-500 bg-red-50 text-red-800' : 'border-gray-200'}`}
                    >
                      Refer
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReferralNeeded(false); setOralMucosal({ ...oralMucosal, referralDecision: 'monitor' }); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 min-h-[44px]
                        ${!referralNeeded ? 'border-yellow-500 bg-yellow-50 text-yellow-800' : 'border-gray-200'}`}
                    >
                      Monitor
                    </button>
                  </div>
                </div>

                {referralNeeded && (
                  <div className="space-y-2 pl-2 border-l-2 border-red-200">
                    <div>
                      <label className="text-xs text-gray-600">Urgency</label>
                      <select
                        className="form-select"
                        value={referralUrgency}
                        onChange={e => setReferralUrgency(e.target.value as any)}
                      >
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="immediate">Immediate</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Reason for referral</label>
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="Describe reason..."
                        value={referralReason}
                        onChange={e => setReferralReason(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {!oralMucosal.abnormalityPresent && (
              <div className="card bg-green-50 border-green-200">
                <p className="text-sm text-green-800">
                  ✅ No oral mucosal abnormality detected during screening.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP: Review */}
        {currentStep === 'review' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Review & Submit</h2>

            {/* Patient summary */}
            <div className="card">
              <div className="text-sm font-semibold mb-1">Patient</div>
              {selectedPatient ? (
                <div className="text-sm">
                  {selectedPatient.firstName} {selectedPatient.lastName} • {selectedPatient.sex}
                  {selectedPatient.dateOfBirth && ` • Age: ${calculateAge(selectedPatient.dateOfBirth, screeningDate)}`}
                </div>
              ) : (
                <div className="text-sm text-red-600">No patient selected</div>
              )}
            </div>

            {/* Clinical summary */}
            <div className="card">
              <div className="text-sm font-semibold mb-2">Clinical Summary</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>DMFT: <strong>{dmftResult.T}</strong> (D:{dmftResult.D} M:{dmftResult.M} F:{dmftResult.F})</div>
                <div>dmft: <strong>{dmftResultPrimary.T}</strong> (d:{dmftResultPrimary.D} e:{dmftResultPrimary.M} f:{dmftResultPrimary.F})</div>
                <div>PUFA teeth: <strong>{puFindings.length}</strong></div>
                <div>Perio sextants: <strong>{periodontalFindings.length}/6</strong></div>
              </div>
              <div className="mt-2 text-sm">
                Oral mucosal: {oralMucosal.abnormalityPresent ? '⚠️ Abnormality found' : '✅ Normal'}
              </div>
              {oralMucosal.abnormalityPresent && oralMucosal.lesionSite && (
                <div className="text-xs text-gray-600 mt-1">Site: {oralMucosal.lesionSite}</div>
              )}
            </div>

            {/* Risk summary */}
            <div className="card">
              <div className="text-sm font-semibold mb-1">Risk Factors</div>
              <div className="text-sm space-y-1">
                <div>Tobacco: {riskFactors.tobacco.status}</div>
                <div>Areca/Betel: {riskFactors.arecaBetel.status}</div>
                <div>Alcohol: {riskFactors.alcohol.status}</div>
                <div>Family cancer: {riskFactors.familyCancer.present}</div>
              </div>
            </div>

            {/* Referral */}
            {referralNeeded && (
              <div className="card bg-red-50 border-red-200">
                <div className="text-sm font-semibold text-red-800 mb-1">⚠️ Referral Created</div>
                <div className="text-sm text-red-700">Urgency: {referralUrgency}</div>
                {referralReason && <div className="text-sm text-red-700 mt-1">Reason: {referralReason}</div>}
              </div>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <div className="card">
                <div className="text-sm font-semibold mb-1">Photos: {photos.length}</div>
                <div className="text-xs text-gray-500">Photos will be stored securely in private Google Drive.</div>
              </div>
            )}

            {/* Confirmation */}
            <div className="card bg-gray-50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded"
                />
                <span className="text-sm">
                  I confirm that the screening information has been reviewed and is accurate.
                </span>
              </label>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!confirmed || !selectedPatient}
              className="btn-primary w-full text-lg"
            >
              {saveStatus === 'saving' ? '⏳ Saving...' :
               saveStatus === 'saved' ? '✅ Saved on Device' :
               saveStatus === 'error' ? '❌ Error — Try Again' :
               '💾 Save Screening'}
            </button>

            {saveStatus === 'saved' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                📱 Saved on this device. {online ? 'Will sync when connectivity is available.' : 'Device is offline — data is safely stored locally.'}
              </div>
            )}

            {/* New screening button */}
            {saveStatus === 'saved' && (
              <button
                onClick={resetForm}
                className="btn-secondary w-full"
              >
                🆕 Start New Screening
              </button>
            )}
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-2 flex justify-between">
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            className="btn-secondary px-4 py-2 text-sm"
          >
            ← Back
          </button>
          <div className="text-xs text-gray-400 self-center">
            {currentStepIndex + 1} / {STEPS.length}
          </div>
          <button
            onClick={goNext}
            disabled={!canGoNext}
            className="btn-primary px-4 py-2 text-sm"
          >
            Next →
          </button>
        </div>
      </nav>
    </div>
  );
}
