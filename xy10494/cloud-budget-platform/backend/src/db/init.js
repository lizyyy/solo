require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  sequelize,
  User,
  Project,
  TagRule,
  SharedService,
  AllocationRatio,
  BillImport,
  BillRecord,
  SharedAllocation,
  ManualAssignment,
  BudgetAlert,
  Anomaly,
} = require('./models');

async function initDatabase() {
  try {
    console.log('开始初始化数据库...');
    
    await sequelize.authenticate();
    console.log('数据库连接成功');

    await sequelize.sync({ force: true });
    console.log('数据库表创建成功');

    console.log('创建默认用户...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await User.create({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      fullName: '系统管理员',
      role: 'admin',
      isActive: true,
    });

    const finance = await User.create({
      username: 'finance',
      password: hashedPassword,
      email: 'finance@example.com',
      fullName: '财务专员',
      role: 'finance',
      isActive: true,
    });

    const developer = await User.create({
      username: 'developer',
      password: hashedPassword,
      email: 'dev@example.com',
      fullName: '开发人员',
      role: 'developer',
      isActive: true,
    });

    console.log('创建示例项目...');
    const projectA = await Project.create({
      name: '电商平台',
      code: 'ECOM-001',
      description: '主电商平台项目',
      budgetAmount: 100000,
      budgetPeriod: 'monthly',
      ownerId: developer.id,
      isActive: true,
    });

    const projectB = await Project.create({
      name: '数据分析平台',
      code: 'DATA-001',
      description: '大数据分析平台',
      budgetAmount: 50000,
      budgetPeriod: 'monthly',
      ownerId: developer.id,
      isActive: true,
    });

    const projectC = await Project.create({
      name: 'CRM系统',
      code: 'CRM-001',
      description: '客户关系管理系统',
      budgetAmount: 30000,
      budgetPeriod: 'monthly',
      ownerId: developer.id,
      isActive: true,
    });

    console.log('创建标签规则...');
    await TagRule.bulkCreate([
      {
        projectId: projectA.id,
        tagKey: 'Project',
        tagValue: 'ecommerce',
        matchType: 'exact',
        priority: 10,
        isActive: true,
      },
      {
        projectId: projectA.id,
        tagKey: 'Service',
        tagValue: 'ecom',
        matchType: 'contains',
        priority: 5,
        isActive: true,
      },
      {
        projectId: projectB.id,
        tagKey: 'Project',
        tagValue: 'dataplatform',
        matchType: 'exact',
        priority: 10,
        isActive: true,
      },
      {
        projectId: projectC.id,
        tagKey: 'Project',
        tagValue: 'crm',
        matchType: 'exact',
        priority: 10,
        isActive: true,
      },
    ]);

    console.log('创建共享服务...');
    const gatewayService = await SharedService.create({
      name: '公共API网关',
      code: 'API-GATEWAY',
      description: '全公司公共API网关服务',
      tagKey: 'Service',
      tagValue: 'gateway',
      isActive: true,
    });

    const monitorService = await SharedService.create({
      name: '监控告警系统',
      code: 'MONITOR',
      description: '统一监控告警平台',
      tagKey: 'Service',
      tagValue: 'monitor',
      isActive: true,
    });

    console.log('创建分摊比例...');
    const currentMonth = new Date().toISOString().slice(0, 7);
    await AllocationRatio.bulkCreate([
      {
        sharedServiceId: gatewayService.id,
        projectId: projectA.id,
        ratio: 0.5,
        effectiveMonth: currentMonth,
        isActive: true,
      },
      {
        sharedServiceId: gatewayService.id,
        projectId: projectB.id,
        ratio: 0.3,
        effectiveMonth: currentMonth,
        isActive: true,
      },
      {
        sharedServiceId: gatewayService.id,
        projectId: projectC.id,
        ratio: 0.2,
        effectiveMonth: currentMonth,
        isActive: true,
      },
      {
        sharedServiceId: monitorService.id,
        projectId: projectA.id,
        ratio: 0.4,
        effectiveMonth: currentMonth,
        isActive: true,
      },
      {
        sharedServiceId: monitorService.id,
        projectId: projectB.id,
        ratio: 0.35,
        effectiveMonth: currentMonth,
        isActive: true,
      },
      {
        sharedServiceId: monitorService.id,
        projectId: projectC.id,
        ratio: 0.25,
        effectiveMonth: currentMonth,
        isActive: true,
      },
    ]);

    console.log('创建示例账单数据...');
    const billImport = await BillImport.create({
      fileName: 'sample_bill_2026-04.csv',
      fileHash: 'sample_hash_12345',
      billMonth: '2026-04',
      cloudProvider: 'aliyun',
      totalRecords: 15,
      totalAmount: 125000,
      status: 'completed',
      importedBy: admin.id,
    });

    const sampleRecords = [
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'ecs-001',
        resourceName: '电商平台-生产-主服务器',
        resourceType: 'ECS',
        productCode: 'ecs',
        productName: '云服务器ECS',
        region: 'cn-hangzhou',
        usageAmount: 730,
        usageUnit: '小时',
        costAmount: 35000,
        tags: { Project: 'ecommerce', Environment: 'production' },
        allocationMethod: 'auto_tag',
        environment: 'production',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'ecs-002',
        resourceName: '电商平台-测试-服务器',
        resourceType: 'ECS',
        productCode: 'ecs',
        productName: '云服务器ECS',
        region: 'cn-hangzhou',
        usageAmount: 730,
        usageUnit: '小时',
        costAmount: 8000,
        tags: { Project: 'ecommerce', Environment: 'test' },
        allocationMethod: 'auto_tag',
        environment: 'test',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'rds-001',
        resourceName: '电商平台-生产-数据库',
        resourceType: 'RDS',
        productCode: 'rds',
        productName: '云数据库RDS',
        region: 'cn-hangzhou',
        usageAmount: 730,
        usageUnit: '小时',
        costAmount: 28000,
        tags: { Project: 'ecommerce', Environment: 'production' },
        allocationMethod: 'auto_tag',
        environment: 'production',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'oss-001',
        resourceName: '数据平台-生产-存储',
        resourceType: 'OSS',
        productCode: 'oss',
        productName: '对象存储OSS',
        region: 'cn-shanghai',
        usageAmount: 5000,
        usageUnit: 'GB',
        costAmount: 15000,
        tags: { Project: 'dataplatform', Environment: 'production' },
        allocationMethod: 'auto_tag',
        environment: 'production',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'emr-001',
        resourceName: '数据平台-生产-计算集群',
        resourceType: 'EMR',
        productCode: 'emr',
        productName: 'E-MapReduce',
        region: 'cn-shanghai',
        usageAmount: 500,
        usageUnit: '小时',
        costAmount: 12000,
        tags: { Project: 'dataplatform', Environment: 'production' },
        allocationMethod: 'auto_tag',
        environment: 'production',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'ecs-003',
        resourceName: '数据平台-测试-服务器',
        resourceType: 'ECS',
        productCode: 'ecs',
        productName: '云服务器ECS',
        region: 'cn-shanghai',
        usageAmount: 730,
        usageUnit: '小时',
        costAmount: 5000,
        tags: { Project: 'dataplatform', Environment: 'test' },
        allocationMethod: 'auto_tag',
        environment: 'test',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'slb-001',
        resourceName: 'CRM-生产-负载均衡',
        resourceType: 'SLB',
        productCode: 'slb',
        productName: '负载均衡SLB',
        region: 'cn-beijing',
        usageAmount: 730,
        usageUnit: '小时',
        costAmount: 4500,
        tags: { Project: 'crm', Environment: 'production' },
        allocationMethod: 'auto_tag',
        environment: 'production',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'ecs-004',
        resourceName: '未知服务器-未打标签',
        resourceType: 'ECS',
        productCode: 'ecs',
        productName: '云服务器ECS',
        region: 'cn-hangzhou',
        usageAmount: 730,
        usageUnit: '小时',
        costAmount: 6000,
        tags: null,
        allocationMethod: 'unallocated',
        environment: null,
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'ecs-005',
        resourceName: '测试服务器-无项目标签',
        resourceType: 'ECS',
        productCode: 'ecs',
        productName: '云服务器ECS',
        region: 'cn-hangzhou',
        usageAmount: 365,
        usageUnit: '小时',
        costAmount: 2500,
        tags: { Environment: 'test' },
        allocationMethod: 'unallocated',
        environment: 'test',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'slb-002',
        resourceName: '公共网关-生产-入口',
        resourceType: 'SLB',
        productCode: 'slb',
        productName: '负载均衡SLB',
        region: 'cn-hangzhou',
        usageAmount: 730,
        usageUnit: '小时',
        costAmount: 5000,
        tags: { Service: 'gateway', Environment: 'production' },
        allocationMethod: 'shared_service',
        sharedServiceId: gatewayService.id,
        environment: 'production',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'cdn-001',
        resourceName: '公共网关-CDN',
        resourceType: 'CDN',
        productCode: 'cdn',
        productName: '内容分发CDN',
        region: 'cn-hangzhou',
        usageAmount: 10000,
        usageUnit: 'GB',
        costAmount: 3000,
        tags: { Service: 'gateway', Environment: 'production' },
        allocationMethod: 'shared_service',
        sharedServiceId: gatewayService.id,
        environment: 'production',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'prometheus-001',
        resourceName: '监控系统-生产',
        resourceType: 'ECS',
        productCode: 'ecs',
        productName: '云服务器ECS',
        region: 'cn-hangzhou',
        usageAmount: 730,
        usageUnit: '小时',
        costAmount: 4000,
        tags: { Service: 'monitor', Environment: 'production' },
        allocationMethod: 'shared_service',
        sharedServiceId: monitorService.id,
        environment: 'production',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'ecs-006',
        resourceName: '新服务-测试环境',
        resourceType: 'ECS',
        productCode: 'ecs',
        productName: '云服务器ECS',
        region: 'cn-shenzhen',
        usageAmount: 200,
        usageUnit: '小时',
        costAmount: 2000,
        tags: { Project: 'ecommerce', Service: 'ecom', Environment: 'test' },
        allocationMethod: 'unallocated',
        environment: 'test',
      },
      {
        billImportId: billImport.id,
        billMonth: '2026-04',
        resourceId: 'conflict-001',
        resourceName: '冲突资源',
        resourceType: 'ECS',
        productCode: 'ecs',
        productName: '云服务器ECS',
        region: 'cn-hangzhou',
        usageAmount: 100,
        usageUnit: '小时',
        costAmount: 1000,
        tags: { Project: 'ecommerce,dataplatform' },
        allocationMethod: 'unallocated',
        environment: null,
      },
    ];

    const createdRecords = await BillRecord.bulkCreate(sampleRecords, { returning: true });

    console.log('创建共享服务分摊记录...');
    const gatewayRecords = createdRecords.filter(r => r.sharedServiceId === gatewayService.id);
    const monitorRecords = createdRecords.filter(r => r.sharedServiceId === monitorService.id);

    const allocations = [];
    gatewayRecords.forEach(record => {
      const total = parseFloat(record.costAmount);
      allocations.push(
        {
          billRecordId: record.id,
          sharedServiceId: gatewayService.id,
          projectId: projectA.id,
          ratio: 0.5,
          allocatedAmount: total * 0.5,
          billMonth: '2026-04',
        },
        {
          billRecordId: record.id,
          sharedServiceId: gatewayService.id,
          projectId: projectB.id,
          ratio: 0.3,
          allocatedAmount: total * 0.3,
          billMonth: '2026-04',
        },
        {
          billRecordId: record.id,
          sharedServiceId: gatewayService.id,
          projectId: projectC.id,
          ratio: 0.2,
          allocatedAmount: total * 0.2,
          billMonth: '2026-04',
        }
      );
    });

    monitorRecords.forEach(record => {
      const total = parseFloat(record.costAmount);
      allocations.push(
        {
          billRecordId: record.id,
          sharedServiceId: monitorService.id,
          projectId: projectA.id,
          ratio: 0.4,
          allocatedAmount: total * 0.4,
          billMonth: '2026-04',
        },
        {
          billRecordId: record.id,
          sharedServiceId: monitorService.id,
          projectId: projectB.id,
          ratio: 0.35,
          allocatedAmount: total * 0.35,
          billMonth: '2026-04',
        },
        {
          billRecordId: record.id,
          sharedServiceId: monitorService.id,
          projectId: projectC.id,
          ratio: 0.25,
          allocatedAmount: total * 0.25,
          billMonth: '2026-04',
        }
      );
    });

    await SharedAllocation.bulkCreate(allocations);

    console.log('创建异常记录...');
    const noTagRecords = createdRecords.filter(r => !r.tags || Object.keys(r.tags).length === 0);
    const conflictRecord = createdRecords.find(r => r.resourceId === 'conflict-001');
    const unallocatedRecords = createdRecords.filter(r => r.allocationMethod === 'unallocated' && !r.tags?.Project);

    const anomalies = [];
    
    noTagRecords.forEach(record => {
      anomalies.push({
        anomalyType: 'no_tags',
        billImportId: billImport.id,
        billRecordId: record.id,
        billMonth: '2026-04',
        severity: 'high',
        status: 'open',
        description: `资源 ${record.resourceName} 没有任何标签`,
        details: {
          resourceId: record.resourceId,
          resourceName: record.resourceName,
          costAmount: record.costAmount,
        },
      });
    });

    if (conflictRecord) {
      anomalies.push({
        anomalyType: 'tag_conflict',
        billImportId: billImport.id,
        billRecordId: conflictRecord.id,
        billMonth: '2026-04',
        severity: 'medium',
        status: 'open',
        description: `资源 ${conflictRecord.resourceName} 存在标签冲突，多个项目标签`,
        details: {
          resourceId: conflictRecord.resourceId,
          conflictingTags: conflictRecord.tags,
          possibleProjects: ['电商平台', '数据分析平台'],
        },
      });
    }

    anomalies.push({
      anomalyType: 'allocation_ratio_invalid',
      sharedServiceId: gatewayService.id,
      billMonth: '2026-04',
      severity: 'low',
      status: 'open',
      description: '共享服务比例配置需要确认',
      details: {
        totalRatio: 1.0,
        message: '当前比例总和为1.0，但建议验证是否符合业务实际',
      },
    });

    await Anomaly.bulkCreate(anomalies);

    console.log('创建预算预警...');
    await BudgetAlert.create({
      projectId: projectA.id,
      alertType: 'threshold_70',
      alertMonth: '2026-04',
      budgetAmount: 100000,
      actualAmount: 75000,
      forecastAmount: 90000,
      isAcknowledged: false,
      message: '电商平台本月已使用预算75%，请注意控制成本',
    });

    console.log('数据库初始化完成！');
    console.log('默认账号: admin / admin123');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
