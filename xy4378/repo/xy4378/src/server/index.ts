import * as path from 'path';
import * as fs from 'fs';
import express from 'express';
import cors from 'cors';
import { DataStore } from '../store';
import { IssueStatus, IssueType, Severity } from '../types';

let store: DataStore | null = null;

const app = express();
app.use(cors());
app.use(express.json());

let currentProjectPath = process.cwd();
let currentScanId: string | undefined;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/scan-info', (req, res) => {
  if (!store) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const scan = currentScanId 
    ? store.getScanById(currentScanId) 
    : store.getLatestScan();

  if (!scan) {
    return res.json({ 
      scan: null, 
      projectPath: currentProjectPath,
      message: 'No scan found. Please run a scan first.'
    });
  }

  res.json({
    scan: {
      id: scan.id,
      timestamp: scan.timestamp,
      date: new Date(scan.timestamp).toLocaleString(),
      locales: JSON.parse(scan.locales),
      totalKeys: scan.total_keys,
      sourceFiles: JSON.parse(scan.source_files),
      localeFiles: JSON.parse(scan.locale_files),
      projectPath: scan.project_path,
    },
    projectPath: currentProjectPath,
  });
});

app.get('/api/issues', (req, res) => {
  if (!store) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const filters: any = {};

  if (currentScanId) {
    filters.scanId = currentScanId;
  }

  if (req.query.status) {
    filters.status = (req.query.status as string).split(',') as IssueStatus[];
  }

  if (req.query.type) {
    filters.type = (req.query.type as string).split(',') as IssueType[];
  }

  if (req.query.severity) {
    filters.severity = (req.query.severity as string).split(',') as Severity[];
  }

  if (req.query.falsePositive !== undefined) {
    filters.falsePositive = req.query.falsePositive === 'true';
  }

  const issues = store.getIssues(filters);
  const stats = store.getStatistics(currentScanId);

  res.json({
    issues,
    stats,
    total: issues.length,
  });
});

app.get('/api/issues/:id', (req, res) => {
  if (!store) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const issue = store.getIssueById(req.params.id);
  
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  res.json(issue);
});

app.put('/api/issues/:id', (req, res) => {
  if (!store) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const updates: any = {};

  if (req.body.status !== undefined) {
    updates.status = req.body.status as IssueStatus;
  }

  if (req.body.falsePositive !== undefined) {
    updates.falsePositive = req.body.falsePositive;
  }

  if (req.body.notes !== undefined) {
    updates.notes = req.body.notes;
  }

  if (req.body.fixSuggestion !== undefined) {
    updates.fixSuggestion = req.body.fixSuggestion;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  const success = store.updateIssue(req.params.id, updates);

  if (!success) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  const updatedIssue = store.getIssueById(req.params.id);
  res.json(updatedIssue);
});

app.get('/api/scans', (req, res) => {
  if (!store) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const scans = store.getAllScans();
  
  res.json({
    scans: scans.map(scan => ({
      id: scan.id,
      timestamp: scan.timestamp,
      date: new Date(scan.timestamp).toLocaleString(),
      locales: JSON.parse(scan.locales),
      totalKeys: scan.total_keys,
      projectPath: scan.project_path,
    })),
  });
});

app.post('/api/select-scan/:scanId', (req, res) => {
  currentScanId = req.params.scanId;
  res.json({ success: true, scanId: currentScanId });
});

app.get('/api/stats', (req, res) => {
  if (!store) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const stats = store.getStatistics(currentScanId);
  res.json(stats);
});

app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.sendFile(path.join(__dirname, '..', '..', 'src', 'server', 'public', 'index.html'));
  }
});

export async function startServer(
  projectPath: string,
  scanId?: string,
  port: number = 3000,
  openBrowser: boolean = true
): Promise<void> {
  currentProjectPath = projectPath;
  currentScanId = scanId;

  const dbPath = path.join(projectPath, '.i18n-checker.db');
  store = new DataStore(dbPath);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`\n🌐 i18n Checker Web Interface running at: ${url}`);
      console.log(`   Press Ctrl+C to stop\n`);

      if (openBrowser) {
        import('open').then(({ default: open }) => {
          open(url);
        }).catch(() => {
          console.log(`   Please open your browser and visit: ${url}`);
        });
      }

      resolve();
    });

    server.on('error', (err) => {
      if (store) {
        store.close();
      }
      reject(err);
    });

    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping server...');
      if (store) {
        store.close();
      }
      server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
      });
    });
  });
}
