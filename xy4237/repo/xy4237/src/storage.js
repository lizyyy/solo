const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');

class Storage {
  constructor(storagePath = null) {
    this.storagePath = storagePath || path.join(process.cwd(), '.scene-checker');
    this.confirmationsFile = path.join(this.storagePath, 'confirmations.json');
    this.historyFile = path.join(this.storagePath, 'history.json');
    this.settingsFile = path.join(this.storagePath, 'settings.json');
    
    this._init();
  }

  async _init() {
    try {
      await fs.ensureDir(this.storagePath);
      
      if (!await fs.pathExists(this.confirmationsFile)) {
        await fs.writeJson(this.confirmationsFile, [], { spaces: 2 });
      }
      
      if (!await fs.pathExists(this.historyFile)) {
        await fs.writeJson(this.historyFile, [], { spaces: 2 });
      }
      
      if (!await fs.pathExists(this.settingsFile)) {
        await fs.writeJson(this.settingsFile, {
          maxHistory: 50,
          autoConfirm: false,
          defaultTimeLimit: 120
        }, { spaces: 2 });
      }
    } catch (error) {
      console.error(chalk.red(`存储初始化失败: ${error.message}`));
    }
  }

  async saveConfirmation(confirmation) {
    try {
      const confirmations = await this.loadAllConfirmations();
      
      const newConfirmation = {
        id: uuidv4(),
        ...confirmation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const existingIndex = confirmations.findIndex(c => 
        c.taskId === confirmation.taskId && 
        c.showDirectory === confirmation.showDirectory
      );
      
      if (existingIndex >= 0) {
        newConfirmation.id = confirmations[existingIndex].id;
        newConfirmation.createdAt = confirmations[existingIndex].createdAt;
        confirmations[existingIndex] = newConfirmation;
      } else {
        confirmations.push(newConfirmation);
      }
      
      await fs.writeJson(this.confirmationsFile, confirmations, { spaces: 2 });
      
      console.log(chalk.green(`✓ 确认已保存: ${confirmation.taskId}`));
      
      return newConfirmation;
    } catch (error) {
      console.error(chalk.red(`保存确认记录失败: ${error.message}`));
      throw error;
    }
  }

  async loadConfirmations(showDirectory = null) {
    try {
      const confirmations = await this.loadAllConfirmations();
      
      if (showDirectory) {
        return confirmations.filter(c => 
          c.showDirectory === showDirectory || 
          !c.showDirectory
        );
      }
      
      return confirmations;
    } catch (error) {
      console.error(chalk.red(`加载确认记录失败: ${error.message}`));
      return [];
    }
  }

  async loadAllConfirmations() {
    try {
      if (await fs.pathExists(this.confirmationsFile)) {
        return await fs.readJson(this.confirmationsFile);
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  async clearConfirmations(showDirectory = null) {
    try {
      let confirmations = await this.loadAllConfirmations();
      
      if (showDirectory) {
        confirmations = confirmations.filter(c => c.showDirectory !== showDirectory);
      } else {
        confirmations = [];
      }
      
      await fs.writeJson(this.confirmationsFile, confirmations, { spaces: 2 });
      console.log(chalk.yellow('确认记录已清除'));
    } catch (error) {
      console.error(chalk.red(`清除确认记录失败: ${error.message}`));
      throw error;
    }
  }

  async saveInspectionResult(result) {
    try {
      const history = await this.loadHistory();
      
      const historyEntry = {
        id: uuidv4(),
        timestamp: result.timestamp,
        showDirectory: result.showDirectory,
        success: result.success,
        stats: {
          totalTasks: result.tasks?.length || 0,
          confirmed: result.tasks?.filter(t => t.confirmed)?.length || 0,
          issues: result.issues?.length || 0,
          warnings: result.warnings?.length || 0
        },
        tasks: this._summarizeTasks(result.tasks),
        issues: this._summarizeIssues(result.issues),
        warnings: this._summarizeWarnings(result.warnings)
      };
      
      history.unshift(historyEntry);
      
      const settings = await this.loadSettings();
      const maxHistory = settings.maxHistory || 50;
      
      if (history.length > maxHistory) {
        history.splice(maxHistory);
      }
      
      await fs.writeJson(this.historyFile, history, { spaces: 2 });
      
      return historyEntry;
    } catch (error) {
      console.error(chalk.red(`保存巡检结果失败: ${error.message}`));
      throw error;
    }
  }

  async loadHistory(limit = 10) {
    try {
      if (await fs.pathExists(this.historyFile)) {
        const history = await fs.readJson(this.historyFile);
        return history.slice(0, limit);
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  async getLatestInspection(showDirectory = null) {
    const history = await this.loadHistory(1);
    
    if (history.length === 0) return null;
    
    if (showDirectory) {
      const match = history.find(h => h.showDirectory === showDirectory);
      return match || null;
    }
    
    return history[0];
  }

  async loadSettings() {
    try {
      if (await fs.pathExists(this.settingsFile)) {
        return await fs.readJson(this.settingsFile);
      }
      return {};
    } catch (error) {
      return {};
    }
  }

  async saveSettings(settings) {
    try {
      const currentSettings = await this.loadSettings();
      const newSettings = { ...currentSettings, ...settings };
      
      await fs.writeJson(this.settingsFile, newSettings, { spaces: 2 });
      
      console.log(chalk.green('✓ 设置已保存'));
      return newSettings;
    } catch (error) {
      console.error(chalk.red(`保存设置失败: ${error.message}`));
      throw error;
    }
  }

  async exportAuditPackage(outputPath, result) {
    try {
      const auditData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        inspection: {
          timestamp: result.timestamp,
          showDirectory: result.showDirectory,
          success: result.success
        },
        files: result.files?.map(f => ({
          name: f.name,
          category: f.category,
          size: f.size,
          modified: f.modified
        })) || [],
        tasks: result.tasks?.map(t => ({
          id: t.id,
          type: t.type,
          name: t.name,
          scene: t.scene,
          cue: t.cue,
          time: t.time,
          priority: t.priority,
          responsible: t.responsible,
          confirmed: t.confirmed,
          isDangerous: t.isDangerous,
          confirmation: t.confirmation
        })) || [],
        issues: result.issues || [],
        warnings: result.warnings || [],
        confirmations: result.confirmations || []
      };

      const dir = path.dirname(outputPath);
      await fs.ensureDir(dir);
      
      await fs.writeJson(outputPath, auditData, { spaces: 2 });
      
      console.log(chalk.green(`✓ 审计包已导出: ${outputPath}`));
      
      return outputPath;
    } catch (error) {
      console.error(chalk.red(`导出审计包失败: ${error.message}`));
      throw error;
    }
  }

  async importAuditPackage(auditPath) {
    try {
      const auditData = await fs.readJson(auditPath);
      
      if (auditData.tasks) {
        for (const task of auditData.tasks) {
          if (task.confirmed && task.confirmation) {
            await this.saveConfirmation({
              ...task.confirmation,
              taskId: task.id
            });
          }
        }
      }
      
      console.log(chalk.green(`✓ 审计包已导入: ${auditPath}`));
      
      return auditData;
    } catch (error) {
      console.error(chalk.red(`导入审计包失败: ${error.message}`));
      throw error;
    }
  }

  _summarizeTasks(tasks) {
    if (!tasks) return [];
    
    return tasks.map(t => ({
      id: t.id,
      type: t.type,
      name: t.name,
      scene: t.scene,
      priority: t.priority,
      confirmed: t.confirmed,
      isDangerous: t.isDangerous
    }));
  }

  _summarizeIssues(issues) {
    if (!issues) return [];
    
    return issues.map(i => ({
      type: i.type,
      rule: i.rule,
      severity: i.severity,
      message: i.message,
      category: i.category
    }));
  }

  _summarizeWarnings(warnings) {
    if (!warnings) return [];
    
    return warnings.map(w => ({
      type: w.type,
      rule: w.rule,
      severity: w.severity,
      message: w.message,
      category: w.category
    }));
  }

  getStoragePath() {
    return this.storagePath;
  }
}

module.exports = Storage;
