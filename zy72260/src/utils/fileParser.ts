import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import md5 from 'blueimp-md5';
import { PointCloudLog, SafetyRadiusTable, Waypoint, ExhibitData } from '@/types';
import { db, getFileHashHistory } from '@/db';

export async function calculateFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(md5(content));
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function checkDuplicateImport(
  fileHash: string,
  type: 'point_cloud' | 'safety_radius'
) {
  const history = await getFileHashHistory(fileHash, type);
  return history.length > 0 ? history : null;
}

export async function parsePointCloudLog(
  file: File,
  operator: string
): Promise<{ log: PointCloudLog; isDuplicate: boolean; duplicateHistory?: any[] }> {
  const content = await readFileAsText(file);
  const fileHash = await calculateFileHash(file);
  const duplicateHistory = await checkDuplicateImport(fileHash, 'point_cloud');
  
  let exhibits: ExhibitData[] = [];
  let route: Waypoint[] = [];

  if (file.name.endsWith('.json')) {
    const jsonData = JSON.parse(content);
    exhibits = jsonData.exhibits || [];
    route = jsonData.route || [];
  } else if (file.name.endsWith('.csv')) {
    const result = Papa.parse(content, { header: true, skipEmptyLines: true });
    const rows = result.data as any[];
    
    const exhibitRows = rows.filter((r: any) => r.type === 'exhibit');
    const routeRows = rows.filter((r: any) => r.type === 'waypoint');
    
    exhibits = exhibitRows.map((r: any, idx: number) => ({
      exhibitId: r.exhibitId || `EXH-${String(idx + 1).padStart(3, '0')}`,
      name: r.name || `展柜${idx + 1}`,
      x: parseFloat(r.x),
      y: parseFloat(r.y),
      pointCloudRadius: parseFloat(r.radius || r.pointCloudRadius),
      radiusSource: 'point_cloud' as const,
    }));
    
    route = routeRows.map((r: any) => ({
      x: parseFloat(r.x),
      y: parseFloat(r.y),
      timestamp: r.timestamp,
    }));
  } else {
    const lines = content.split('\n').filter(l => l.trim());
    let currentSection: 'exhibits' | 'route' | null = null;
    
    for (const line of lines) {
      if (line.includes('[展柜数据]') || line.includes('[Exhibits]')) {
        currentSection = 'exhibits';
        continue;
      }
      if (line.includes('[动线数据]') || line.includes('[Route]')) {
        currentSection = 'route';
        continue;
      }
      
      if (currentSection === 'exhibits' && line.includes(',')) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 4) {
          exhibits.push({
            exhibitId: parts[0] || `EXH-${String(exhibits.length + 1).padStart(3, '0')}`,
            name: parts[1] || `展柜${exhibits.length + 1}`,
            x: parseFloat(parts[2]),
            y: parseFloat(parts[3]),
            pointCloudRadius: parseFloat(parts[4]) || 1.5,
            radiusSource: 'point_cloud',
          });
        }
      }
      
      if (currentSection === 'route' && line.includes(',')) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          route.push({
            x: parseFloat(parts[0]),
            y: parseFloat(parts[1]),
            timestamp: parts[2],
          });
        }
      }
    }
  }

  const log: PointCloudLog = {
    id: `pcl_${Date.now()}`,
    filename: file.name,
    importTime: new Date().toISOString(),
    fileHash,
    operator,
    exhibits,
    route,
    rawContent: content,
  };

  await db.pointCloudLogs.put(log);
  await db.importHistory.put({
    id: `ih_${Date.now()}`,
    type: 'point_cloud',
    filename: file.name,
    importTime: log.importTime,
    fileHash,
    operator,
  });

  return {
    log,
    isDuplicate: !!duplicateHistory,
    duplicateHistory: duplicateHistory || undefined,
  };
}

export async function parseSafetyRadiusTable(
  file: File,
  operator: string
): Promise<{ table: SafetyRadiusTable; isDuplicate: boolean; duplicateHistory?: any[] }> {
  const content = await readFileAsText(file);
  const fileHash = await calculateFileHash(file);
  const duplicateHistory = await checkDuplicateImport(fileHash, 'safety_radius');
  
  let exhibits: Array<{ exhibitId: string; safetyRadius: number }> = [];
  let version = 'v1.0';

  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const workbook = XLSX.read(content, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
    
    exhibits = jsonData
      .filter((r: any) => r.exhibitId || r['展柜编号'])
      .map((r: any) => ({
        exhibitId: r.exhibitId || r['展柜编号'] || '',
        safetyRadius: parseFloat(r.safetyRadius || r['安全半径'] || r.radius || '1.5'),
      }));
    
    const versionMatch = content.match(/version[^\d]*([\d.]+)/i);
    if (versionMatch) version = `v${versionMatch[1]}`;
  } else if (file.name.endsWith('.csv')) {
    const result = Papa.parse(content, { header: true, skipEmptyLines: true });
    const rows = result.data as any[];
    
    exhibits = rows
      .filter((r: any) => r.exhibitId || r['展柜编号'])
      .map((r: any) => ({
        exhibitId: r.exhibitId || r['展柜编号'] || '',
        safetyRadius: parseFloat(r.safetyRadius || r['安全半径'] || r.radius || '1.5'),
      }));
  } else {
    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.includes('version') || line.includes('版本')) {
        const versionMatch = line.match(/[vV]?(\d+\.\d+)/);
        if (versionMatch) version = `v${versionMatch[1]}`;
        continue;
      }
      if (line.includes(',')) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2 && /^[A-Za-z0-9-]+$/.test(parts[0])) {
          exhibits.push({
            exhibitId: parts[0],
            safetyRadius: parseFloat(parts[1]) || 1.5,
          });
        }
      }
    }
  }

  const table: SafetyRadiusTable = {
    id: `srt_${Date.now()}`,
    filename: file.name,
    importTime: new Date().toISOString(),
    version,
    operator,
    exhibits,
    rawContent: content,
  };

  await db.safetyRadiusTables.put(table);
  await db.importHistory.put({
    id: `ih_${Date.now()}`,
    type: 'safety_radius',
    filename: file.name,
    importTime: table.importTime,
    fileHash,
    operator,
  });

  return {
    table,
    isDuplicate: !!duplicateHistory,
    duplicateHistory: duplicateHistory || undefined,
  };
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  });
}

export function generatePointCloudSampleFile(): Blob {
  const content = `[展柜数据]
EXH-001,青铜器展柜,10,8,1.5
EXH-002,陶瓷展柜,20,12,1.5
EXH-003,书画展柜,30,10,1.5
EXH-004,玉器展柜,25,20,1.5
EXH-005,钱币展柜,15,18,1.5

[动线数据]
5,5
10,8
20,12
30,10
25,20
15,18
5,25
`;
  return new Blob([content], { type: 'text/plain' });
}

export function generateSafetyRadiusSampleFile(): Blob {
  const content = `version:1.1
EXH-001,2.0
EXH-002,1.8
EXH-003,2.5
EXH-004,1.8
EXH-005,2.0
`;
  return new Blob([content], { type: 'text/plain' });
}
