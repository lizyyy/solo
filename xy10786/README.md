# Content Publishing Queue System

⚠️ **重要说明**: 首次使用前必须安装依赖！  
项目不包含 `node_modules` 目录（标准做法），请先执行安装步骤。详细安装指南请参考 [INSTALL.md](INSTALL.md)。

A full-stack content publishing queue system with comprehensive content management, review workflow, multi-channel synchronization, and retry mechanisms.

## Features

### Backend Features
- **State Management**: Complete state flow for content publishing
- **Business Status Codes**: Clear differentiation between success, pending review, blocked, and retryable states
- **Retry Mechanism**: Automatic retry with configurable maximum attempts
- **Multi-channel Sync**: Support for multiple distribution channels
- **Idempotency**: Prevention of duplicate submissions using idempotency keys
- **Calendar Export**: CSV export of publishing schedules
- **Audit Trail**: Complete timeline of all operations

### Frontend Features
- **Dashboard**: Statistics and visualizations of content status
- **Content Management**: List, create, edit, and view details
- **Review Drawer**: Complete review workflow with approval/rejection/withdrawal
- **Timeline View**: Complete audit trail of all operations
- **Calendar View**: Visual publishing schedule with CSV export

## Technical Stack

### Backend
- Node.js + Express
- TypeScript
- TypeORM + SQLite
- Node-cron for scheduled tasks
- CSV-Writer for exports

### Frontend
- React 18 + TypeScript
- Ant Design 5
- Recharts for data visualization
- Axios for HTTP client

## Business Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | Success | Operation completed successfully |
| 202 | Pending Review | Content is waiting for review approval |
| 403 | Blocked | Operation blocked due to business rules |
| 409 | Retryable | Can be retried with appropriate action |
| 400 | Validation Error | Invalid input parameters |
| 500 | Server Error | Internal server error |

## Content State Flow

```
Draft
  ↓
Pending Review ←──────────────────┐
  ↓                                │
Approved                           │  Reject (Needs Review)
  ↓                                │
Scheduled                          │
  ↓                                │
Publishing ────┐                  │
  ↓            │                  │
Published      │ Can retry        │
  ↓            ↓                  │
Syncing     ──→ Retryable ────→ Failed
  ↓
Synced
  ↓
Withdrawn
```

## Project Structure

```
.
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── ContentController.ts
│   │   ├── entities/
│   │   │   ├── ContentEntity.ts
│   │   │   ├── ChannelSyncEntity.ts
│   │   │   └── ReviewRecordEntity.ts
│   │   ├── services/
│   │   │   └── ContentService.ts
│   │   ├── index.ts
│   │   ├── database.ts
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ContentList.tsx
│   │   │   ├── ReviewDrawer.tsx
│   │   │   ├── TimelineView.tsx
│   │   │   └── CalendarView.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── package.json
│   └── tsconfig.json
├── package.json
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone and navigate to project
cd content-publish-queue

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Running the Application

```bash
# Start backend server (runs on port 3001)
cd server
npm run dev

# Start frontend (runs on port 3000)
cd client
npm start
```

### Using the Application

1. Open http://localhost:3000 in your browser
2. Navigate to "Content Management"
3. Click "New Content" to create content
4. Submit for review
5. Review and approve/reject content
6. For scheduled content, view in "Publish Calendar"
7. Check Dashboard for statistics

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/content | Create new content |
| GET | /api/content | List all content |
| GET | /api/content/:id | Get content details |
| PUT | /api/content/:id | Update content |
| POST | /api/content/:id/submit-review | Submit for review |
| POST | /api/content/:id/review | Perform review action |
| POST | /api/content/:id/retry | Retry publishing |
| POST | /api/content/:id/publish-now | Publish immediately |
| POST | /api/channels/:channelId/retry | Retry channel sync |
| POST | /api/channels/:channelId/fix | Apply fix to channel |
| GET | /api/dashboard/stats | Get dashboard statistics |
| GET | /api/content/:contentId/timeline | Get content timeline |
| GET | /api/calendar | Get calendar events |
| GET | /api/calendar/export | Export calendar as CSV |

## Retry Mechanism

### Content Retry
- Each content item can be retried up to 3 times
- Retry count resets after review and approval
- Status codes indicate retry possibility

### Channel Retry
- Each channel has independent retry counter (3 attempts)
- Failed channels can be fixed and retried
- Fix operation records the reason for future audit

## Development

### Adding New Channels
1. Update `server/src/types.ts` - Add to `ChannelType` enum
2. Update `client/src/types.ts` - Add to both `ChannelType` and `ChannelLabelMap`

### Modifying State Flow
1. Adjust state transitions in `server/src/services/ContentService.ts`
2. Update frontend status colors in `client/src/types.ts`

### Environment Variables
Create a `.env` file in the server directory:
```env
PORT=3001
NODE_ENV=development
```

## License

MIT
