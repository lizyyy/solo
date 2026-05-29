import { db } from '../db';
import type { Project, Dependency, DependencyFile, Waiver } from '../types';
import { generateId } from '../types';

const demoPackageJson = `{
  "name": "demo-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lodash": "^4.17.21",
    "axios": "^1.6.0",
    "express": "^4.18.2",
    "mongodb": "^6.2.0",
    "redis": "^4.6.10",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "moment": "^2.29.4",
    "crypto-js": "^4.2.0",
    "vue": "^3.3.8",
    "angular": "^1.8.3",
    "jquery": "^3.7.1"
  }
}`;

export async function seedDemoData() {
  const existingProjects = await db.projects.toArray();
  if (existingProjects.length > 0) {
    console.log('Demo data already exists, skipping seed');
    return;
  }

  const projectId = generateId();
  const project: Project = {
    id: projectId,
    name: '演示项目 - 电商系统',
    description: '电商平台前端项目，用于演示许可证合规审查流程',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now(),
  };

  await db.projects.add(project);

  const fileId = generateId();
  const depFile: DependencyFile = {
    id: fileId,
    projectId,
    fileName: 'package.json',
    fileType: 'package_json',
    fileSize: new Blob([demoPackageJson]).size,
    fileContent: demoPackageJson,
    uploadTime: Date.now() - 86400000 * 5,
    parseStatus: 'success',
    parsedCount: 14,
    parseError: undefined,
  };

  await db.dependencyFiles.add(depFile);

  const baseDeps: Omit<Dependency, 'id' | 'projectId'>[] = [
    {
      packageName: 'react',
      packageVersion: '18.2.0',
      license: 'MIT',
      repoUrl: 'https://github.com/facebook/react',
      status: 'approved',
      riskLevel: 'safe',
      riskScore: 5,
      riskFactors: ['permissive_license'],
      blockReasons: [],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 3,
      statusHistory: [
        { status: 'parsed_normal', timestamp: Date.now() - 86400000 * 5, operator: '系统', notes: '解析完成' },
        { status: 'pending_review', timestamp: Date.now() - 86400000 * 4, operator: '张三', notes: '提交审查' },
        { status: 'approved', timestamp: Date.now() - 86400000 * 3, operator: '李四', notes: 'MIT许可证，合规' },
      ],
    },
    {
      packageName: 'react-dom',
      packageVersion: '18.2.0',
      license: 'MIT',
      repoUrl: 'https://github.com/facebook/react',
      status: 'approved',
      riskLevel: 'safe',
      riskScore: 5,
      riskFactors: ['permissive_license'],
      blockReasons: [],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 3,
      statusHistory: [],
    },
    {
      packageName: 'lodash',
      packageVersion: '4.17.21',
      license: 'MIT',
      repoUrl: 'https://github.com/lodash/lodash',
      status: 'approved',
      riskLevel: 'safe',
      riskScore: 5,
      riskFactors: ['permissive_license'],
      blockReasons: [],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 3,
      statusHistory: [],
    },
    {
      packageName: 'axios',
      packageVersion: '1.6.0',
      license: 'MIT',
      repoUrl: 'https://github.com/axios/axios',
      status: 'approved',
      riskLevel: 'safe',
      riskScore: 5,
      riskFactors: ['permissive_license'],
      blockReasons: [],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 3,
      statusHistory: [],
    },
    {
      packageName: 'express',
      packageVersion: '4.18.2',
      license: 'MIT',
      repoUrl: 'https://github.com/expressjs/express',
      status: 'pending_review',
      riskLevel: 'safe',
      riskScore: 10,
      riskFactors: ['permissive_license'],
      blockReasons: [],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 2,
      statusHistory: [],
    },
    {
      packageName: 'mongodb',
      packageVersion: '6.2.0',
      license: 'Apache-2.0',
      repoUrl: 'https://github.com/mongodb/node-mongodb-native',
      status: 'pending_review',
      riskLevel: 'safe',
      riskScore: 15,
      riskFactors: ['permissive_license', 'notice_required'],
      blockReasons: [],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'Apache-2.0',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 2,
      statusHistory: [],
    },
    {
      packageName: 'redis',
      packageVersion: '4.6.10',
      license: 'MIT',
      repoUrl: 'https://github.com/redis/node-redis',
      status: 'pending_review',
      riskLevel: 'safe',
      riskScore: 5,
      riskFactors: ['permissive_license'],
      blockReasons: [],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 2,
      statusHistory: [],
    },
    {
      packageName: 'jsonwebtoken',
      packageVersion: '9.0.2',
      license: 'MIT',
      repoUrl: 'https://github.com/auth0/node-jsonwebtoken',
      status: 'blocked',
      riskLevel: 'critical',
      riskScore: 85,
      riskFactors: ['security_vulnerability', 'deprecated'],
      blockReasons: [
        { type: 'security_risk', detail: '存在已知安全漏洞 CVE-2022-23529' },
        { type: 'deprecated', detail: '该包已被维护者标记为废弃，建议使用 jose 替代' },
      ],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000,
      statusHistory: [
        { status: 'pending_review', timestamp: Date.now() - 86400000 * 2, operator: '张三', notes: '提交审查' },
        { status: 'blocked', timestamp: Date.now() - 86400000, operator: '李四', notes: '存在安全漏洞，建议替换为jose' },
      ],
    },
    {
      packageName: 'bcryptjs',
      packageVersion: '2.4.3',
      license: ['MIT', 'Apache-2.0'],
      repoUrl: 'https://github.com/dcodeIO/bcrypt.js',
      status: 'pending_review',
      riskLevel: 'warning',
      riskScore: 35,
      riskFactors: ['dual_license', 'unmaintained'],
      blockReasons: [
        { type: 'dual_license', detail: '双许可证需要选择适用许可证' },
      ],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: null,
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 2,
      statusHistory: [],
    },
    {
      packageName: 'moment',
      packageVersion: '2.29.4',
      license: 'MIT',
      repoUrl: 'https://github.com/moment/moment',
      status: 'blocked',
      riskLevel: 'warning',
      riskScore: 45,
      riskFactors: ['deprecated', 'performance_concern'],
      blockReasons: [
        { type: 'deprecated', detail: 'Moment.js 已停止开发，官方推荐使用 dayjs 或 date-fns' },
      ],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000,
      statusHistory: [
        { status: 'pending_review', timestamp: Date.now() - 86400000 * 2, operator: '张三', notes: '提交审查' },
        { status: 'blocked', timestamp: Date.now() - 86400000, operator: '李四', notes: 'Moment已废弃，建议替换为dayjs' },
      ],
    },
    {
      packageName: 'crypto-js',
      packageVersion: '4.2.0',
      license: '',
      repoUrl: '',
      status: 'parsed_dirty',
      riskLevel: 'unknown',
      riskScore: 0,
      riskFactors: [],
      blockReasons: [
        { type: 'license_missing', detail: '无法从包元数据中获取许可证信息' },
        { type: 'dirty_data', detail: '未找到项目仓库地址' },
      ],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: false,
      licenseSelected: null,
      transitiveDependencies: [],
      dirtyData: {
        dirtyType: 'license_missing',
        rawData: { name: 'crypto-js', version: '4.2.0' },
        description: '缺少许可证和仓库地址信息',
        detectedAt: Date.now() - 86400000 * 5,
        fixed: false,
      },
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 5,
      statusHistory: [],
    },
    {
      packageName: 'vue',
      packageVersion: '3.3.8',
      license: 'MIT',
      repoUrl: 'https://github.com/vuejs/core',
      status: 'waiver_approved',
      riskLevel: 'warning',
      riskScore: 30,
      riskFactors: ['license_compatibility'],
      blockReasons: [],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 2,
      statusHistory: [
        { status: 'pending_review', timestamp: Date.now() - 86400000 * 4, operator: '张三', notes: '提交审查' },
        { status: 'waiver_pending', timestamp: Date.now() - 86400000 * 3, operator: '张三', notes: '申请豁免，项目历史原因使用Vue' },
        { status: 'waiver_approved', timestamp: Date.now() - 86400000 * 2, operator: '李四', notes: '同意豁免，有效期90天' },
      ],
    },
    {
      packageName: 'angular',
      packageVersion: '1.8.3',
      license: 'MIT',
      repoUrl: 'https://github.com/angular/angular.js',
      status: 'blocked',
      riskLevel: 'critical',
      riskScore: 75,
      riskFactors: ['outdated_version', 'end_of_life', 'security_vulnerability'],
      blockReasons: [
        { type: 'end_of_life', detail: 'AngularJS 1.x 已于2022年1月停止长期支持' },
        { type: 'security_risk', detail: '存在多个未修复的安全漏洞' },
        { type: 'outdated_version', detail: '版本过旧，建议升级到最新版Angular' },
      ],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000,
      statusHistory: [],
    },
    {
      packageName: 'jquery',
      packageVersion: '3.7.1',
      license: 'MIT',
      repoUrl: 'https://github.com/jquery/jquery',
      status: 'waiver_pending',
      riskLevel: 'warning',
      riskScore: 25,
      riskFactors: ['unnecessary_dependency'],
      blockReasons: [],
      isDirect: true,
      depth: 0,
      sourceFile: 'package.json',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000,
      statusHistory: [
        { status: 'pending_review', timestamp: Date.now() - 86400000 * 2, operator: '张三', notes: '提交审查' },
        { status: 'waiver_pending', timestamp: Date.now() - 86400000, operator: '张三', notes: '申请豁免，兼容旧代码' },
      ],
    },
    {
      packageName: 'scheduler',
      packageVersion: '0.23.0',
      license: 'MIT',
      repoUrl: 'https://github.com/facebook/react',
      status: 'approved',
      riskLevel: 'safe',
      riskScore: 5,
      riskFactors: ['permissive_license'],
      blockReasons: [],
      isDirect: false,
      depth: 1,
      parentId: '',
      sourceFile: 'package.json (传递)',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 3,
      statusHistory: [],
    },
    {
      packageName: 'loose-envify',
      packageVersion: '1.4.0',
      license: 'MIT',
      repoUrl: 'https://github.com/zertosh/loose-envify',
      status: 'approved',
      riskLevel: 'safe',
      riskScore: 5,
      riskFactors: ['permissive_license'],
      blockReasons: [],
      isDirect: false,
      depth: 1,
      parentId: '',
      sourceFile: 'package.json (传递)',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 3,
      statusHistory: [],
    },
    {
      packageName: 'follow-redirects',
      packageVersion: '1.15.3',
      license: 'MIT',
      repoUrl: 'https://github.com/follow-redirects/follow-redirects',
      status: 'pending_review',
      riskLevel: 'warning',
      riskScore: 20,
      riskFactors: ['transitive_dependency'],
      blockReasons: [
        { type: 'transitive_dependency', detail: 'axios的传递依赖，建议确认是否需要' },
      ],
      isDirect: false,
      depth: 1,
      parentId: '',
      sourceFile: 'package.json (传递)',
      fileId,
      licenseMatched: true,
      licenseSelected: 'MIT',
      transitiveDependencies: [],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 2,
      statusHistory: [],
    },
  ];

  const deps: Dependency[] = baseDeps.map((d) => ({
    ...d,
    id: generateId(),
    projectId,
  }));

  const reactDep = deps.find((d) => d.packageName === 'react');
  const axiosDep = deps.find((d) => d.packageName === 'axios');
  const schedulerDep = deps.find((d) => d.packageName === 'scheduler');
  const looseEnvifyDep = deps.find((d) => d.packageName === 'loose-envify');
  const followRedirectsDep = deps.find((d) => d.packageName === 'follow-redirects');

  if (reactDep && schedulerDep && looseEnvifyDep) {
    schedulerDep.parentId = reactDep.id;
    looseEnvifyDep.parentId = reactDep.id;
    reactDep.transitiveDependencies = [schedulerDep.id, looseEnvifyDep.id];
  }

  if (axiosDep && followRedirectsDep) {
    followRedirectsDep.parentId = axiosDep.id;
    axiosDep.transitiveDependencies = [followRedirectsDep.id];
  }

  await db.dependencies.bulkAdd(deps);

  const vueDep = deps.find((d) => d.packageName === 'vue');
  const jqueryDep = deps.find((d) => d.packageName === 'jquery');

  const waivers: Waiver[] = [];

  if (vueDep) {
    const expiryDate = Date.now() + 86400000 * 75;
    waivers.push({
      id: generateId(),
      projectId,
      dependencyId: vueDep.id,
      applicant: '张三',
      reason: '项目为历史遗留系统，整体基于Vue构建，短期内无法迁移到其他框架。已评估许可证兼容性风险可控。',
      justification: '项目为历史遗留系统，整体基于Vue构建，短期内无法迁移到其他框架。已评估许可证兼容性风险可控。',
      effectiveDate: Date.now() - 86400000 * 2,
      expiryDate,
      expireDate: expiryDate,
      status: 'approved',
      approver: '李四',
      approvalDate: Date.now() - 86400000 * 2,
      approvedAt: Date.now() - 86400000 * 2,
      approvalNotes: '同意豁免，有效期90天。到期前需评估是否可以迁移。',
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 86400000 * 2,
      notes: '同意豁免，有效期90天。到期前需评估是否可以迁移。',
      statusHistory: [
        { status: 'pending', timestamp: Date.now() - 86400000 * 3, operator: '张三', notes: '提交豁免申请' },
        { status: 'approved', timestamp: Date.now() - 86400000 * 2, operator: '李四', notes: '同意豁免，有效期90天' },
      ],
      history: [],
    });
  }

  if (jqueryDep) {
    const expiryDate = Date.now() + 86400000 * 90;
    waivers.push({
      id: generateId(),
      projectId,
      dependencyId: jqueryDep.id,
      applicant: '张三',
      reason: '后台管理系统中存在大量基于jQuery的旧插件，替换成本较高。计划在Q2季度逐步迁移。',
      justification: '后台管理系统中存在大量基于jQuery的旧插件，替换成本较高。计划在Q2季度逐步迁移。',
      effectiveDate: Date.now() - 86400000,
      expiryDate,
      expireDate: expiryDate,
      status: 'pending',
      approver: null,
      approvalDate: null,
      approvalNotes: null,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
      statusHistory: [
        { status: 'pending', timestamp: Date.now() - 86400000, operator: '张三', notes: '提交豁免申请' },
      ],
      history: [],
    });
  }

  if (waivers.length > 0) {
    await db.waivers.bulkAdd(waivers);
  }

  console.log('Demo data seeded successfully');
  console.log(`Created: 1 project, ${deps.length} dependencies, ${waivers.length} waivers`);

  return { project, deps, waivers };
}
