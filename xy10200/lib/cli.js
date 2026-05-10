const fs = require('fs');
const path = require('path');
const { Importer } = require('./importer');
const { Validator } = require('./validator');
const { Storage } = require('./storage');
const { Exporter } = require('./exporter');
const { CheckRecord, STATUS } = require('./models');

const TYPE_NAMES = {
  yard_coordinate: '堆场坐标异常',
  position_occupancy: '箱位占用冲突',
  multi_source: '多源数据不一致',
  shift_chain_broken: '移位链断裂',
};

class CLI {
  constructor() {
    this.workspace = process.cwd();
    this.commands = {
      init: this.init.bind(this),
      import: this.importCmd.bind(this),
      check: this.check.bind(this),
      history: this.history.bind(this),
      review: this.review.bind(this),
      resolve: this.resolve.bind(this),
      export: this.export.bind(this),
      anomalies: this.anomalies.bind(this),
      help: this.help.bind(this),
    };
  }

  run(argv) {
    const args = argv.slice(2);
    const command = args[0] || 'help';
    const options = args.slice(1);

    if (this.commands[command]) {
      this.commands[command](options);
    } else {
      console.log(`未知命令: ${command}`);
      this.help([]);
    }
  }

  help() {
    console.log('');
    console.log('📦 码头堆场箱位纠错CLI (yard-position-corrector)');
    console.log('');
    console.log('用法: yardc <命令> [选项]');
    console.log('');
    console.log('命令:');
    console.log('  init [--sample=<type>]      初始化工作目录，创建样例数据');
    console.log('                              --sample=normal  顺利样例（默认）');
    console.log('                              --sample=conflict  冲突样例');
    console.log('');
    console.log('  import --gate=<file>        导入三方数据文件');
    console.log('         --yard=<file>');
    console.log('         --tally=<file>');
    console.log('');
    console.log('  check                       执行箱位一致性检查');
    console.log('');
    console.log('  history [--limit=<n>]       查看检查历史（默认显示最近10条）');
    console.log('');
    console.log('  review [--type=<t>]         查看待复核冲突清单');
    console.log('                              --type=yard_coordinate|position_occupancy|multi_source|shift_chain_broken');
    console.log('');
    console.log('  resolve --id=<id>           标记冲突为已解决');
    console.log('          --resolution=<text>  解决方案描述');
    console.log('');
    console.log('  export --dir=<path>         导出检查报告（JSON + Markdown）');
    console.log('');
    console.log('  anomalies                   导出异常清单');
    console.log('');
    console.log('  help                        显示帮助信息');
    console.log('');
  }

  init(options) {
    const sampleType = this.parseOption(options, 'sample') || 'normal';
    
    console.log('📁 初始化工作目录...');
    
    const sampleDir = path.join(__dirname, '..', 'samples', sampleType);
    
    if (!fs.existsSync(sampleDir)) {
      console.log(`❌ 未找到样例类型: ${sampleType}`);
      console.log('可用样例: normal, conflict');
      process.exit(1);
    }

    const gateFile = path.join(sampleDir, 'gate_system.json');
    const yardFile = path.join(sampleDir, 'yard_inventory.json');
    const tallyFile = path.join(sampleDir, 'tally_records.json');

    if (fs.existsSync(gateFile)) {
      fs.copyFileSync(gateFile, path.join(this.workspace, 'gate_system.json'));
      console.log('✅ 闸口系统数据: gate_system.json');
    }
    if (fs.existsSync(yardFile)) {
      fs.copyFileSync(yardFile, path.join(this.workspace, 'yard_inventory.json'));
      console.log('✅ 堆场清单数据: yard_inventory.json');
    }
    if (fs.existsSync(tallyFile)) {
      fs.copyFileSync(tallyFile, path.join(this.workspace, 'tally_records.json'));
      console.log('✅ 理货移位记录: tally_records.json');
    }

    console.log('');
    console.log(`样例类型: ${sampleType === 'normal' ? '顺利样例（无冲突）' : '冲突样例（含拦截/待复核项）'}`);
    console.log('');
    console.log('下一步:');
    console.log('  1. yardc check                执行检查');
    console.log('  2. yardc review               查看冲突（如有）');
    console.log('  3. yardc export --dir=./out   导出报告');
  }

  importCmd(options) {
    const gateFile = this.parseOption(options, 'gate');
    const yardFile = this.parseOption(options, 'yard');
    const tallyFile = this.parseOption(options, 'tally');

    if (!gateFile && !yardFile && !tallyFile) {
      console.log('❌ 请至少指定一个文件: --gate, --yard, 或 --tally');
      process.exit(1);
    }

    console.log('📥 导入数据文件...');

    if (gateFile && fs.existsSync(gateFile)) {
      const dest = path.join(this.workspace, 'gate_system.json');
      fs.copyFileSync(gateFile, dest);
      console.log(`✅ 闸口系统数据已导入: ${gateFile}`);
    }

    if (yardFile && fs.existsSync(yardFile)) {
      const dest = path.join(this.workspace, 'yard_inventory.json');
      fs.copyFileSync(yardFile, dest);
      console.log(`✅ 堆场清单数据已导入: ${yardFile}`);
    }

    if (tallyFile && fs.existsSync(tallyFile)) {
      const dest = path.join(this.workspace, 'tally_records.json');
      fs.copyFileSync(tallyFile, dest);
      console.log(`✅ 理货移位记录已导入: ${tallyFile}`);
    }

    console.log('');
    console.log('下一步: yardc check');
  }

  check() {
    console.log('🔍 执行箱位一致性检查...');
    console.log('');

    const gateFile = path.join(this.workspace, 'gate_system.json');
    const yardFile = path.join(this.workspace, 'yard_inventory.json');
    const tallyFile = path.join(this.workspace, 'tally_records.json');

    if (!fs.existsSync(gateFile) && !fs.existsSync(yardFile)) {
      console.log('❌ 未找到数据文件，请先运行: yardc init 或 yardc import');
      process.exit(1);
    }

    const importer = new Importer(this.workspace);
    const validator = new Validator();
    const storage = new Storage(this.workspace);

    const { positions, shifts } = importer.importAll(gateFile, yardFile, tallyFile);
    
    console.log(`📊 导入统计:`);
    console.log(`   - 箱位记录: ${positions.length} 条`);
    console.log(`   - 移位记录: ${shifts.length} 条`);
    console.log('');

    const checksum = storage.generateChecksum(positions, shifts);
    const isDuplicate = storage.isDuplicateCheck(checksum);

    if (isDuplicate) {
      console.log('⚡ 检测到重复扫描（幂等性校验通过）');
      console.log('   相同数据已检查过，跳过重复处理');
      
      const checkRecord = new CheckRecord({
        inputFiles: [
          fs.existsSync(gateFile) ? 'gate_system.json' : null,
          fs.existsSync(yardFile) ? 'yard_inventory.json' : null,
          fs.existsSync(tallyFile) ? 'tally_records.json' : null,
        ].filter(Boolean),
        checksum,
        totalContainers: new Set(positions.map(p => p.containerNo)).size,
        conflicts: [],
        isDuplicate: true,
      });
      
      storage.saveCheckRecord(checkRecord);
      console.log('');
      console.log('✅ 检查完成（幂等）');
      return;
    }

    console.log('🧪 执行校验规则:');
    console.log('   ✓ 堆场坐标格式校验');
    console.log('   ✓ 箱位占用校验');
    console.log('   ✓ 多源数据一致性校验');
    console.log('   ✓ 移位链完整性校验');
    console.log('');

    const conflicts = validator.validateAll(positions, shifts);

    const containerSet = new Set();
    for (const pos of positions) {
      containerSet.add(pos.containerNo);
    }

    const checkRecord = new CheckRecord({
      inputFiles: [
        fs.existsSync(gateFile) ? 'gate_system.json' : null,
        fs.existsSync(yardFile) ? 'yard_inventory.json' : null,
        fs.existsSync(tallyFile) ? 'tally_records.json' : null,
      ].filter(Boolean),
      checksum,
      totalContainers: containerSet.size,
      conflicts,
    });

    storage.saveCheckRecord(checkRecord);
    storage.saveConflicts(conflicts);
    storage.saveChecksum(checksum);

    if (conflicts.length === 0) {
      console.log('✅ 所有数据一致，未发现冲突');
    } else {
      console.log(`⚠️  发现 ${conflicts.length} 个冲突:`);
      console.log('');
      
      const grouped = {};
      for (const c of conflicts) {
        if (!grouped[c.type]) grouped[c.type] = [];
        grouped[c.type].push(c);
      }

      for (const [type, items] of Object.entries(grouped)) {
        const typeName = TYPE_NAMES[type] || type;
        console.log(`  ${typeName}: ${items.length} 项`);
      }

      console.log('');
      console.log('下一步:');
      console.log('  yardc review          查看待复核清单');
      console.log('  yardc export --dir=./out  导出详细报告');
    }
  }

  history(options) {
    const limit = parseInt(this.parseOption(options, 'limit') || '10', 10);
    const storage = new Storage(this.workspace);
    const history = storage.getHistory(limit);

    if (history.length === 0) {
      console.log('暂无检查历史');
      return;
    }

    console.log('📜 检查历史（最近 %d 条）', history.length);
    console.log('');
    console.log('| 时间 | 检查ID | 集装箱数 | 冲突数 | 重复扫描 |');
    console.log('|------|--------|----------|--------|----------|');

    for (const rec of history) {
      const time = new Date(rec.timestamp).toLocaleString();
      const id = rec.id.substring(0, 15) + '...';
      const duplicate = rec.isDuplicate ? '是 (⚡)' : '否';
      console.log(`| ${time} | ${id} | ${rec.totalContainers} | ${rec.conflicts.length} | ${duplicate} |`);
    }
  }

  review(options) {
    const type = this.parseOption(options, 'type');
    const storage = new Storage(this.workspace);
    let conflicts = storage.getPendingConflicts();

    if (type) {
      conflicts = conflicts.filter(c => c.type === type);
    }

    if (conflicts.length === 0) {
      console.log('✅ 暂无待复核冲突');
      return;
    }

    console.log('📋 待复核冲突清单');
    console.log('');

    for (let i = 0; i < conflicts.length; i++) {
      const c = conflicts[i];
      const typeName = TYPE_NAMES[c.type] || c.type;
      
      console.log(`[${i + 1}] ${c.containerNo}`);
      console.log(`    类型: ${typeName} (${c.type})`);
      console.log(`    严重程度: ${this.severityColor(c.severity)}`);
      console.log(`    描述: ${c.description}`);
      console.log(`    影响箱位: ${c.affectedPositions.join(', ')}`);
      console.log(`    冲突ID: ${c.id}`);
      
      if (c.sourceRecords && c.sourceRecords.length > 0) {
        console.log(`    来源记录:`);
        for (const rec of c.sourceRecords) {
          const pos = rec.position || `${rec.from || '?'} → ${rec.to || '?'}`;
          console.log(`      - ${rec.source}: ${pos}`);
        }
      }
      console.log('');
    }

    console.log('下一步:');
    console.log('  yardc resolve --id=<冲突ID> --resolution="<处理方案>"');
  }

  resolve(options) {
    const id = this.parseOption(options, 'id');
    const resolution = this.parseOption(options, 'resolution');

    if (!id) {
      console.log('❌ 请指定冲突ID: --id=<id>');
      process.exit(1);
    }

    if (!resolution) {
      console.log('❌ 请指定处理方案: --resolution="<描述>"');
      process.exit(1);
    }

    const storage = new Storage(this.workspace);
    const success = storage.updateConflictStatus(id, 'resolved', resolution);

    if (success) {
      console.log(`✅ 冲突已标记为已解决: ${id}`);
      console.log(`   处理方案: ${resolution}`);
    } else {
      console.log(`❌ 未找到冲突: ${id}`);
    }
  }

  export(options) {
    const dir = this.parseOption(options, 'dir');

    if (!dir) {
      console.log('❌ 请指定输出目录: --dir=<path>');
      process.exit(1);
    }

    const storage = new Storage(this.workspace);
    const exporter = new Exporter(storage);

    const latestCheck = storage.getLatestCheck();
    if (!latestCheck) {
      console.log('❌ 暂无检查记录，请先运行: yardc check');
      process.exit(1);
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const { jsonPath, mdPath, anomalyPath } = exporter.exportExceptionReport(latestCheck, dir);

    console.log('📤 导出完成:');
    console.log(`   JSON报告: ${jsonPath}`);
    console.log(`   Markdown报告: ${mdPath}`);
    console.log(`   异常清单: ${anomalyPath}`);
  }

  anomalies() {
    const storage = new Storage(this.workspace);
    const exporter = new Exporter(storage);

    const outputPath = path.join(this.workspace, `anomalies-${Date.now()}.json`);
    const path1 = exporter.exportAnomalyList(outputPath);

    const pending = storage.getPendingConflicts();

    if (pending.length === 0) {
      console.log('✅ 暂无待处理异常');
    } else {
      console.log(`⚠️  待处理异常: ${pending.length} 项`);
    }
    console.log(`   异常清单已导出: ${path1}`);
  }

  parseOption(options, name) {
    const prefix = `--${name}=`;
    for (const opt of options) {
      if (opt.startsWith(prefix)) {
        return opt.substring(prefix.length);
      }
    }
    return null;
  }

  severityColor(severity) {
    const colors = {
      critical: '🔴 critical',
      high: '🟠 high',
      medium: '🟡 medium',
      low: '🟢 low',
    };
    return colors[severity] || severity;
  }
}

module.exports = CLI;
