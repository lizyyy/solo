import { LevelData, ImportResult, ImportError, PlayerRecord } from '../types';
import { StorageService } from './StorageService';

export class ImportService {
  private static parseCSV(csvContent: string): string[][] {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  }

  static importLevelsFromCSV(csvContent: string): ImportResult {
    const errors: ImportError[] = [];
    const levels: LevelData[] = [];
    
    try {
      const rows = this.parseCSV(csvContent);
      if (rows.length < 2) {
        return {
          success: false,
          message: 'CSV文件内容太少，至少需要表头和一行数据',
          importedCount: 0,
          errors: [{ row: 1, field: 'all', value: '', message: '数据行数不足' }]
        };
      }

      const headers = rows[0].map(h => h.toLowerCase());
      const requiredFields = ['关卡名称', '章节', '关卡', '奖励名称', '奖励数量'];
      const fieldMap: { [key: string]: number } = {};

      requiredFields.forEach(field => {
        const index = headers.findIndex(h => 
          h === field.toLowerCase() || 
          h.includes(field.slice(0, 2))
        );
        if (index === -1) {
          errors.push({ row: 1, field, value: '', message: `缺少必填列"${field}"` });
        } else {
          fieldMap[field] = index;
        }
      });

      if (errors.length > 0) {
        return {
          success: false,
          message: '表头格式不正确，请检查必填列',
          importedCount: 0,
          errors
        };
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        
        try {
          const chapter = parseInt(row[fieldMap['章节']] || '0', 10);
          const stage = parseInt(row[fieldMap['关卡']] || '0', 10);
          const rewardAmount = parseInt(row[fieldMap['奖励数量']] || '0', 10);

          if (isNaN(chapter) || chapter <= 0) {
            errors.push({ row: rowNum, field: '章节', value: row[fieldMap['章节']], message: '章节必须是正整数' });
            continue;
          }
          if (isNaN(stage) || stage <= 0) {
            errors.push({ row: rowNum, field: '关卡', value: row[fieldMap['关卡']], message: '关卡必须是正整数' });
            continue;
          }
          if (isNaN(rewardAmount) || rewardAmount < 0) {
            errors.push({ row: rowNum, field: '奖励数量', value: row[fieldMap['奖励数量']], message: '奖励数量不能是负数' });
            continue;
          }

          const levelName = row[fieldMap['关卡名称']] || `第${chapter}章第${stage}关`;
          
          levels.push({
            id: `level_${chapter}_${stage}_${Date.now()}_${i}`,
            name: levelName,
            chapter,
            stage,
            expectedReward: row[fieldMap['奖励名称']] || '未知奖励',
            rewardAmount,
            source: 'imported',
            importedAt: Date.now()
          });
        } catch (e) {
          errors.push({ row: rowNum, field: 'unknown', value: '', message: '该行数据解析失败' });
        }
      }

      if (levels.length > 0) {
        const existingLevels = StorageService.getLevels();
        const newLevels = [...existingLevels];
        
        levels.forEach(newLevel => {
          const exists = newLevels.findIndex(l => 
            l.chapter === newLevel.chapter && l.stage === newLevel.stage
          );
          if (exists === -1) {
            newLevels.push(newLevel);
          }
        });
        
        StorageService.saveLevels(newLevels);
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `成功导入 ${levels.length} 个关卡` 
          : `导入完成，成功 ${levels.length} 个，失败 ${errors.length} 个`,
        importedCount: levels.length,
        errors
      };
    } catch (error) {
      return {
        success: false,
        message: 'CSV文件解析失败，请检查文件格式',
        importedCount: 0,
        errors: [{ row: 0, field: 'file', value: '', message: '文件格式错误' }]
      };
    }
  }

  static importLevelsFromJSON(jsonContent: string): ImportResult {
    try {
      const data = JSON.parse(jsonContent);
      const levels: LevelData[] = Array.isArray(data) ? data : data.levels || [];
      const errors: ImportError[] = [];

      const validLevels = levels.filter((level: any, index: number) => {
        if (!level.name) {
          errors.push({ row: index + 1, field: 'name', value: level.name, message: '缺少关卡名称' });
          return false;
        }
        if (!level.chapter || typeof level.chapter !== 'number') {
          errors.push({ row: index + 1, field: 'chapter', value: level.chapter, message: '章节格式不正确' });
          return false;
        }
        if (!level.stage || typeof level.stage !== 'number') {
          errors.push({ row: index + 1, field: 'stage', value: level.stage, message: '关卡格式不正确' });
          return false;
        }
        return true;
      }).map((level: any) => ({
        ...level,
        id: level.id || `level_${level.chapter}_${level.stage}_${Date.now()}`,
        source: 'imported' as const,
        importedAt: Date.now()
      }));

      if (validLevels.length > 0) {
        const existingLevels = StorageService.getLevels();
        StorageService.saveLevels([...existingLevels, ...validLevels]);
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `成功导入 ${validLevels.length} 个关卡` 
          : `导入完成，成功 ${validLevels.length} 个，失败 ${errors.length} 个`,
        importedCount: validLevels.length,
        errors
      };
    } catch (error) {
      return {
        success: false,
        message: 'JSON格式不正确，请检查文件内容',
        importedCount: 0,
        errors: [{ row: 0, field: 'json', value: '', message: 'JSON解析失败' }]
      };
    }
  }

  static importPlayerRecordsFromCSV(csvContent: string): ImportResult {
    const errors: ImportError[] = [];
    const records: Omit<PlayerRecord, 'id'>[] = [];
    
    try {
      const rows = this.parseCSV(csvContent);
      if (rows.length < 2) {
        return {
          success: false,
          message: 'CSV文件内容太少',
          importedCount: 0,
          errors: [{ row: 1, field: 'all', value: '', message: '数据行数不足' }]
        };
      }

      const headers = rows[0].map(h => h.toLowerCase());
      const fieldMap: { [key: string]: number } = {
        '玩家ID': headers.findIndex(h => h.includes('玩家') && h.includes('id')) || 0,
        '玩家名称': headers.findIndex(h => h.includes('玩家') && (h.includes('名') || h.includes('昵称'))) || 1,
        '关卡名称': headers.findIndex(h => h.includes('关卡')) || 2,
        '完成时间': headers.findIndex(h => h.includes('时间') || h.includes('日期')) || 3,
        '数据来源': headers.findIndex(h => h.includes('来源') || h.includes('source')) || 4
      };

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        try {
          const playerId = row[fieldMap['玩家ID']];
          const playerName = row[fieldMap['玩家名称']];
          const levelName = row[fieldMap['关卡名称']];
          const sourceText = (row[fieldMap['数据来源']] || '').toLowerCase();

          if (!playerId || !playerName) {
            errors.push({ row: rowNum, field: '玩家信息', value: '', message: '缺少玩家ID或名称' });
            continue;
          }

          const source: PlayerRecord['source'] = 
            sourceText.includes('反馈') ? 'player_feedback' :
            sourceText.includes('手动') ? 'manual' : 'game_data';

          records.push({
            playerId,
            playerName,
            levelId: '',
            levelName,
            completedAt: Date.now(),
            rewardStatus: 'pending',
            source,
            feedbackNote: source === 'player_feedback' ? '玩家反馈记录' : undefined
          });
        } catch (e) {
          errors.push({ row: rowNum, field: 'unknown', value: '', message: '该行数据解析失败' });
        }
      }

      records.forEach(record => {
        StorageService.addRecord(record);
      });

      return {
        success: errors.length === 0,
        message: `成功导入 ${records.length} 条玩家记录`,
        importedCount: records.length,
        errors
      };
    } catch (error) {
      return {
        success: false,
        message: 'CSV文件解析失败',
        importedCount: 0,
        errors: [{ row: 0, field: 'file', value: '', message: '文件格式错误' }]
      };
    }
  }

  static downloadTemplate(type: 'levels' | 'records'): void {
    let csvContent = '';
    if (type === 'levels') {
      csvContent = '关卡名称,章节,关卡,奖励名称,奖励数量\n示例关卡,1,1,钻石,100';
    } else {
      csvContent = '玩家ID,玩家名称,关卡名称,完成时间,数据来源\nP001,小明,第1章第1关,2024-01-01,游戏数据';
    }
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'levels' ? '关卡导入模板.csv' : '玩家记录导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
