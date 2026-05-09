const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const JSZip = require('jszip');

const appDataDir = path.join(__dirname, 'data');
const dataFile = path.join(appDataDir, 'inspection-data.json');

const defaultSettings = {
  requiredFields: ['deviceName', 'location', 'inspector', 'date', 'status'],
  requiredPhotos: ['device.jpg'],
  tempDir: path.join(appDataDir, 'temp')
};

let mainWindow;

function ensureDataDir() {
  fs.ensureDirSync(appDataDir);
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({
      inspections: [],
      settings: defaultSettings
    }, null, 2), 'utf8');
  }
}

function readData() {
  ensureDataDir();
  try {
    const content = fs.readFileSync(dataFile, 'utf8');
    const data = JSON.parse(content);
    if (!data.settings) {
      data.settings = defaultSettings;
    }
    return data;
  } catch (e) {
    return { inspections: [], settings: defaultSettings };
  }
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
}

function getSettings() {
  return readData().settings || defaultSettings;
}

function getInspections() {
  return readData().inspections || [];
}

function saveInspections(inspections) {
  const data = readData();
  data.inspections = inspections;
  writeData(data);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: '离线巡检包导入复核工具'
  });

  mainWindow.loadFile('src/index.html');
}

app.whenReady().then(() => {
  ensureDataDir();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 处理函数
ipcMain.handle('get-inspections', async () => {
  return getInspections();
});

ipcMain.handle('save-inspection', async (event, inspection) => {
  const inspections = getInspections();
  const existingIndex = inspections.findIndex(i => i.id === inspection.id);
  
  if (existingIndex >= 0) {
    inspections[existingIndex] = inspection;
  } else {
    inspections.unshift(inspection);
  }
  
  saveInspections(inspections);
  return inspections;
});

ipcMain.handle('delete-inspection', async (event, id) => {
  const inspections = getInspections().filter(i => i.id !== id);
  saveInspections(inspections);
  return inspections;
});

ipcMain.handle('select-zip-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Zip 档案', extensions: ['zip'] },
      { name: '所有档案', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('import-zip', async (event, zipPath) => {
  try {
    const tempDir = path.join(appDataDir, 'temp', Date.now().toString());
    await fs.ensureDir(tempDir);

    const zipData = await fs.readFile(zipPath);
    const zip = await JSZip.loadAsync(zipData);
    
    const inspection = await processZip(zip, zipPath, tempDir);
    
    return { success: true, data: inspection };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

async function processZip(zip, zipPath, tempDir) {
  const inspection = {
    id: generateId(),
    zipName: path.basename(zipPath),
    importTime: new Date().toISOString(),
    photos: [],
    locations: [],
    forms: [],
    validation: {
      photos: { valid: false, missing: [], extra: [] },
      locations: { valid: false, missing: [], extra: [] },
      forms: { valid: false, missing: [], conflicts: [] }
    },
    status: 'pending',
    notes: ''
  };

  const files = Object.keys(zip.files);
  const settings = getSettings();

  // 处理照片
  const photoFiles = files.filter(f => 
    /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f) && !f.startsWith('__MACOSX')
  );

  for (const file of photoFiles) {
    const photoData = await zip.file(file).async('nodebuffer');
    const photoPath = path.join(tempDir, 'photos', path.basename(file));
    await fs.ensureDir(path.dirname(photoPath));
    await fs.writeFile(photoPath, photoData);
    
    inspection.photos.push({
      name: path.basename(file),
      path: photoPath,
      size: zip.file(file)._data.uncompressedSize
    });
  }

  // 验证照片
  const requiredPhotos = settings.requiredPhotos;
  const photoNames = inspection.photos.map(p => p.name);
  inspection.validation.photos.missing = requiredPhotos.filter(p => !photoNames.includes(p));
  inspection.validation.photos.valid = inspection.validation.photos.missing.length === 0;

  // 处理定位数据
  const locationFiles = files.filter(f => 
    /location.*\.json$|\.geojson$|\.kml$/i.test(f) && !f.startsWith('__MACOSX')
  );

  for (const file of locationFiles) {
    const content = await zip.file(file).async('string');
    inspection.locations.push({
      name: path.basename(file),
      content: content
    });
  }

  inspection.validation.locations.valid = inspection.locations.length > 0;
  if (!inspection.validation.locations.valid) {
    inspection.validation.locations.missing = ['未找到定位数据文件'];
  }

  // 处理表单数据
  const formFiles = files.filter(f => 
    /(form|inspection|data).*\.(json|csv|xml)$/i.test(f) && !f.startsWith('__MACOSX')
  );

  for (const file of formFiles) {
    const content = await zip.file(file).async('string');
    let data = {};
    
    try {
      if (/\.json$/i.test(file)) {
        data = JSON.parse(content);
      } else if (/\.csv$/i.test(file)) {
        data = parseCSV(content);
      }
    } catch (e) {
      // 解析失败，保持原始内容
    }

    inspection.forms.push({
      name: path.basename(file),
      content: content,
      data: data
    });
  }

  // 验证表单字段
  if (inspection.forms.length > 0) {
    const requiredFields = settings.requiredFields;
    const formData = inspection.forms[0].data;
    const existingFields = Object.keys(formData);
    
    inspection.validation.forms.missing = requiredFields.filter(f => !existingFields.includes(f));
    inspection.validation.forms.valid = inspection.validation.forms.missing.length === 0;

    // 检查字段冲突
    for (const field in formData) {
      if (formData[field] === null || formData[field] === undefined || 
          (typeof formData[field] === 'string' && formData[field].trim() === '')) {
        inspection.validation.forms.conflicts.push({
          field: field,
          message: '字段值为空'
        });
      }
    }
  } else {
    inspection.validation.forms.missing = ['未找到表单数据文件'];
    inspection.validation.forms.valid = false;
  }

  // 总体状态
  const allValid = inspection.validation.photos.valid && 
                   inspection.validation.locations.valid && 
                   inspection.validation.forms.valid;
  inspection.status = allValid ? 'valid' : 'invalid';

  return inspection;
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return {};
  
  const headers = lines[0].split(',');
  const values = lines[1].split(',');
  const result = {};
  
  headers.forEach((header, index) => {
    result[header.trim()] = values[index] ? values[index].trim() : '';
  });
  
  return result;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

ipcMain.handle('export-inspection', async (event, inspection) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `复核清单_${inspection.zipName.replace('.zip', '')}_${new Date().toISOString().slice(0, 10)}.txt`,
    filters: [
      { name: '文本文件', extensions: ['txt'] },
      { name: 'CSV 文件', extensions: ['csv'] }
    ]
  });

  if (result.canceled) return null;

  const content = generateExportContent(inspection);
  await fs.writeFile(result.filePath, content, 'utf8');
  
  return result.filePath;
});

function generateExportContent(inspection) {
  const lines = [];
  
  lines.push('='.repeat(60));
  lines.push('离线巡检包复核清单');
  lines.push('='.repeat(60));
  lines.push('');
  
  lines.push('【基本信息】');
  lines.push(`包名：${inspection.zipName}`);
  lines.push(`导入时间：${new Date(inspection.importTime).toLocaleString('zh-CN')}`);
  lines.push(`复核状态：${getStatusText(inspection.status)}`);
  if (inspection.notes) {
    lines.push(`备注：${inspection.notes}`);
  }
  lines.push('');

  lines.push('【照片检查】');
  lines.push(`数量：${inspection.photos.length} 张`);
  lines.push(`状态：${inspection.validation.photos.valid ? '✓ 完整' : '✗ 缺失'}`);
  if (inspection.validation.photos.missing.length > 0) {
    lines.push(`缺失：${inspection.validation.photos.missing.join(', ')}`);
  }
  inspection.photos.forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p.name} (${formatSize(p.size)})`);
  });
  lines.push('');

  lines.push('【定位检查】');
  lines.push(`数量：${inspection.locations.length} 个`);
  lines.push(`状态：${inspection.validation.locations.valid ? '✓ 完整' : '✗ 缺失'}`);
  inspection.locations.forEach((l, i) => {
    lines.push(`  ${i + 1}. ${l.name}`);
  });
  lines.push('');

  lines.push('【表单检查】');
  lines.push(`数量：${inspection.forms.length} 个`);
  lines.push(`状态：${inspection.validation.forms.valid ? '✓ 完整' : '✗ 字段缺失/冲突'}`);
  if (inspection.validation.forms.missing.length > 0) {
    lines.push(`缺失字段：${inspection.validation.forms.missing.join(', ')}`);
  }
  if (inspection.validation.forms.conflicts.length > 0) {
    lines.push('字段冲突：');
    inspection.validation.forms.conflicts.forEach(c => {
      lines.push(`  - ${c.field}: ${c.message}`);
    });
  }
  inspection.forms.forEach((f, i) => {
    lines.push(`  ${i + 1}. ${f.name}`);
  });
  lines.push('');

  lines.push('='.repeat(60));
  lines.push(`导出时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('='.repeat(60));

  return lines.join('\n');
}

function getStatusText(status) {
  const statusMap = {
    'pending': '待复核',
    'valid': '复核通过',
    'invalid': '复核不通过',
    'reviewed': '已复核'
  };
  return statusMap[status] || status;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

ipcMain.handle('open-photo', async (event, photoPath) => {
  if (fs.existsSync(photoPath)) {
    shell.openPath(photoPath);
    return true;
  }
  return false;
});

ipcMain.handle('get-photo-data', async (event, photoPath) => {
  if (fs.existsSync(photoPath)) {
    const data = await fs.readFile(photoPath);
    const ext = path.extname(photoPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 
                 ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                 ext === '.gif' ? 'image/gif' : 'image/png';
    return `data:${mime};base64,${data.toString('base64')}`;
  }
  return null;
});

// 检查重复导入
ipcMain.handle('check-duplicate', async (event, zipName) => {
  const inspections = getInspections();
  const existing = inspections.find(i => i.zipName === zipName);
  return existing ? { exists: true, inspection: existing } : { exists: false };
});
