import { SamplingRule, Reviewer } from '../models';
import { SamplingMethod } from '../models/SamplingRule';

async function seed() {
  console.log('开始初始化数据...');

  const rules = await SamplingRule.bulkCreate([
    {
      name: '随机抽样规则',
      description: '从数据中随机抽取样本',
      method: SamplingMethod.RANDOM,
      sampleSize: 100,
      isActive: true,
      createdBy: 'system',
    },
    {
      name: '系统抽样规则',
      description: '按固定间隔抽取样本',
      method: SamplingMethod.SYSTEMATIC,
      sampleSize: 50,
      isActive: true,
      createdBy: 'system',
    },
    {
      name: '分层抽样规则',
      description: '按数据源分层抽样',
      method: SamplingMethod.STRATIFIED,
      sampleSize: 80,
      stratifyField: 'dataSource',
      isActive: true,
      createdBy: 'system',
    },
  ]);

  console.log(`已创建 ${rules.length} 个抽样规则`);

  const reviewers = await Reviewer.bulkCreate([
    {
      userId: 'reviewer_001',
      username: '张三',
      email: 'zhangsan@example.com',
      department: '质量部',
      isActive: true,
    },
    {
      userId: 'reviewer_002',
      username: '李四',
      email: 'lisi@example.com',
      department: '质量部',
      isActive: true,
    },
    {
      userId: 'reviewer_003',
      username: '王五',
      email: 'wangwu@example.com',
      department: '审核部',
      isActive: true,
    },
  ]);

  console.log(`已创建 ${reviewers.length} 个复核人`);
  console.log('数据初始化完成!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('初始化失败:', error);
  process.exit(1);
});
