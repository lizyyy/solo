const { projectService, annotatorService, taskPackageService } = require('../src/services');
const { STATUS } = require('../src/constants');

async function main() {
  console.log('开始造数...');

  const project1 = await projectService.create({ name: '图像标注项目' });
  console.log('创建项目:', project1.name);

  const annotator1 = await annotatorService.create({ name: '张三', email: 'zhangsan@example.com' });
  const annotator2 = await annotatorService.create({ name: '李四', email: 'lisi@example.com' });
  const annotator3 = await annotatorService.create({ name: '王五', email: 'wangwu@example.com' });
  console.log('创建标注员:', annotator1.name, annotator2.name, annotator3.name);

  const taskPackage1 = await taskPackageService.create({
    project_id: project1.id,
    name: '任务包 A-001',
    original_annotator_id: annotator1.id,
    status: STATUS.ANNOTATING
  });

  const taskPackage2 = await taskPackageService.create({
    project_id: project1.id,
    name: '任务包 A-002',
    original_annotator_id: annotator2.id,
    status: STATUS.PENDING_ASSIGN
  });
  console.log('创建任务包:', taskPackage1.name, taskPackage2.name);

  console.log('\n✅ 基础数据创建完成');
  console.log('项目 ID:', project1.id);
  console.log('标注员 1 (张三) ID:', annotator1.id);
  console.log('标注员 2 (李四) ID:', annotator2.id);
  console.log('标注员 3 (王五) ID:', annotator3.id);
  console.log('任务包 1 ID:', taskPackage1.id);
  console.log('任务包 2 ID:', taskPackage2.id);
  console.log('\n💡 提示: 记住这些 ID，用于后续的 API 调用测试');
}

main();
