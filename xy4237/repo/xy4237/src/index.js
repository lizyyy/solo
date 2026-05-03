const Scanner = require('./scanner');
const Parser = require('./parser');
const RuleEngine = require('./rules');
const Storage = require('./storage');
const Exporter = require('./exporter');

class SceneChecker {
  constructor(options = {}) {
    this.options = {
      outputDir: './output',
      ...options
    };
    
    this.scanner = new Scanner();
    this.parser = new Parser();
    this.rules = new RuleEngine();
    this.storage = new Storage(options.storagePath);
    this.exporter = new Exporter();
  }

  async run(showDirectory, options = {}) {
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      showDirectory,
      files: [],
      parsedData: null,
      tasks: [],
      issues: [],
      warnings: [],
      confirmations: []
    };

    try {
      console.log('🔍 开始扫描演出目录:', showDirectory);
      
      // 1. 扫描目录
      const files = await this.scanner.scan(showDirectory);
      result.files = files;
      
      if (files.length === 0) {
        result.success = false;
        result.issues.push({
          type: 'error',
          message: '未找到任何有效文件',
          category: 'scanning'
        });
        return result;
      }

      console.log(`📁 找到 ${files.length} 个文件`);

      // 2. 解析文件
      console.log('📖 解析文件...');
      const parsedData = await this.parser.parseAll(files);
      result.parsedData = parsedData;
      
      // 检查解析错误
      if (parsedData.errors && parsedData.errors.length > 0) {
        result.issues.push(...parsedData.errors.map(err => ({
          type: 'error',
          message: err.message,
          category: 'parsing',
          file: err.file
        })));
      }

      // 3. 生成换景任务
      console.log('📋 生成换景任务...');
      const tasks = this._generateTasks(parsedData);
      result.tasks = tasks;

      // 4. 运行规则检查
      console.log('⚙️  运行规则检查...');
      const ruleResult = await this.rules.checkAll(tasks, parsedData, options);
      result.issues.push(...ruleResult.issues);
      result.warnings.push(...ruleResult.warnings);

      // 5. 加载已有确认记录
      const existingConfirmations = await this.storage.loadConfirmations(showDirectory);
      result.confirmations = existingConfirmations;

      // 6. 标记任务确认状态
      this._markConfirmationStatus(result.tasks, existingConfirmations);

      // 7. 导出结果
      if (options.export) {
        console.log('📤 导出结果...');
        const exportResult = await this.exporter.exportAll(result, {
          outputDir: this.options.outputDir,
          formats: options.exportFormats || ['md', 'csv', 'json']
        });
        result.exportPaths = exportResult.paths;
      }

      console.log('✅ 巡检完成!');
      this._printSummary(result);

    } catch (error) {
      result.success = false;
      result.issues.push({
        type: 'error',
        message: error.message,
        category: 'runtime',
        stack: error.stack
      });
      console.error('❌ 巡检失败:', error.message);
    }

    // 保存结果
    await this.storage.saveInspectionResult(result);
    
    return result;
  }

  _generateTasks(parsedData) {
    const tasks = [];

    // 处理道具清单 - 每个道具视为一个任务
    if (parsedData.props && parsedData.props.length > 0) {
      parsedData.props.forEach((prop, index) => {
        tasks.push({
          id: `prop_${index}`,
          type: 'prop',
          name: prop.name || prop.item,
          scene: prop.scene,
          cue: prop.cue,
          time: prop.time || 0,
          location: prop.location,
          responsible: prop.responsible,
          status: 'pending',
          priority: this._calculatePriority(prop),
          original: prop,
          isDangerous: this._isDangerousItem(prop)
        });
      });
    }

    // 处理灯光 cue
    if (parsedData.lighting && parsedData.lighting.length > 0) {
      parsedData.lighting.forEach((cue, index) => {
        tasks.push({
          id: `light_${index}`,
          type: 'lighting',
          name: `Cue ${cue.cueNumber || cue.id || index}`,
          scene: cue.scene,
          cue: cue.cueNumber || cue.id,
          time: cue.time || 0,
          description: cue.description,
          responsible: cue.responsible,
          status: 'pending',
          priority: 'medium',
          original: cue
        });
      });
    }

    // 处理演员出入场
    if (parsedData.actors && parsedData.actors.length > 0) {
      parsedData.actors.forEach((actorEntry, index) => {
        tasks.push({
          id: `actor_${index}`,
          type: 'actor',
          name: actorEntry.actor,
          scene: actorEntry.scene,
          cue: actorEntry.cue,
          time: actorEntry.time || 0,
          action: actorEntry.action,
          entrance: actorEntry.entrance,
          exit: actorEntry.exit,
          responsible: actorEntry.responsible,
          status: 'pending',
          priority: 'medium',
          original: actorEntry
        });
      });
    }

    // 处理临时改动
    if (parsedData.notes && parsedData.notes.length > 0) {
      parsedData.notes.forEach((note, index) => {
        tasks.push({
          id: `note_${index}`,
          type: 'note',
          name: note.title || note.subject,
          scene: note.scene,
          cue: note.cue,
          time: note.time || 0,
          content: note.content,
          responsible: note.responsible,
          status: 'pending',
          priority: this._calculateNotePriority(note),
          original: note
        });
      });
    }

    // 按时间排序
    return tasks.sort((a, b) => {
      // 先按场景排序
      if (a.scene && b.scene) {
        const sceneCompare = a.scene.localeCompare(b.scene);
        if (sceneCompare !== 0) return sceneCompare;
      }
      // 再按时间排序
      return (a.time || 0) - (b.time || 0);
    });
  }

  _calculatePriority(prop) {
    if (this._isDangerousItem(prop)) return 'high';
    if (prop.priority === 'high' || prop.priority === 1) return 'high';
    if (prop.priority === 'low' || prop.priority === 3) return 'low';
    return 'medium';
  }

  _isDangerousItem(prop) {
    const dangerousKeywords = ['危险', '易燃', '易爆', '有毒', '尖锐', '重物', '火', '电', '刀', '枪', 'dangerous', 'fire', 'electric', 'sharp'];
    const name = (prop.name || prop.item || '').toLowerCase();
    const category = (prop.category || '').toLowerCase();
    const notes = (prop.notes || '').toLowerCase();
    
    return dangerousKeywords.some(keyword => 
      name.includes(keyword.toLowerCase()) || 
      category.includes(keyword.toLowerCase()) ||
      notes.includes(keyword.toLowerCase())
    );
  }

  _calculateNotePriority(note) {
    if (note.urgent || note.priority === 'high') return 'high';
    if (note.priority === 'low') return 'low';
    return 'medium';
  }

  _markConfirmationStatus(tasks, confirmations) {
    const confirmedIds = new Set(confirmations.map(c => c.taskId));
    tasks.forEach(task => {
      task.confirmed = confirmedIds.has(task.id);
      if (task.confirmed) {
        const confirmation = confirmations.find(c => c.taskId === task.id);
        task.confirmation = confirmation;
      }
    });
  }

  _printSummary(result) {
    const stats = {
      total: result.tasks.length,
      props: result.tasks.filter(t => t.type === 'prop').length,
      lighting: result.tasks.filter(t => t.type === 'lighting').length,
      actors: result.tasks.filter(t => t.type === 'actor').length,
      notes: result.tasks.filter(t => t.type === 'note').length,
      confirmed: result.tasks.filter(t => t.confirmed).length,
      highPriority: result.tasks.filter(t => t.priority === 'high').length,
      dangerous: result.tasks.filter(t => t.isDangerous).length,
      errors: result.issues.filter(i => i.type === 'error').length,
      warnings: result.warnings.length
    };

    console.log('\n' + '='.repeat(50));
    console.log('📊 巡检报告摘要');
    console.log('='.repeat(50));
    console.log(`总计任务: ${stats.total}`);
    console.log(`  - 道具: ${stats.props}`);
    console.log(`  - 灯光Cue: ${stats.lighting}`);
    console.log(`  - 演员出入场: ${stats.actors}`);
    console.log(`  - 临时改动: ${stats.notes}`);
    console.log(`\n确认状态: ${stats.confirmed}/${stats.total} (${Math.round(stats.confirmed/stats.total*100)}%)`);
    console.log(`高优先级: ${stats.highPriority}`);
    console.log(`危险道具: ${stats.dangerous}`);
    console.log(`\n问题: ${stats.errors} 个错误, ${stats.warnings} 个警告`);
    
    if (result.exportPaths) {
      console.log(`\n导出文件:`);
      Object.entries(result.exportPaths).forEach(([format, path]) => {
        console.log(`  - ${format}: ${path}`);
      });
    }
    console.log('='.repeat(50) + '\n');
  }

  async confirmTask(taskId, inspector, notes = '') {
    return this.storage.saveConfirmation({
      taskId,
      inspector,
      notes,
      timestamp: new Date().toISOString()
    });
  }

  async getTasks(showDirectory) {
    const result = await this.run(showDirectory, { export: false });
    return result.tasks;
  }
}

module.exports = SceneChecker;
