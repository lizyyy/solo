#!/usr/bin/env node

import { program } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { Parser } from './parser';
import { RulesEngine } from './rules';
import { Reporter } from './reporter';
import { TestCase } from './types';

// 定义 CLI 版本和描述
program
  .name('deeplink-check')
  .description('移动 App 深链路发布预检工具')
  .version('1.0.0');

// 定义 check 命令
program
  .command('check')
  .description('运行深链路预检检查')
  .option('-r, --routes <path>', '路由配置文件路径 (routes.yaml)', './config/routes.yaml')
  .option('-s, --screens <path>', '屏幕配置文件路径 (screens.json)', './config/screens.json')
  .option('-e, --events <path>', '埋点事件文件路径 (events.jsonl)', './config/events.jsonl')
  .option('-p, --policy <path>', '灰度规则文件路径 (policy.yaml)', './config/policy.yaml')
  .option('-t, --test-cases <path>', '测试用例文件路径 (可选)', '')
  .option('-o, --output <directory>', '输出目录', './output')
  .option('--user-segment <segment>', '测试用户分群', '')
  .option('--user-version <version>', '测试 App 版本', '')
  .option('--user-region <region>', '测试用户地区', '')
  .option('--user-id <id>', '测试用户 ID', '')
  .option('--logged-in', '测试登录状态', true)
  .option('--not-logged-in', '测试未登录状态', false)
  .action((options) => {
    try {
      runCheck(options);
    } catch (error) {
      console.error('❌ 检查失败:', (error as Error).message);
      process.exit(1);
    }
  });

// 定义 init 命令，创建示例配置文件
program
  .command('init')
  .description('初始化项目，创建示例配置文件')
  .option('-d, --directory <path>', '配置文件目录', './config')
  .action((options) => {
    try {
      initProject(options.directory);
    } catch (error) {
      console.error('❌ 初始化失败:', (error as Error).message);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse(process.argv);

// 运行检查的主函数
function runCheck(options: {
  routes: string;
  screens: string;
  events: string;
  policy: string;
  testCases: string;
  output: string;
  userSegment: string;
  userVersion: string;
  userRegion: string;
  userId: string;
  loggedIn: boolean;
  notLoggedIn: boolean;
}): void {
  console.log('🚀 开始深链路发布预检...\n');

  // 1. 解析配置文件
  console.log('📂 解析配置文件...');
  
  // 检查文件是否存在
  const requiredFiles = [
    { path: options.routes, name: '路由配置' },
    { path: options.screens, name: '屏幕配置' },
    { path: options.events, name: '埋点事件' },
    { path: options.policy, name: '灰度规则' }
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file.path)) {
      throw new Error(`${file.name}文件不存在: ${file.path}`);
    }
    console.log(`  ✅ 找到 ${file.name}: ${file.path}`);
  }

  // 解析各配置文件
  const routesData = Parser.parseRoutes(options.routes);
  const screensData = Parser.parseScreens(options.screens);
  const eventsData = Parser.parseEvents(options.events);
  const policyData = Parser.parsePolicy(options.policy);

  console.log(`  ✅ 解析完成: ${routesData.routes.length} 个路由, ${screensData.screens.length} 个屏幕, ${eventsData.length} 个埋点事件, ${policyData.rules.length} 个灰度规则\n`);

  // 2. 解析测试用例（如果提供）
  let testCases: TestCase[] | undefined;
  if (options.testCases && fs.existsSync(options.testCases)) {
    console.log('📋 解析测试用例...');
    try {
      const testCasesContent = fs.readFileSync(options.testCases, 'utf-8');
      const parsedTestCases = JSON.parse(testCasesContent) as TestCase[];
      testCases = parsedTestCases;
      console.log(`  ✅ 加载 ${parsedTestCases.length} 个测试用例\n`);
    } catch (error) {
      console.warn(`  ⚠️ 测试用例解析失败，将使用默认设置: ${(error as Error).message}\n`);
    }
  }

  // 3. 准备用户上下文
  const isLoggedIn = options.notLoggedIn ? false : options.loggedIn;
  const userContext = {
    segment: options.userSegment || undefined,
    version: options.userVersion || undefined,
    region: options.userRegion || undefined,
    userId: options.userId || undefined,
    isLoggedIn
  };

  console.log('👤 测试上下文:');
  console.log(`  登录状态: ${isLoggedIn ? '已登录' : '未登录'}`);
  if (userContext.segment) console.log(`  用户分群: ${userContext.segment}`);
  if (userContext.version) console.log(`  App 版本: ${userContext.version}`);
  if (userContext.region) console.log(`  用户地区: ${userContext.region}`);
  if (userContext.userId) console.log(`  用户 ID: ${userContext.userId}`);
  console.log('');

  // 4. 运行规则引擎检查
  console.log('🔍 运行检查规则...');
  const rulesEngine = new RulesEngine();
  const { issues, routeAnalysis } = rulesEngine.runAllChecks(
    routesData.routes,
    screensData.screens,
    eventsData,
    policyData.rules,
    policyData.defaultPolicy,
    testCases,
    userContext
  );

  console.log(`  ✅ 检查完成，发现 ${issues.length} 个问题\n`);

  // 5. 生成报告
  console.log('📄 生成报告...');
  
  // 确保输出目录存在
  if (!fs.existsSync(options.output)) {
    fs.mkdirSync(options.output, { recursive: true });
  }

  const report = Reporter.generateReport(
    issues,
    routeAnalysis,
    routesData.routes.length
  );

  // 打印控制台摘要
  Reporter.printConsoleSummary(report);

  // 导出 CSV 和 Markdown 报告
  const csvPath = path.join(options.output, 'issues.csv');
  const mdPath = path.join(options.output, 'deeplink_report.md');

  Reporter.exportCsv(report, csvPath);
  Reporter.exportMarkdown(report, mdPath);

  console.log(`\n🎉 预检完成！`);
  console.log(`📂 报告文件已保存到: ${options.output}/`);

  // 如果有严重或高优先级问题，返回非零退出码
  if (report.summary.criticalIssues > 0 || report.summary.highIssues > 0) {
    process.exit(1);
  }
}

// 初始化项目，创建示例配置文件
function initProject(configDir: string): void {
  console.log('🚀 初始化深链路预检工具项目...\n');

  // 确保配置目录存在
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`📁 创建配置目录: ${configDir}`);
  }

  // 创建示例 routes.yaml
  const routesYaml = `defaultScheme: myapp

routes:
  # 首页
  - path: /home
    scheme: myapp
    targetScreen: home_screen
    requiredParams: []
    optionalParams:
      - tab
      - source
    requiresLogin: false
    isDeprecated: false

  # 商品详情页（需要参数）
  - path: /product/detail
    scheme: myapp
    targetScreen: product_detail_screen
    requiredParams:
      - productId
    optionalParams:
      - source
      - campaign
    requiresLogin: false
    isDeprecated: false

  # 个人中心（需要登录）
  - path: /profile
    scheme: myapp
    targetScreen: profile_screen
    requiredParams: []
    optionalParams:
      - userId
    requiresLogin: true
    isDeprecated: false

  # 旧版商品页（已废弃）
  - path: /old/product
    scheme: myapp
    targetScreen: product_detail_screen
    requiredParams:
      - id
    optionalParams: []
    requiresLogin: false
    isDeprecated: true
    redirectTo: /product/detail

  # 旧短链格式（边界情况）
  - path: /s/p123
    scheme: myapp
    targetScreen: product_detail_screen
    requiredParams: []
    optionalParams: []
    requiresLogin: false
    isDeprecated: false

  # 订单详情页（灰度测试）
  - path: /order/detail
    scheme: myapp
    targetScreen: order_detail_screen
    requiredParams:
      - orderId
    optionalParams: []
    requiresLogin: true
    isDeprecated: false
`;

  // 创建示例 screens.json
  const screensJson = JSON.stringify({
    screens: [
      {
        id: "home_screen",
        name: "首页",
        requiredEvents: [
          "page_view_home",
          "home_impression"
        ],
        deprecated: false,
        minimumAppVersion: "1.0.0"
      },
      {
        id: "product_detail_screen",
        name: "商品详情页",
        requiredEvents: [
          "page_view_product",
          "product_detail_view",
          "add_to_cart_impression"
        ],
        deprecated: false,
        minimumAppVersion: "1.0.0"
      },
      {
        id: "profile_screen",
        name: "个人中心",
        requiredEvents: [
          "page_view_profile",
          "profile_view"
        ],
        deprecated: false,
        minimumAppVersion: "1.0.0"
      },
      {
        id: "order_detail_screen",
        name: "订单详情页",
        requiredEvents: [
          "page_view_order",
          "order_detail_view"
        ],
        deprecated: false,
        minimumAppVersion: "2.0.0"
      }
    ]
  }, null, 2);

  // 创建示例 events.jsonl
  const eventsJsonl = `{"eventName":"page_view_home","screenId":"home_screen","routePath":"/home","timestamp":"2026-05-03T10:00:00Z","userId":"user_001","properties":{"source":"push"}}
{"eventName":"home_impression","screenId":"home_screen","routePath":"/home","timestamp":"2026-05-03T10:00:01Z","userId":"user_001","properties":{"tab":"recommend"}}
{"eventName":"page_view_product","screenId":"product_detail_screen","routePath":"/product/detail","timestamp":"2026-05-03T10:05:00Z","userId":"user_001","properties":{"productId":"prod_123"}}
{"eventName":"product_detail_view","screenId":"product_detail_screen","routePath":"/product/detail","timestamp":"2026-05-03T10:05:01Z","userId":"user_001","properties":{"productId":"prod_123"}}
{"eventName":"page_view_profile","screenId":"profile_screen","routePath":"/profile","timestamp":"2026-05-03T10:10:00Z","userId":"user_001","properties":{}}
`;

  // 创建示例 policy.yaml
  const policyYaml = `defaultPolicy: allow

rules:
  # 灰度测试：新功能只对 VIP 用户开放
  - id: rule_001
    name: VIP 用户专属功能
    type: user_segment
    value: ["vip", "svip"]
    routes:
      - /order/detail
      - /vip/*

  # 版本限制：某些功能需要特定版本
  - id: rule_002
    name: 2.0 版本以上功能
    type: version
    value: ["2.0.0", "2.1.0", "2.2.0"]
    routes:
      - /order/detail

  # 百分比灰度：新功能只对 10% 用户开放
  - id: rule_003
    name: 10% 用户灰度
    type: percentage
    value: 10
    routes:
      - /new-feature/*

  # 地区限制：某些功能只对特定地区开放
  - id: rule_004
    name: 中国大陆地区专属
    type: region
    value: ["CN", "HK", "TW"]
    routes:
      - /region-specific/*
`;

  // 写入文件
  const routesPath = path.join(configDir, 'routes.yaml');
  const screensPath = path.join(configDir, 'screens.json');
  const eventsPath = path.join(configDir, 'events.jsonl');
  const policyPath = path.join(configDir, 'policy.yaml');

  fs.writeFileSync(routesPath, routesYaml, 'utf-8');
  console.log(`✅ 创建示例路由配置: ${routesPath}`);

  fs.writeFileSync(screensPath, screensJson, 'utf-8');
  console.log(`✅ 创建示例屏幕配置: ${screensPath}`);

  fs.writeFileSync(eventsPath, eventsJsonl, 'utf-8');
  console.log(`✅ 创建示例埋点数据: ${eventsPath}`);

  fs.writeFileSync(policyPath, policyYaml, 'utf-8');
  console.log(`✅ 创建示例灰度规则: ${policyPath}`);

  console.log(`\n🎉 初始化完成！`);
  console.log(`\n📋 下一步操作:`);
  console.log(`   1. 编辑 ${configDir}/ 下的配置文件`);
  console.log(`   2. 运行检查: npx deeplink-check check`);
  console.log(`   3. 查看报告: 打开 output/deeplink_report.md\n`);
}
