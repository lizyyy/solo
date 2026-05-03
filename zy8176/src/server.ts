import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

function readDataFile(): unknown | null {
  try {
    const planPath = path.join(OUTPUT_DIR, 'migration_plan.json');
    const issuesPath = path.join(OUTPUT_DIR, 'issues.csv');
    
    if (!fs.existsSync(planPath)) {
      return null;
    }

    const planContent = fs.readFileSync(planPath, 'utf-8');
    const plan = JSON.parse(planContent);

    let issues = [];
    let statistics = {
      totalDrafts: 0,
      affectedDrafts: 0,
      issuesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      issuesByType: {},
      fieldsAdded: 0,
      fieldsRemoved: 0,
      fieldsModified: 0,
      attachmentCount: 0,
      attachmentIssues: 0
    };
    let schemaDiff = {
      addedFields: [],
      removedFields: [],
      modifiedFields: [],
      addedGroups: [],
      removedGroups: []
    };

    if (fs.existsSync(path.join(OUTPUT_DIR, 'dashboard_cache.json'))) {
      try {
        const cacheContent = fs.readFileSync(path.join(OUTPUT_DIR, 'dashboard_cache.json'), 'utf-8');
        const cached = JSON.parse(cacheContent);
        issues = cached.issues || issues;
        statistics = cached.statistics || statistics;
        schemaDiff = cached.schemaDiff || schemaDiff;
      } catch {
        // ignore cache errors
      }
    }

    return {
      plan,
      issues,
      statistics,
      schemaDiff
    };
  } catch (error) {
    console.error('Error reading data:', error);
    return null;
  }
}

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.url === '/api/data') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const data = readDataFile();
    
    if (data) {
      res.statusCode = 200;
      res.end(JSON.stringify(data));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'No data available. Run the migration check first.' }));
    }
    return;
  }

  if (req.url === '/api/refresh') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    console.log('Running migration check...');
    
    const projectRoot = path.join(__dirname, '..');
    const npmPath = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    const child = exec(`${npmPath} run dev -- sample`, {
      cwd: projectRoot,
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    let output = '';
    child.stdout?.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });
    child.stderr?.on('data', (data) => {
      output += data.toString();
      console.error(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        res.statusCode = 200;
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Migration check completed successfully'
        }));
      } else {
        res.statusCode = 500;
        res.end(JSON.stringify({ 
          success: false, 
          message: 'Migration check failed',
          output: output
        }));
      }
    });
    return;
  }

  let filePath = req.url === '/' ? '/index.html' : req.url;
  
  const queryIndex = filePath.indexOf('?');
  if (queryIndex > -1) {
    filePath = filePath.substring(0, queryIndex);
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const fullPath = path.join(PUBLIC_DIR, filePath);
  const normalizedPath = path.normalize(fullPath);

  if (!normalizedPath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(normalizedPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('File not found');
      } else {
        res.statusCode = 500;
        res.end('Server error');
      }
    } else {
      res.setHeader('Content-Type', contentType);
      res.statusCode = 200;
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log('\n========================================');
  console.log('  📊 Dashboard Server Started');
  console.log('========================================');
  console.log('');
  console.log(`  URL: http://localhost:${PORT}`);
  console.log('');
  console.log('  Press Ctrl+C to stop the server');
  console.log('');
  console.log('========================================\n');
});

process.on('SIGINT', () => {
  console.log('\n\nStopping server...');
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});
