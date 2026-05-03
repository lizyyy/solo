import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export const initCommand = new Command('init')
  .description('初始化示例项目，生成 HTML 快照、轨迹 JSON 和操作清单')
  .option('-d, --directory <path>', '目标目录', './audit-project')
  .option('--no-sample', '不创建示例文件')
  .action(async (options: { directory: string; sample: boolean }) => {
    const targetDir = path.resolve(options.directory);

    console.log(chalk.blue('焦点顺序体检员 - 初始化项目'));
    console.log('='.repeat(50));

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(chalk.green(`[✓] 创建目录: ${targetDir}`));
      } else {
        console.log(chalk.yellow(`[!] 目录已存在: ${targetDir}`));
      }

      if (options.sample) {
        await createSampleFiles(targetDir);
      }

      createProjectConfig(targetDir);

      console.log('\n' + '='.repeat(50));
      console.log(chalk.green('初始化完成！'));
      console.log('\n下一步操作:');
      console.log(chalk.cyan(`  cd ${options.directory}`));
      console.log(chalk.cyan('  foi scan'));
      console.log(chalk.cyan('  foi check'));

    } catch (error) {
      console.error(chalk.red(`错误: ${(error as Error).message}`));
      process.exit(1);
    }
  });

async function createSampleFiles(targetDir: string): Promise<void> {
  const templatesDir = path.join(__dirname, '..', '..', 'templates');
  const sampleHtmlPath = path.join(templatesDir, 'sample-page.html');
  const sampleTrajectoryPath = path.join(templatesDir, 'sample-trajectory.json');
  const sampleOperationsPath = path.join(templatesDir, 'sample-operations.json');

  const sampleHtml = getSampleHtml();
  const sampleTrajectory = getSampleTrajectory();
  const sampleOperations = getSampleOperations();

  const htmlDest = path.join(targetDir, 'snapshot.html');
  const trajectoryDest = path.join(targetDir, 'trajectory.json');
  const operationsDest = path.join(targetDir, 'operations.json');

  fs.writeFileSync(htmlDest, sampleHtml);
  console.log(chalk.green(`[✓] 创建示例 HTML: ${htmlDest}`));

  fs.writeFileSync(trajectoryDest, JSON.stringify(sampleTrajectory, null, 2));
  console.log(chalk.green(`[✓] 创建示例轨迹 JSON: ${trajectoryDest}`));

  fs.writeFileSync(operationsDest, JSON.stringify(sampleOperations, null, 2));
  console.log(chalk.green(`[✓] 创建示例操作清单: ${operationsDest}`));
}

function createProjectConfig(targetDir: string): void {
  const config = {
    version: '1.0.0',
    project: {
      name: '无障碍审查项目',
      description: '焦点顺序体检员项目配置'
    },
    paths: {
      snapshot: 'snapshot.html',
      trajectory: 'trajectory.json',
      operations: 'operations.json',
      output: '.foi-output'
    },
    rules: {
      enabled: [
        'focus_to_hidden',
        'modal_not_trapped',
        'no_readable_name',
        'shortcut_conflict',
        'focus_order_violation'
      ]
    }
  };

  const configPath = path.join(targetDir, 'foi.config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(chalk.green(`[✓] 创建配置文件: ${configPath}`));
}

function getSampleHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>政务服务大厅 - 示例页面</title>
  <style>
    .hidden { display: none; }
    .modal { 
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border: 1px solid #ccc;
      display: none;
    }
    .modal.show { display: block; }
  </style>
</head>
<body>
  <header>
    <a href="#" aria-label="返回首页">
      <img src="logo.png" alt="政务服务">
    </a>
    <nav>
      <a href="#home">首页</a>
      <a href="#services">服务大厅</a>
      <a href="#query">进度查询</a>
    </nav>
  </header>

  <main>
    <h1>身份证补办申请</h1>
    
    <form id="application-form">
      <div class="form-group">
        <label for="name">姓名</label>
        <input type="text" id="name" name="name" aria-required="true">
      </div>
      
      <div class="form-group">
        <label for="idcard">身份证号</label>
        <input type="text" id="idcard" name="idcard" aria-required="true">
      </div>
      
      <div class="hidden">
        <input type="text" id="secret-field" name="secret">
      </div>
      
      <button type="button" id="open-modal">
        预览申请
      </button>
      
      <button type="submit" aria-label="提交申请">
        <span>确定</span>
      </button>
      
      <div tabindex="0">
        无语义可聚焦元素
      </div>
    </form>
  </main>

  <div id="preview-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <h2 id="modal-title">申请预览</h2>
    <p>请确认以下信息：</p>
    <button type="button" id="modal-close">关闭</button>
    <button type="button" id="modal-confirm">确认提交</button>
  </div>

  <div id="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5);"></div>
</body>
</html>`;
}

function getSampleTrajectory() {
  return {
    pageUrl: "http://example.gov/service/apply",
    snapshotId: "snapshot-20240115-1030",
    timestamp: Date.now(),
    items: [
      {
        timestamp: Date.now() + 100,
        selector: "header a:first-child",
        xpath: "//header/a[1]",
        tagName: "A",
        textContent: "",
        ariaLabel: "返回首页",
        visible: true,
        isFocused: true,
        isModal: false
      },
      {
        timestamp: Date.now() + 200,
        selector: "nav a:nth-child(1)",
        xpath: "//nav/a[1]",
        tagName: "A",
        textContent: "首页",
        ariaLabel: null,
        visible: true,
        isFocused: true,
        isModal: false
      },
      {
        timestamp: Date.now() + 300,
        selector: "nav a:nth-child(2)",
        xpath: "//nav/a[2]",
        tagName: "A",
        textContent: "服务大厅",
        ariaLabel: null,
        visible: true,
        isFocused: true,
        isModal: false
      },
      {
        timestamp: Date.now() + 400,
        selector: "nav a:nth-child(3)",
        xpath: "//nav/a[3]",
        tagName: "A",
        textContent: "进度查询",
        ariaLabel: null,
        visible: true,
        isFocused: true,
        isModal: false
      },
      {
        timestamp: Date.now() + 500,
        selector: "#name",
        xpath: "//input[@id='name']",
        tagName: "INPUT",
        textContent: "",
        ariaLabel: null,
        visible: true,
        isFocused: true,
        isModal: false
      },
      {
        timestamp: Date.now() + 600,
        selector: "#idcard",
        xpath: "//input[@id='idcard']",
        tagName: "INPUT",
        textContent: "",
        ariaLabel: null,
        visible: true,
        isFocused: true,
        isModal: false
      },
      {
        timestamp: Date.now() + 700,
        selector: "#open-modal",
        xpath: "//button[@id='open-modal']",
        tagName: "BUTTON",
        textContent: "预览申请",
        ariaLabel: null,
        visible: true,
        isFocused: true,
        isModal: false
      },
      {
        timestamp: Date.now() + 800,
        selector: 'button[type="submit"]',
        xpath: '//button[@type="submit"]',
        tagName: "BUTTON",
        textContent: "确定",
        ariaLabel: "提交申请",
        visible: true,
        isFocused: true,
        isModal: false
      },
      {
        timestamp: Date.now() + 900,
        selector: "div[tabindex='0']",
        xpath: "//div[@tabindex='0']",
        tagName: "DIV",
        textContent: "无语义可聚焦元素",
        ariaLabel: null,
        visible: true,
        isFocused: true,
        isModal: false
      },
      {
        timestamp: Date.now() + 1000,
        selector: "#modal-close",
        xpath: "//button[@id='modal-close']",
        tagName: "BUTTON",
        textContent: "关闭",
        ariaLabel: null,
        visible: true,
        isFocused: true,
        isModal: true
      },
      {
        timestamp: Date.now() + 1100,
        selector: "header a:first-child",
        xpath: "//header/a[1]",
        tagName: "A",
        textContent: "",
        ariaLabel: "返回首页",
        visible: true,
        isFocused: true,
        isModal: false
      }
    ],
    metadata: {
      browser: "Chrome 120.0",
      viewport: {
        width: 1920,
        height: 1080
      }
    }
  };
}

function getSampleOperations() {
  return [
    {
      id: "op-001",
      description: "填写姓名",
      selector: "#name",
      operationType: "input",
      expectedFlow: ["#name", "#idcard"],
      required: true
    },
    {
      id: "op-002",
      description: "填写身份证号",
      selector: "#idcard",
      operationType: "input",
      expectedFlow: ["#idcard", "#open-modal"],
      required: true
    },
    {
      id: "op-003",
      description: "打开预览弹窗",
      selector: "#open-modal",
      operationType: "modal",
      expectedFlow: ["#modal-close", "#modal-confirm"],
      required: true
    },
    {
      id: "op-004",
      description: "提交申请",
      selector: 'button[type="submit"]',
      operationType: "click",
      expectedFlow: [],
      required: true
    }
  ];
}
