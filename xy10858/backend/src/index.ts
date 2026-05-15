import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { initDatabase } from './database';
import { createSynonymGroup, updateSynonymGroupStatus, addTestQuery, createPublishBatch, updateBatchStatus, executePublish, rollbackBatch } from './services';
import routes from './routes';

const app = express();
const PORT = 3001;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

function initSampleData() {
  try {
    const group1 = createSynonymGroup({
      name: '手机类同义词',
      synonyms: ['手机', '智能手机', '移动电话', '手持设备'],
      application_scope: '全站搜索',
      description: '覆盖手机相关的搜索词扩展'
    });

    addTestQuery(group1.id, '苹果手机', 50);
    addTestQuery(group1.id, '华为智能手机', 30);
    addTestQuery(group1.id, '移动电话套餐', 20);

    updateSynonymGroupStatus(group1.id, 'pending_review', '提交审批');
    updateSynonymGroupStatus(group1.id, 'approved', '审批通过');

    const group2 = createSynonymGroup({
      name: '电脑类同义词',
      synonyms: ['电脑', '计算机', 'PC', '个人电脑'],
      application_scope: '分类页搜索',
      description: '电脑相关同义词扩展'
    });

    addTestQuery(group2.id, '笔记本电脑', 40);
    addTestQuery(group2.id, '台式计算机', 25);
    addTestQuery(group2.id, 'PC游戏', 35);

    updateSynonymGroupStatus(group2.id, 'pending_review', '提交审批');
    updateSynonymGroupStatus(group2.id, 'approved', '审批通过');

    const group3 = createSynonymGroup({
      name: '服装类同义词',
      synonyms: ['衣服', '服装', '服饰', '穿戴'],
      application_scope: '商品搜索',
      description: '服装类同义词，用于测试拦截流'
    });

    addTestQuery(group3.id, '夏季衣服', 100);
    addTestQuery(group3.id, '运动服装', 80);

    updateSynonymGroupStatus(group3.id, 'pending_review', '提交审批');
    updateSynonymGroupStatus(group3.id, 'rejected', '同义词覆盖范围不足，需要扩展');

    const batch1 = createPublishBatch({
      name: '2024年第一季度同义词发布',
      groupIds: [group1.id, group2.id],
      description: '包含手机和电脑类同义词'
    });

    updateBatchStatus(batch1.id, 'reviewing', '开始复核');
    updateBatchStatus(batch1.id, 'approved', '复核通过');
    executePublish(batch1.id);

    const batch2 = createPublishBatch({
      name: '2024年第二季度同义词发布-测试',
      groupIds: [group1.id],
      description: '测试回滚功能'
    });

    updateBatchStatus(batch2.id, 'reviewing', '开始复核');
    updateBatchStatus(batch2.id, 'approved', '复核通过');
    executePublish(batch2.id);
    setTimeout(() => {
      rollbackBatch(batch2.id, '发现搜索结果相关性下降，需要优化');
    }, 100);

    console.log('示例数据初始化完成');
  } catch (error) {
    console.log('示例数据可能已存在，跳过初始化');
  }
}

app.listen(PORT, () => {
  console.log(`同义词发布台后端服务启动成功`);
  console.log(`API 地址: http://localhost:${PORT}/api`);
  initDatabase();
  initSampleData();
});
