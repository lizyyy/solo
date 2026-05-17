import { createProject } from '../services/projectService';
import { createMilestone } from '../services/milestoneService';
import { createExtensionRequest, reviewExtensionRequest } from '../services/extensionService';
import { closeDB } from '../db';

async function seed() {
  console.log('开始生成测试数据...');
  
  const projectId = await createProject({
    name: '云平台建设项目',
    code: 'CLOUD-2024',
    description: '企业级云平台基础建设'
  }, 'admin');
  console.log(`创建项目 ID: ${projectId}`);
  
  const parentId = await createMilestone({
    project_id: projectId,
    name: '一期工程交付',
    description: '云平台一期功能交付上线',
    planned_date: '2024-12-31',
    created_by: 'zhang.san'
  });
  console.log(`创建父里程碑 ID: ${parentId}`);
  
  const child1Id = await createMilestone({
    project_id: projectId,
    parent_id: parentId,
    name: '子任务1: 基础架构部署',
    description: '服务器、网络、存储部署',
    planned_date: '2024-11-15',
    created_by: 'li.si'
  });
  console.log(`创建子里程碑1 ID: ${child1Id}`);
  
  const child2Id = await createMilestone({
    project_id: projectId,
    parent_id: parentId,
    name: '子任务2: 应用部署',
    description: '核心业务应用部署',
    planned_date: '2024-12-01',
    created_by: 'wang.wu'
  });
  console.log(`创建子里程碑2 ID: ${child2Id}`);
  
  const extResult = await createExtensionRequest({
    milestone_id: parentId,
    requested_by: 'zhang.san',
    requested_date: '2025-01-31',
    reason: '受供应链影响，服务器到货延迟30天',
    impact_scope: '影响一期工程整体进度，所有子任务需相应延期'
  });
  
  if (extResult.success && extResult.id) {
    console.log(`创建延期申请 ID: ${extResult.id}`);
    
    await reviewExtensionRequest(
      extResult.id,
      'approved',
      'zhao.liu',
      '情况属实，同意延期，请各子任务同步调整'
    );
    console.log('审核延期申请: 已通过');
  }
  
  console.log('测试数据生成完成！');
  await closeDB();
}

seed().catch(console.error);
