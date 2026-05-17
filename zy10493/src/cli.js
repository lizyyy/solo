#!/usr/bin/env node

const { parseArgs } = require('./args');
const { JsonlReader } = require('./reader');
const { SessionStitcher } = require('./stitcher');
const { OutputWriter } = require('./writer');
const { StitcherError, logger } = require('./utils');

async function main() {
  try {
    const config = parseArgs(process.argv);

    if (config.dryRun) {
      logger.info('🔍 Dry-run 模式，仅执行校验不输出文件');
    }

    logger.info('📖 开始读取和解析JSONL文件...');
    const reader = new JsonlReader(config);
    const events = await reader.readAllFiles();

    if (events.length === 0) {
      logger.warn('未找到有效事件，请检查输入文件和字段配置');
      return;
    }

    logger.info('🔗 开始会话缝合处理...');
    const stitcher = new SessionStitcher(config);
    const sessions = stitcher.processEvents(events);

    if (!config.dryRun) {
      logger.info('📝 开始输出结果文件...');
      const writer = new OutputWriter(
        config,
        reader.getStats(),
        stitcher.getStats(),
        reader.getInvalidEvents(),
        stitcher.getGapDetails()
      );
      await writer.writeAll(sessions);
    } else {
      logger.success('Dry-run 完成！');
      const stats = reader.getStats();
      const stitchStats = stitcher.getStats();
      console.log(`
  📊 校验结果:
  - 输入文件: ${stats.totalFiles} 个
  - 有效事件: ${stats.validEvents} 个
  - 无效事件: ${stats.invalidEvents} 个
  - 用户数量: ${stitchStats.totalUsers} 个
  - 会话数量: ${sessions.length} 个
      `);
    }

  } catch (err) {
    if (err instanceof StitcherError) {
      logger.error(`错误: ${err.message}`, err);
      if (Object.keys(err.details).length > 0) {
        console.error('详情:', err.details);
      }
    } else {
      logger.error('未预期的错误:', err);
    }
    process.exit(1);
  }
}

main();