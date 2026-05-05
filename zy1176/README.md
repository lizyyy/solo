# DataMask Desktop

客户会议素材脱敏打包工具 - 在将会议录屏、截图和文字纪要发送给外包前进行脱敏处理。

## 功能特性

- 📁 **拖入文件夹**：支持拖拽项目文件夹，自动建立素材清单
- 🔍 **敏感信息检测**：自动检测姓名、手机号、邮箱、公司名、身份证号、银行卡号等敏感信息
- ✅ **逐条确认**：支持对检测结果逐条确认脱敏或忽略
- 📝 **智能替换**：内置智能脱敏替换规则，保留格式的同时隐藏敏感信息
- 📦 **一键导出**：生成脱敏副本、风险清单和交付 manifest
- 💾 **本地持久化**：所有项目、文件、命中规则、处理状态和导出记录本地保存
- 🎯 **内置样例**：包含示例数据，快速体验完整功能

## 支持检测的敏感信息类型

| 类别 | 检测内容 | 示例 |
|------|----------|------|
| 📱 联系方式 | 手机号、邮箱、QQ号、微信号 | 13812345678, test@example.com |
| 🆔 身份信息 | 身份证号、中文姓名、车牌号 | 110101199001011234, 京A12345 |
| 🏢 组织机构 | 公司名称、机构名称 | ABC科技有限公司 |
| 💳 金融信息 | 银行卡号、账户信息 | 6222021234567890123 |
| 📍 地理位置 | 地址信息 | 北京市海淀区中关村软件园 |

## 支持的文件类型

- 文本文件：.txt, .md, .csv, .json, .xml, .yaml 等
- 未来计划支持：图片、PDF、视频等

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 运行渲染进程开发服务器
npm run dev

# 运行完整 Electron 应用（需要先安装依赖）
npm run dev:electron
```

### 构建生产版本

```bash
# 构建所有平台
npm run build

# 仅构建目录（不生成安装包）
npm run build:dir
```

### 运行测试

```bash
# 运行测试
npm run test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 代码检查

```bash
npm run lint
```

## 使用指南

### 1. 创建项目

- 方式一：将文件夹拖入主界面
- 方式二：点击"选择文件夹"按钮
- 方式三：点击"加载示例项目"体验功能

### 2. 选择文件

在左侧文件列表中选择需要检查的文件。

### 3. 检测敏感信息

点击"检测敏感信息"按钮，系统会自动扫描文件中的敏感信息。

### 4. 确认或忽略

- **确认脱敏**：标记该敏感项需要替换
- **忽略**：标记该敏感项为误报，不需要处理
- **全部确认/全部忽略**：批量处理所有待确认项

### 5. 应用脱敏

确认完成后，点击"应用脱敏"按钮生成脱敏后的文件副本。

### 6. 导出交付包

点击"导出交付包"按钮，选择输出目录，系统会生成：
- `文件/`：所有脱敏后的文件
- `DELIVERY_MANIFEST.csv`：交付清单
- `RISK_REPORT.md`：风险评估报告
- `README.txt`：交付说明

## 项目结构

```
data-mask-desktop/
├── electron/                 # Electron 主进程
│   ├── services/            # 业务服务
│   │   ├── fileScanner.ts   # 文件扫描服务
│   │   ├── maskingEngine.ts # 脱敏引擎
│   │   ├── projectService.ts # 项目管理
│   │   └── exportService.ts # 导出服务
│   ├── types/               # 类型定义
│   ├── database.ts          # 数据库初始化
│   ├── main.ts              # 主进程入口
│   └── preload.ts           # 预加载脚本
├── src/                     # 渲染进程（React）
│   ├── components/          # React 组件
│   ├── styles/              # 样式文件
│   ├── types/               # 类型定义
│   ├── utils/               # 工具函数
│   ├── App.tsx              # 主应用组件
│   └── main.tsx             # 渲染入口
├── tests/                   # 测试文件
│   ├── services/            # 服务测试
│   └── utils/               # 工具测试
├── index.html               # HTML 模板
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
├── vite.config.ts
└── vitest.config.ts
```

## 数据库设计

系统使用 SQLite 进行本地数据持久化，包含以下表：

| 表名 | 说明 |
|------|------|
| `projects` | 项目信息 |
| `files` | 文件条目 |
| `sensitive_rules` | 敏感规则配置 |
| `sensitive_hits` | 敏感命中记录 |
| `export_records` | 导出记录 |

## 配置说明

### 敏感规则

系统内置了多种敏感信息检测规则，可通过修改 `sensitive_rules` 表进行自定义。

每条规则包含：
- `name`：规则名称
- `category`：分类
- `pattern`：正则表达式
- `priority`：优先级
- `is_active`：是否启用

### 数据存储位置

- macOS: `~/Library/Application Support/data-mask-desktop/`
- Windows: `%APPDATA%/data-mask-desktop/`
- Linux: `~/.config/data-mask-desktop/`

## 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite
- **桌面框架**：Electron
- **数据库**：better-sqlite3
- **测试框架**：Vitest
- **代码检查**：ESLint

## License

MIT License

## 注意事项

1. 本工具仅供本地使用，所有数据均存储在本地
2. 目前仅支持纯文本文件的脱敏处理
3. 图片、视频、PDF 等二进制文件的脱敏功能规划中
4. 请在导出前仔细核对所有敏感项的处理状态
