const { ensureDir } = require('../utils/fs');
const { getDataDir, getConfigDir } = require('../utils/path');
const ConfigStore = require('../storage/configStore');
const TopicStore = require('../storage/topicStore');

async function initCommand(options = {}) {
  console.log('正在初始化消息投递模拟器...');

  ensureDir(getDataDir());
  ensureDir(getConfigDir());

  const configStore = new ConfigStore();
  const topicStore = new TopicStore();

  if (configStore.isInitialized() && !options.force) {
    console.log('模拟器已初始化，使用 --force 参数强制重新初始化');
    return;
  }

  configStore.markInitialized();
  topicStore.initDefault();

  console.log('');
  console.log('✅ 初始化完成！');
  console.log('');
  console.log('默认主题已创建:');
  topicStore.getAll().forEach(topic => {
    console.log(`  • ${topic.name} - ${topic.description}`);
  });
  console.log('');
  console.log('下一步:');
  console.log('  1. 查看帮助: mq-sim --help');
  console.log('  2. 运行示例: mq-sim run --demo');
}

module.exports = initCommand;
