// MHMS Oral Screening - Event Manager Component
// Create, archive, and delete screening events

import { useState, useEffect } from 'react';
import type { ScreeningEvent } from '../lib/types';
import {
  getAllEventsWithArchived,
  saveEvent,
  archiveEvent,
  unarchiveEvent,
  deleteEvent,
  generateEventId,
} from '../lib/db';

interface EventManagerProps {
  onClose: () => void;
}

export default function EventManager({ onClose }: EventManagerProps) {
  const [events, setEvents] = useState<ScreeningEvent[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScreeningEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  // New event form
  const [newEvent, setNewEvent] = useState({
    name: '',
    date: '',
    location: '',
  });

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const allEvents = await getAllEventsWithArchived();
    setEvents(allEvents);
  }

  async function handleCreate() {
    setError('');

    if (!newEvent.name.trim()) {
      setError('Event name is required');
      return;
    }

    const event: ScreeningEvent = {
      eventId: generateEventId(),
      name: newEvent.name.trim(),
      date: newEvent.date,
      location: newEvent.location.trim(),
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: 'local',
    };

    await saveEvent(event);
    setNewEvent({ name: '', date: '', location: '' });
    setShowCreateForm(false);
    await loadEvents();
  }

  async function handleArchive(eventId: string) {
    await archiveEvent(eventId, 'local');
    await loadEvents();
  }

  async function handleUnarchive(eventId: string) {
    await unarchiveEvent(eventId);
    await loadEvents();
  }

  async function handleDelete(eventId: string) {
    setError('');
    const result = await deleteEvent(eventId);

    if (!result.success) {
      setError(result.error || 'Failed to delete event');
      setConfirmDelete(null);
      return;
    }

    setConfirmDelete(null);
    await loadEvents();
  }

  const activeEvents = events.filter(e => e.active);
  const archivedEvents = events.filter(e => !e.active);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">Manage Screening Events</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Create button */}
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary w-full"
            >
              ➕ Create New Event
            </button>
          )}

          {/* Create form */}
          {showCreateForm && (
            <div className="card space-y-3">
              <h3 className="font-semibold">New Event</h3>
              <div>
                <label className="form-label">Event Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., School Screening Program"
                  value={newEvent.name}
                  onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Date (optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={newEvent.date}
                  onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Location (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Betio Community Center"
                  value={newEvent.location}
                  onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="btn-primary flex-1">
                  Create Event
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewEvent({ name: '', date: '', location: '' });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Active events */}
          <div>
            <h3 className="font-semibold mb-2">Active Events ({activeEvents.length})</h3>
            {activeEvents.length === 0 ? (
              <p className="text-sm text-gray-500">No active events</p>
            ) : (
              <div className="space-y-2">
                {activeEvents.map(event => (
                  <div key={event.eventId} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold">{event.name}</div>
                        {event.date && (
                          <div className="text-sm text-gray-600">📅 {event.date}</div>
                        )}
                        {event.location && (
                          <div className="text-sm text-gray-600">📍 {event.location}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          ID: {event.eventId}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleArchive(event.eventId)}
                          className="text-xs px-3 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                        >
                          Archive
                        </button>
                        <button
                          onClick={() => setConfirmDelete(event.eventId)}
                          className="text-xs px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Delete confirmation */}
                    {confirmDelete === event.eventId && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-800 mb-2">
                          Are you sure? This cannot be undone.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(event.eventId)}
                            className="btn-danger text-sm px-4 py-1"
                          >
                            Yes, Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="btn-secondary text-sm px-4 py-1"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Archived events toggle */}
          {archivedEvents.length > 0 && (
            <div>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="text-sm text-[#0066cc] hover:underline mb-2"
              >
                {showArchived ? '▼' : '▶'} Archived Events ({archivedEvents.length})
              </button>

              {showArchived && (
                <div className="space-y-2">
                  {archivedEvents.map(event => (
                    <div key={event.eventId} className="card bg-gray-50 opacity-75">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold">{event.name}</div>
                          {event.date && (
                            <div className="text-sm text-gray-600">📅 {event.date}</div>
                          )}
                          {event.location && (
                            <div className="text-sm text-gray-600">📍 {event.location}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            Archived: {event.archivedAt ? new Date(event.archivedAt).toLocaleDateString() : 'Unknown'}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleUnarchive(event.eventId)}
                            className="text-xs px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => setConfirmDelete(event.eventId)}
                            className="text-xs px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Delete confirmation */}
                      {confirmDelete === event.eventId && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm text-red-800 mb-2">
                            Are you sure? This cannot be undone.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(event.eventId)}
                              className="btn-danger text-sm px-4 py-1"
                            >
                              Yes, Delete
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="btn-secondary text-sm px-4 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn-primary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
