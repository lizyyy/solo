# Event Sourcing Correction API

A backend service for managing event corrections in event sourcing systems, with protection against accidental event overwrites.

## Features

- **Event Correction Workflow**: Create, validate, replay, and apply corrections to historical events
- **Idempotent Operations**: Protection against duplicate actions - repeat submissions won't advance state twice
- **Overwrite Protection**: Each event can only be corrected once, preventing accidental overwrites
- **Replay Validation**: Validate corrections by replaying events to check state changes
- **Anomaly Detection**: Automatically detect potential issues like missing fields, insufficient reasons, etc.
- **Audit Reporting**: Generate detailed reports with anomaly explanations and recommendations
- **Failed Correction Handling**: Preserve raw input, processing basis, and final conclusion for rejected corrections
- **Manual Override**: Support for manual corrections when validation fails

## API Endpoints

### Aggregates
- `POST /api/aggregates` - Create new aggregate
- `GET /api/aggregates` - List all aggregates
- `GET /api/aggregates/:id` - Get aggregate with events and corrections

### Events
- `POST /api/events` - Add original event
- `GET /api/events/:id` - Get event details

### Corrections
- `POST /api/corrections` - Create new correction
- `GET /api/corrections` - List all corrections (filter by status or aggregateId)
- `GET /api/corrections/:id` - Get correction details
- `POST /api/corrections/:id/replay` - Replay and validate correction
- `POST /api/corrections/:id/apply` - Apply correction
- `POST /api/corrections/:id/report` - Generate correction report
- `POST /api/corrections/:id/handle-failed` - Handle failed correction (audit trail)
- `POST /api/corrections/:id/manual` - Manual correction override

### Reports
- `GET /api/reports/:id` - Get report details
- `GET /api/reports/:id/export` - Export report as JSON

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Testing

Run the test script to verify all features:

```bash
chmod +x tests/curl-examples.sh
./tests/curl-examples.sh
```

## Data Models

### Aggregate
- `id` - Unique identifier
- `type` - Aggregate type (e.g., "Order", "Customer")
- `version` - Current version
- `createdAt` - Creation timestamp

### Original Event
- `id` - Unique identifier
- `aggregateId` - Associated aggregate
- `eventType` - Event type
- `payload` - Event data
- `version` - Sequence version
- `isCorrected` - Whether this event has been corrected
- `correctionId` - Reference to correction (if corrected)

### Correction Event
- `id` - Unique identifier
- `originalEventId` - Reference to original event
- `reason` - Explanation for correction
- `originalPayload` - Original payload snapshot
- `correctedPayload` - Corrected payload
- `operator` - User who initiated correction
- `status` - pending/validated/failed/applied/rejected
- `replayResultId` - Reference to replay result
- `reportId` - Reference to report

### Replay Result
- `id` - Unique identifier
- `success` - Whether validation succeeded
- `details` - Validation details including anomalies
- `stateBefore` - State before correction
- `stateAfter` - State after correction
- `rawInput` - Original input (for failed corrections)
- `processingBasis` - Decision basis (for failed corrections)
- `finalConclusion` - Final decision (for failed corrections)

### Correction Report
- `id` - Unique identifier
- `summary` - Report summary
- `anomalies` - Detected anomalies with explanations and recommendations
- `generatedAt` - Report generation timestamp
- `exported` - Export status

## Key Rules Implemented

1. **Event Append Only**: Original events are never modified directly - corrections are appended separately
2. **One Correction Per Event**: Each event can only have one correction to prevent conflicts
3. **Idempotent Operations**: Repeat operations (replay, apply) don't change state twice
4. **Anomaly Detection**: Automatic checks for common issues in corrections
5. **Audit Trail**: All operations track operator and timestamps
6. **Failed Correction Preservation**: Failed corrections keep complete audit trail including raw input
