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

async function initSampleData() {
  try {
    const group1 = await createSynonymGroup({
      name: '手机类同义词',
      synonyms: ['手机', '智能手机', '移动电话', '手持设备'],
      application_scope: '全站搜索',
      description: '覆盖手机相关的搜索词扩展'
    });

    await addTestQuery(group1.id, '苹果手机', 50);
    await addTestQuery(group1.id, '华为智能手机', 30);
    await addTestQuery(group1.id, '移动电话套餐', 20);

    await updateSynonymGroupStatus(group1.id, 'pending_review', '提交审批');
    await updateSynonymGroupStatus(group1.id, 'approved', '审批通过');

    const group2 = await createSynonymGroup({
      name: '电脑类同义词',
      synonyms: ['电脑', '计算机', 'PC', '个人电脑'],
      application_scope: '分类页搜索',
      description: '电脑相关同义词扩展'
    });

    await addTestQuery(group2.id, '笔记本电脑', 40);
    await addTestQuery(group2.id, '台式计算机', 25);
    await addTestQuery(group2.id, 'PC游戏', 35);

    await updateSynonymGroupStatus(group2.id, 'pending_review', '提交审批');
    await updateSynonymGroupStatus(group2.id, 'approved', '审批通过');

    const group3 = await createSynonymGroup({
      name: '服装类同义词',
      synonyms: ['衣服', '服装', '服饰', '穿戴'],
      application_scope: '商品搜索',
      description: '服装类同义词，已驳回'
    });

    await addTestQuery(group3.id, '夏季衣服', 100);
    await addTestQuery(group3.id, '运动服装', 80);

    await updateSynonymGroupStatus(group3.id, 'pending_review', '提交审批');
    await updateSynonymGroupStatus(group3.id, 'rejected', '同义词覆盖范围不足，需要扩展');

    const group4 = await createSynonymGroup({
      name: '耳机类同义词',
      synonyms: ['耳机', '耳塞', '耳麦', '头戴式耳机'],
      application_scope: '电子产品搜索',
      description: '耳机类同义词，用于回滚测试'
    });

    await addTestQuery(group4.id, '无线耳机', 60);
    await addTestQuery(group4.id, '蓝牙耳机', 45);

    await updateSynonymGroupStatus(group4.id, 'pending_review', '提交审批');
    await updateSynonymGroupStatus(group4.id, 'approved', '审批通过');

    const group5 = await createSynonymGroup({
      name: '手表类同义词',
      synonyms: ['手表', '腕表', '钟表', '智能手表'],
      application_scope: '穿戴设备搜索',
      description: '手表类同义词，用于拦截测试'
    });

    await addTestQuery(group5.id, '机械手表', 55);
    await addTestQuery(group5.id, '智能手表', 70);

    await updateSynonymGroupStatus(group5.id, 'pending_review', '提交审批');
    await updateSynonymGroupStatus(group5.id, 'approved', '审批通过');

    const batch1 = await createPublishBatch({
      name: '2024年第一季度同义词发布',
      groupIds: [group1.id, group2.id],
      description: '包含手机和电脑类同义词 - 正常发布'
    });

    await updateBatchStatus(batch1.id, 'reviewing', '开始复核');
    await updateBatchStatus(batch1.id, 'approved', '复核通过');
    await executePublish(batch1.id);

    const batch2 = await createPublishBatch({
      name: '2024年第二季度同义词发布-回滚测试',
      groupIds: [group4.id],
      description: '耳机类同义词 - 测试回滚功能'
    });

    await updateBatchStatus(batch2.id, 'reviewing', '开始复核');
    await updateBatchStatus(batch2.id, 'approved', '复核通过');
    await executePublish(batch2.id);
    await setTimeout(async () => {
      await rollbackBatch(batch2.id, '发现搜索结果相关性下降，需要优化同义词配置');
    }, 100);

    const batch3 = await createPublishBatch({
      name: '2024年第三季度同义词发布-拦截测试',
      groupIds: [group5.id],
      description: '手表类同义词 - 命中下降将触发拦截'
    });

    await updateBatchStatus(batch3.id, 'reviewing', '开始复核');
    await updateBatchStatus(batch3.id, 'approved', '复核通过');

    console.log('示例数据初始化完成');
    console.log('- 批次1: 正常发布 (手机+电脑)');
    console.log('- 批次2: 发布后回滚 (耳机)');
    console.log('- 批次3: 待模拟发布，命中会触发拦截 (手表)');
  } catch (error: any) {
    if (error.message?.includes('已存在')) {
      console.log('示例数据可能已存在，跳过初始化');
    } else {
      console.log('示例数据初始化跳过:', error.message);
    }
  }
}

async function startServer() {
  try {
    await initDatabase();
    await initSampleData();

    app.listen(PORT, () => {
      console.log(`同义词发布台后端服务启动成功`);
      console.log(`API 地址: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
