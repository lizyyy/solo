# Offline Work Order Sync Lab - Specification

## Project Overview
- **Name**: inspection-sync-lab
- **Type**: Vite + TypeScript Frontend Experiment Platform
- **Purpose**: Validate offline work order synchronization for inspection tablet applications
- **Core Feature**: Simulate offline/online scenarios, sync queue, conflict detection and resolution

## Architecture

### Module Breakdown
1. **Mock Server** (`src/server/`) - Simulates backend API with sample data
2. **Offline Storage** (`src/storage/`) - IndexedDB wrapper for local persistence
3. **Sync State Machine** (`src/sync/`) - State management for sync lifecycle
4. **Conflict Merge** (`src/conflict/`) - Diff display and resolution logic
5. **UI Components** (`src/components/`) - React components for the experiment UI

## Data Models

### WorkOrder
```typescript
interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'closed';
  photos: Photo[];
  notes: string;
  version: number;
  updatedAt: string;
  updatedBy: 'local' | 'remote';
}
```

### Photo
```typescript
interface Photo {
  id: string;
  url: string;
  caption: string;
  updatedAt: string;
}
```

### SyncQueueItem
```typescript
interface SyncQueueItem {
  id: string;
  workOrderId: string;
  operation: 'create' | 'update';
  payload: Partial<WorkOrder>;
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
}
```

### ConflictRecord
```typescript
interface ConflictRecord {
  workOrderId: string;
  localVersion: WorkOrder;
  remoteVersion: WorkOrder;
  resolvedVersion?: WorkOrder;
  resolution?: 'local' | 'remote' | 'merged';
  timestamp: string;
}
```

## Sync State Machine States
- **IDLE** - No sync activity
- **SYNCING** - Actively syncing with server
- **OFFLINE** - Network unavailable
- **CONFLICT** - Conflicts detected requiring resolution
- **ERROR** - Sync failed with errors

## Functionality Specification

### Core Features
1. **Online/Offline Toggle** - UI switch to simulate network conditions
2. **Work Order Editor** - Edit photos, notes, status of work orders
3. **IndexedDB Queue** - Persist operations when offline
4. **Version-based Replay** - Replay queued operations with version checking
5. **Conflict Detection** - Detect when remote version differs from expected
6. **Side-by-Side Diff** - Display local vs remote differences
7. **Manual Resolution** - Choose local/remote/merged version
8. **Export Report** - Export conflict report as JSON

### Edge Cases Handled
1. **Duplicate Submission**: Dedupe using operation ID + timestamp
2. **Remote Closed**: Track server status, queue operations when server unavailable, validate server reopens before sync

## UI Layout
- Header: Online/Offline toggle, sync status indicator
- Main: Work order list (left), Editor panel (right)
- Bottom panel: Sync queue status
- Modal: Conflict resolution with diff view

## Sample Data
- 3 pre-loaded work orders with various statuses
- Sample photos with captions
- Version numbers for conflict simulation

## Technical Stack
- Vite + React + TypeScript
- IndexedDB via idb library
- CSS for styling (no framework)
