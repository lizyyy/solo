import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { database } from './database';
import { riskEngine } from './riskEngine';
import { exporter } from './exporter';
import {
  SceneSchedule,
  CostumeItem,
  WashRecord,
  AlterationRecord,
  ReferencePhoto,
  RiskItem,
  Project,
  ImportResult,
  ExportOptions,
} from '../shared/types';

export function setupIpcHandlers(mainWindow: BrowserWindow) {
  // 项目操作
  ipcMain.handle('get-projects', async (): Promise<Project[]> => {
    return database.getProjects();
  });

  ipcMain.handle('create-project', async (_, name: string): Promise<Project> => {
    return database.createProject(name);
  });

  ipcMain.handle('get-project', async (_, id: string): Promise<Project | null> => {
    return database.getProject(id);
  });

  ipcMain.handle('update-project', async (_, id: string, name: string): Promise<void> => {
    return database.updateProject(id, name);
  });

  // 数据导入
  ipcMain.handle('select-file', async (_, filters: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters,
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // 导入 CSV - 场次通告
  ipcMain.handle('import-scenes-csv', async (_, filePath: string, projectId: string): Promise<ImportResult<SceneSchedule>> => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = Papa.parse(content, { header: true, skipEmptyLines: true });
      
      if (result.errors.length > 0) {
        return {
          success: false,
          errors: result.errors.map((e) => e.message),
          count: 0,
        };
      }

      const scenes: SceneSchedule[] = (result.data as any[]).map((row) => ({
        id: uuidv4(),
        sceneNumber: String(row['场次号'] || row['sceneNumber'] || row['scene_number'] || ''),
        sceneName: String(row['场次名称'] || row['sceneName'] || row['scene_name'] || ''),
        shootDate: String(row['拍摄日期'] || row['shootDate'] || row['shoot_date'] || ''),
        location: String(row['地点'] || row['location'] || ''),
        characters: String(row['涉及角色'] || row['characters'] || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        dayNight: String(row['日夜'] || row['dayNight'] || row['day_night'] || ''),
        weather: String(row['天气'] || row['weather'] || ''),
        notes: String(row['备注'] || row['notes'] || ''),
      })).filter((s) => s.sceneNumber && s.shootDate);

      await database.saveSceneSchedules(projectId, scenes);

      return {
        success: true,
        data: scenes,
        count: scenes.length,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
        count: 0,
      };
    }
  });

  // 导入 CSV - 服装条码扫描表
  ipcMain.handle('import-costumes-csv', async (_, filePath: string, projectId: string): Promise<ImportResult<CostumeItem>> => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = Papa.parse(content, { header: true, skipEmptyLines: true });
      
      if (result.errors.length > 0) {
        return {
          success: false,
          errors: result.errors.map((e) => e.message),
          count: 0,
        };
      }

      const costumes: CostumeItem[] = (result.data as any[]).map((row) => ({
        id: uuidv4(),
        barcode: String(row['条码'] || row['barcode'] || ''),
        character: String(row['角色'] || row['character'] || ''),
        itemName: String(row['服装名称'] || row['itemName'] || row['item_name'] || ''),
        size: String(row['尺码'] || row['size'] || ''),
        color: String(row['颜色'] || row['color'] || ''),
        scenes: String(row['适用场次'] || row['scenes'] || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        status: (String(row['状态'] || row['status'] || 'available') as CostumeItem['status']),
        lastUpdated: new Date().toISOString(),
        notes: String(row['备注'] || row['notes'] || ''),
      })).filter((c) => c.barcode && c.character);

      await database.saveCostumeItems(projectId, costumes);

      return {
        success: true,
        data: costumes,
        count: costumes.length,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
        count: 0,
      };
    }
  });

  // 导入 JSON - 清洗/改衣记录
  ipcMain.handle('import-records-json', async (_, filePath: string, projectId: string): Promise<{ washRecords: ImportResult<WashRecord>; alterationRecords: ImportResult<AlterationRecord> }> => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      const washResult: ImportResult<WashRecord> = { success: true, data: [], count: 0, errors: [] };
      const alterationResult: ImportResult<AlterationRecord> = { success: true, data: [], count: 0, errors: [] };

      // 处理清洗记录
      if (data.washRecords || data.wash_records) {
        const rawRecords = data.washRecords || data.wash_records;
        washResult.data = rawRecords.map((r: any) => ({
          id: uuidv4(),
          costumeId: r.costumeId || r.costume_id || '',
          barcode: r.barcode || '',
          washDate: r.washDate || r.wash_date || new Date().toISOString().split('T')[0],
          expectedReturnDate: r.expectedReturnDate || r.expected_return_date || '',
          status: (r.status || 'pending') as WashRecord['status'],
          notes: r.notes || '',
        }));
        washResult.count = washResult.data.length;
        await database.saveWashRecords(projectId, washResult.data);
      }

      // 处理改衣记录
      if (data.alterationRecords || data.alteration_records) {
        const rawRecords = data.alterationRecords || data.alteration_records;
        alterationResult.data = rawRecords.map((r: any) => ({
          id: uuidv4(),
          costumeId: r.costumeId || r.costume_id || '',
          barcode: r.barcode || '',
          changeType: r.changeType || r.change_type || '尺码调整',
          currentSize: r.currentSize || r.current_size || '',
          targetSize: r.targetSize || r.target_size || '',
          requestDate: r.requestDate || r.request_date || new Date().toISOString().split('T')[0],
          expectedCompletion: r.expectedCompletion || r.expected_completion || '',
          status: (r.status || 'pending') as AlterationRecord['status'],
          isConfirmed: r.isConfirmed || r.is_confirmed || false,
          notes: r.notes || '',
        }));
        alterationResult.count = alterationResult.data.length;
        await database.saveAlterationRecords(projectId, alterationResult.data);
      }

      return {
        washRecords: washResult,
        alterationRecords: alterationResult,
      };
    } catch (error: any) {
      return {
        washRecords: { success: false, count: 0, errors: [error.message] },
        alterationRecords: { success: false, count: 0, errors: [error.message] },
      };
    }
  });

  // 导入照片目录
  ipcMain.handle('import-photos-directory', async (_, dirPath: string, projectId: string): Promise<ImportResult<ReferencePhoto>> => {
    try {
      const files = fs.readdirSync(dirPath);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      
      const photos: ReferencePhoto[] = [];

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!imageExtensions.includes(ext)) continue;

        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        // 从文件名解析信息
        // 文件名格式示例: S01-张三-WD001.jpg 或 001_张三_WD001.jpg
        const parsed = this.parsePhotoFileName(file);

        photos.push({
          id: uuidv4(),
          filePath,
          fileName: file,
          sceneNumber: parsed.sceneNumber || '',
          character: parsed.character || '',
          barcode: parsed.barcode || '',
          photoType: parsed.photoType || 'continuity',
          takenDate: stat.mtime.toISOString().split('T')[0],
          notes: '',
        });
      }

      await database.saveReferencePhotos(projectId, photos);

      return {
        success: true,
        data: photos,
        count: photos.length,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
        count: 0,
      };
    }
  });

  // 获取数据
  ipcMain.handle('get-all-data', async (_, projectId: string) => {
    const [scenes, costumes, washRecords, alterationRecords, photos, risks] = await Promise.all([
      database.getSceneSchedules(projectId),
      database.getCostumeItems(projectId),
      database.getWashRecords(projectId),
      database.getAlterationRecords(projectId),
      database.getReferencePhotos(projectId),
      database.getRiskItems(projectId),
    ]);

    return {
      scenes,
      costumes,
      washRecords,
      alterationRecords,
      photos,
      risks,
    };
  });

  // 运行风险检测
  ipcMain.handle('run-risk-analysis', async (_, projectId: string): Promise<RiskItem[]> => {
    const [scenes, costumes, washRecords, alterationRecords, photos] = await Promise.all([
      database.getSceneSchedules(projectId),
      database.getCostumeItems(projectId),
      database.getWashRecords(projectId),
      database.getAlterationRecords(projectId),
      database.getReferencePhotos(projectId),
    ]);

    // 获取现有的风险，保留用户的修改
    const existingRisks = await database.getRiskItems(projectId);
    const userModifiedMap = new Map<string, Partial<RiskItem>>();
    
    existingRisks.forEach((r) => {
      if (r.userOverride || r.userNotes || r.isResolved) {
        userModifiedMap.set(r.id, {
          userOverride: r.userOverride,
          userNotes: r.userNotes,
          isResolved: r.isResolved,
          resolvedBy: r.resolvedBy,
          resolvedAt: r.resolvedAt,
          resolutionNotes: r.resolutionNotes,
        });
      }
    });

    // 运行新的检测
    const newRisks = riskEngine.analyze(
      scenes,
      costumes,
      washRecords,
      alterationRecords,
      photos
    );

    // 合并用户修改
    const mergedRisks = newRisks.map((risk) => {
      const existing = userModifiedMap.get(risk.id);
      if (existing) {
        return { ...risk, ...existing, updatedAt: new Date().toISOString() };
      }
      return risk;
    });

    await database.saveRiskItems(projectId, mergedRisks);
    await database.updateLastScanned(projectId);

    return mergedRisks;
  });

  // 更新风险项
  ipcMain.handle('update-risk', async (_, projectId: string, riskId: string, updates: Partial<RiskItem>): Promise<void> => {
    return database.updateRiskItem(projectId, riskId, updates);
  });

  // 导出功能
  ipcMain.handle('export-markdown', async (_, projectId: string, options: ExportOptions): Promise<string | null> => {
    const project = await database.getProject(projectId);
    if (!project) return null;

    const [scenes, costumes, risks] = await Promise.all([
      database.getSceneSchedules(projectId),
      database.getCostumeItems(projectId),
      database.getRiskItems(projectId),
    ]);

    const content = exporter.exportToMarkdown(project, scenes, costumes, risks, options);

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存 Markdown 交接单',
      defaultPath: `${project.name}-交接单.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });

    if (result.canceled) return null;

    await exporter.saveToFile(result.filePath, content);
    return result.filePath;
  });

  ipcMain.handle('export-json', async (_, projectId: string, options: ExportOptions): Promise<string | null> => {
    const project = await database.getProject(projectId);
    if (!project) return null;

    const [scenes, costumes, washRecords, alterationRecords, photos, risks] = await Promise.all([
      database.getSceneSchedules(projectId),
      database.getCostumeItems(projectId),
      database.getWashRecords(projectId),
      database.getAlterationRecords(projectId),
      database.getReferencePhotos(projectId),
      database.getRiskItems(projectId),
    ]);

    const content = exporter.exportToJson(
      project,
      scenes,
      costumes,
      washRecords,
      alterationRecords,
      photos,
      risks,
      options
    );

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存 JSON 审计包',
      defaultPath: `${project.name}-审计包.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled) return null;

    await exporter.saveToFile(result.filePath, content);
    return result.filePath;
  });
}

function parsePhotoFileName(fileName: string): { 
  sceneNumber?: string; 
  character?: string; 
  barcode?: string;
  photoType?: 'continuity' | 'detail' | 'fit';
} {
  const name = path.basename(fileName, path.extname(fileName));
  
  // 尝试不同的命名模式
  // 模式1: S01-张三-WD001
  const pattern1 = /^S?(\d+)[-_\s]*(.+?)[-_\s]*([A-Za-z]+\d+)/i;
  const match1 = name.match(pattern1);
  
  if (match1) {
    return {
      sceneNumber: match1[1],
      character: match1[2].trim(),
      barcode: match1[3].toUpperCase(),
    };
  }

  // 模式2: 001_张三_WD001
  const pattern2 = /^(\d+)[-_](.+?)[-_]([A-Za-z]+\d+)/i;
  const match2 = name.match(pattern2);
  
  if (match2) {
    return {
      sceneNumber: match2[1],
      character: match2[2].trim(),
      barcode: match2[3].toUpperCase(),
    };
  }

  // 模式3: 仅条码 WD001
  const pattern3 = /^([A-Za-z]+\d+)/i;
  const match3 = name.match(pattern3);
  
  if (match3) {
    return {
      barcode: match3[1].toUpperCase(),
    };
  }

  return {};
}
