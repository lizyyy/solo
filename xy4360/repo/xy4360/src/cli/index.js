#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');

const RFCheckerModel = require('../db/jsonModel');
const DataImporter = require('../services/dataImporter');
const FrequencyChecker = require('../services/frequencyChecker');
const config = require('../config');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

program
  .name('rf-check')
  .description('无线麦频点预检工具 - 用于演出前检测频点冲突、互调干扰等问题')
  .version(config.app.version);

program
  .command('init')
  .description('初始化数据库')
  .action(() => {
    const model = new RFCheckerModel();
    model.close();
    console.log('初始化完成！数据将存储在 JSON 文件中');
  });

program
  .command('import <csvFile>')
  .description('导入频点CSV文件')
  .option('-b, --bands <jsonFile>', '禁用频段JSON文件路径')
  .option('-n, --name <sessionName>', '会话名称', '新导入会话')
  .option('-d, --description <desc>', '会话描述')
  .option('-c, --check', '导入后立即执行检测')
  .action(async (csvFile, options) => {
    const model = new RFCheckerModel();
    const importer = new DataImporter();
    const freqChecker = new FrequencyChecker();

    try {
      const { devices, frequencies } = await importer.importFrequenciesFromCsv(csvFile);
      
      let forbiddenBands = [];
      if (options.bands) {
        forbiddenBands = importer.importForbiddenBandsFromJson(options.bands);
        console.log(`已导入 ${forbiddenBands.length} 个禁用频段`);
      }

      const sessionId = model.createSession(
        options.name,
        options.description || `导入自 ${path.basename(csvFile)}`
      );

      const deviceIdMap = new Map();
      devices.forEach(device => {
        const deviceId = model.createDevice(sessionId, device);
        deviceIdMap.set(device.name, deviceId);
      });

      const freqIdMap = new Map();
      frequencies.forEach(freq => {
        const deviceId = deviceIdMap.get(freq.device_name);
        const freqId = model.createFrequency(sessionId, deviceId, freq);
        freqIdMap.set(`${freq.device_name}_${freq.frequency}`, freqId);
      });

      forbiddenBands.forEach(band => {
        model.createForbiddenBand(sessionId, band);
      });

      console.log(`\n导入成功!`);
      console.log(`会话ID: ${sessionId}`);
      console.log(`设备数量: ${devices.length}`);
      console.log(`频点数量: ${frequencies.length}`);

      if (options.check) {
        console.log('\n执行频点检测...');
        const allFreqs = model.getFrequencies(sessionId);
        const allBands = model.getForbiddenBands(sessionId);
        const conflicts = freqChecker.checkAll(allFreqs, allBands);

        conflicts.forEach(conflict => {
          model.createConflict(sessionId, conflict);
        });

        const critical = conflicts.filter(c => c.severity === 'critical').length;
        const high = conflicts.filter(c => c.severity === 'high').length;
        const medium = conflicts.filter(c => c.severity === 'medium').length;
        const low = conflicts.filter(c => c.severity === 'low').length;

        console.log(`\n检测结果:`);
        console.log(`  严重问题: ${critical}`);
        console.log(`  高危问题: ${high}`);
        console.log(`  中等问题: ${medium}`);
        console.log(`  轻微问题: ${low}`);

        if (conflicts.length > 0) {
          console.log(`\n请使用 'rf-check list' 查看详细冲突信息，或 'rf-check server' 启动Web界面`);
        }
      }

      model.close();
    } catch (error) {
      console.error('导入失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('check <sessionId>')
  .description('对指定会话执行频点检测')
  .action((sessionId) => {
    const model = new RFCheckerModel();
    const freqChecker = new FrequencyChecker();

    try {
      const session = model.getSession(sessionId);
      if (!session) {
        console.error(`会话 ${sessionId} 不存在`);
        process.exit(1);
      }

      const frequencies = model.getFrequencies(sessionId);
      const forbiddenBands = model.getForbiddenBands(sessionId);

      console.log(`检测会话: ${session.name}`);
      console.log(`频点数量: ${frequencies.length}`);
      console.log(`禁用频段: ${forbiddenBands.length}\n`);

      const conflicts = freqChecker.checkAll(frequencies, forbiddenBands);

      conflicts.forEach(conflict => {
        model.createConflict(sessionId, conflict);
      });

      const critical = conflicts.filter(c => c.severity === 'critical').length;
      const high = conflicts.filter(c => c.severity === 'high').length;
      const medium = conflicts.filter(c => c.severity === 'medium').length;
      const low = conflicts.filter(c => c.severity === 'low').length;

      console.log(`检测结果摘要:`);
      console.log(`  严重问题: ${critical}`);
      console.log(`  高危问题: ${high}`);
      console.log(`  中等问题: ${medium}`);
      console.log(`  轻微问题: ${low}`);

      if (conflicts.length > 0) {
        console.log(`\n问题详情:`);
        conflicts.forEach((conflict, index) => {
          const severityColor = {
            'critical': '\x1b[31m',
            'high': '\x1b[33m',
            'medium': '\x1b[36m',
            'low': '\x1b[90m'
          };
          const reset = '\x1b[0m';
          
          console.log(`\n${severityColor[conflict.severity]}[${freqChecker.getSeverityLabel(conflict.severity)}] ${freqChecker.getConflictTypeLabel(conflict.type)}${reset}`);
          console.log(`  ${conflict.details}`);
        });
      }

      model.close();
    } catch (error) {
      console.error('检测失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出所有会话')
  .action(() => {
    const model = new RFCheckerModel();
    const sessions = model.getAllSessions();

    if (sessions.length === 0) {
      console.log('没有找到会话。使用 "rf-check import" 导入数据。');
    } else {
      console.log('会话列表:\n');
      sessions.forEach(session => {
        const freqs = model.getFrequencies(session.id);
        const conflicts = model.getConflicts(session.id);
        const pendingConflicts = conflicts.filter(c => c.status === 'pending').length;

        console.log(`ID: ${session.id}`);
        console.log(`  名称: ${session.name}`);
        console.log(`  描述: ${session.description || '-'}`);
        console.log(`  频点: ${freqs.length}`);
        console.log(`  待处理冲突: ${pendingConflicts}`);
        console.log(`  创建时间: ${session.created_at}`);
        console.log('');
      });
    }

    model.close();
  });

program
  .command('server')
  .description('启动Web服务器')
  .option('-p, --port <port>', '端口号', config.app.port.toString())
  .action((options) => {
    const port = parseInt(options.port) || config.app.port;
    process.env.PORT = port;
    
    console.log(`启动Web服务器在端口 ${port}...`);
    console.log(`访问 http://localhost:${port}`);
    
    require('../server/index');
  });

program
  .command('delete <sessionId>')
  .description('删除指定会话')
  .action((sessionId) => {
    const model = new RFCheckerModel();
    const session = model.getSession(sessionId);
    
    if (!session) {
      console.error(`会话 ${sessionId} 不存在`);
      process.exit(1);
    }

    model.deleteSession(sessionId);
    console.log(`已删除会话: ${session.name} (ID: ${sessionId})`);
    model.close();
  });

program.parse(process.argv);
