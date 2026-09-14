# Screening Event Management — Feature Documentation

## Overview

The MHMS Oral Screening application now supports full lifecycle management of screening events:
- **Create** new screening events
- **Archive** events (soft delete - preserves historical data)
- **Delete** events (permanent removal with safety checks)
- **Restore** archived events

## Access

Event management is accessible from two locations:
1. **Event Step**: "⚙️ Manage Events" button on the event selection screen
2. **Header Menu**: "📋 Manage Events" option in the dropdown menu

## Features

### Create Events
- Event name (required)
- Date (optional)
- Location (optional)
- Auto-generated unique event ID (format: EVT-XXXXXXXX-XXXX)

### Archive Events
- Soft delete - event is hidden from active selection
- Historical screening data is preserved
- Archived events can be restored
- Archive timestamp and user are recorded

### Delete Events
- Permanent removal from the system
- **Safety check**: Cannot delete if screenings are associated with the event
- Requires explicit confirmation
- If screenings exist, user is prompted to archive instead

### Restore Events
- Archived events can be restored to active status
- Restored events immediately appear in the event dropdown

## Data Storage

Events are stored in IndexedDB under the reference data store:
- Key: `screening_events`
- Persisted across browser sessions
- Survives browser refresh
- Syncs to Google Sheets when online

## Default Event

On first load, the system seeds a default event:
- **Name**: "General Screening"
- **ID**: EVT-DEFAULT
- **Status**: Active

This ensures the application is immediately usable without requiring event creation.

## UI Behavior

### Event Dropdown
- Shows only **active** events
- Displays event name and date (if set)
- Auto-selects first event if none selected

### Event Manager Modal
- Shows active events with Archive/Delete actions
- Collapsible section for archived events
- Archived events show Restore/Delete actions
- Delete requires confirmation dialog
- Error messages for failed operations (e.g., cannot delete event with screenings)

## Safety Features

### Delete Protection
Before permanently deleting an event, the system checks:
```typescript
const screenings = await getAllScreenings();
const hasScreenings = screenings.some(s => s.eventId === eventId);

if (hasScreenings) {
  return {
    success: false,
    error: 'Cannot delete event: screenings are associated with this event. Archive it instead.'
  };
}
```

This prevents accidental data loss and maintains referential integrity.

### Archive vs Delete
- **Archive**: Recommended for events with historical screenings
- **Delete**: Only for events with no associated data

## Data Model

```typescript
interface ScreeningEvent {
  eventId: string;           // Unique identifier
  name: string;              // Event name
  date: string;              // ISO date or empty
  location: string;          // Location description
  active: boolean;           // false = archived
  createdAt: string;         // Creation timestamp
  createdBy: string;         // Creator identifier
  archivedAt?: string;       // Archive timestamp (if archived)
  archivedBy?: string;       // Who archived it
}
```

## Workflow Examples

### Scenario 1: Create a new community screening event
1. Open Event Manager
2. Click "➕ Create New Event"
3. Enter name: "Betio School Screening"
4. Enter date: "2026-03-15"
5. Enter location: "Betio Primary School"
6. Click "Create Event"
7. Event appears in dropdown for selection

### Scenario 2: Archive a completed event
1. Open Event Manager
2. Find the completed event
3. Click "Archive"
4. Event moves to archived section
5. No longer appears in active dropdown
6. Historical screenings remain accessible

### Scenario 3: Attempt to delete an event with screenings
1. Open Event Manager
2. Click "Delete" on an event
3. Confirm deletion
4. System checks for associated screenings
5. If found: Error message appears, deletion blocked
6. User prompted to archive instead

### Scenario 4: Restore an archived event
1. Open Event Manager
2. Expand "Archived Events" section
3. Find the archived event
4. Click "Restore"
5. Event returns to active status
6. Immediately available in dropdown

## Technical Implementation

### Files Modified
- `src/lib/types.ts` - Updated Event type to ScreeningEvent with archive fields
- `src/lib/db.ts` - Added event CRUD operations
- `src/lib/config.ts` - Removed hardcoded DEFAULT_EVENTS
- `src/App.tsx` - Integrated event loading and EventManager
- `src/components/EventManager.tsx` - New component for event management

### Database Operations
```typescript
// Initialize with default event
initializeEvents()

// Get events (active only or all)
getAllEvents(includeArchived: boolean)
getAllEventsWithArchived()

// CRUD operations
saveEvent(event: ScreeningEvent)
archiveEvent(eventId: string, archivedBy: string)
unarchiveEvent(eventId: string)
deleteEvent(eventId: string)

// ID generation
generateEventId()
```

## Future Enhancements

Potential improvements for future versions:
- Event templates (recurring event patterns)
- Event categories (school, community, hospital, etc.)
- Event capacity/limits
- Event assignment to specific screeners
- Event reporting (screenings per event)
- Event search/filter in manager
- Bulk archive/delete operations
- Event notes/description field

## Testing Checklist

- [ ] Default event is created on first load
- [ ] Can create new event with name only
- [ ] Can create new event with all fields
- [ ] Event appears in dropdown after creation
- [ ] Can archive an event
- [ ] Archived event disappears from dropdown
- [ ] Archived event appears in archived section
- [ ] Can restore an archived event
- [ ] Restored event appears in dropdown
- [ ] Cannot delete event with screenings (error shown)
- [ ] Can delete event with no screenings
- [ ] Delete requires confirmation
- [ ] Events persist across browser refresh
- [ ] Events sync to server when online
- [ ] Event manager closes and refreshes event list

---

**Version**: 1.1  
**Date**: 2026  
**Status**: ✅ IMPLEMENTED
