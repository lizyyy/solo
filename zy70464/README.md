# 会议纪要附件补录处理工具

一个基于 TypeScript 的命令行工具，用于处理会议纪要的附件补录、证据链管理、人工修正追踪和报告生成。

## 功能特性

### 核心功能
- **会议纪要管理**：创建、查询、管理会议纪要记录
- **附件补录**：支持添加附件并保留原始输入数据
- **证据链完整性**：自动维护证据链，支持标记断开状态
- **人工修正追踪**：记录所有人工修正，保留原始系统判断
- **搜索词报告**：生成搜索词报告，支持复核样例展示
- **导出摘要**：完整记录输入、操作和结论的审计追踪

### 异常处理
- 证据链断开标记与说明
- 完整的错误处理机制
- 异常路径与成功路径统一查询入口

## 项目结构

```
src/
├── types.ts              # 类型定义
├── cli.ts                # 命令行入口
├── core/
│   ├── processor.ts      # 核心业务逻辑处理
│   └── report-generator.ts # 模板渲染与报告生成
├── templates/
│   ├── meeting-report.hbs # 单个会议报告模板
│   └── summary-report.hbs # 汇总报告模板
├── data/
│   └── sample-data.ts    # 真实部门样例数据
└── self-test.ts          # 自检脚本
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 运行自检
```bash
npm run test
```

### 运行演示
```bash
npm run dev -- demo
```

## CLI 命令说明

### 创建会议纪要
```bash
npm run dev -- create [options]

Options:
  -t, --title <title>          会议标题
  -d, --date <date>            会议日期 (YYYY-MM-DD)
  -de, --department <dept>      所属部门
  -a, --attendees <attendees...> 参会人员列表
```

### 添加附件
```bash
npm run dev -- add-attachment [options]

Options:
  -m, --meeting-id <id>        会议ID (必填)
  -f, --file <filename>         文件名 (必填)
  -t, --type <filetype>         文件类型
  -u, --uploader <uploader>     上传人
  -c, --content <content>       文件内容
  -i, --input <json>           原始输入(JSON格式)
```

### 人工修正
```bash
npm run dev -- correct [options]

Options:
  -m, --meeting-id <id>        会议ID (必填)
  -f, --field <field>           字段名 (必填)
  -v, --value <value>           修正后的值 (必填)
  -r, --reason <reason>         修正原因 (必填)
  -c, --corrector <corrector>   修正人 (必填)
```

### 模拟证据链断开
```bash
npm run dev -- break-chain [options]

Options:
  -m, --meeting-id <id>        会议ID (必填)
  -r, --reason <reason>         断开原因 (必填)
```

### 查询会议纪要
```bash
npm run dev -- query [options]

Options:
  -m, --meeting-id <id>        按会议ID过滤
  -d, --department <dept>       按部门过滤
  -s, --status <status>         按状态过滤
  -b, --broken-chain            仅显示证据链断开的记录
  -c, --has-corrections         仅显示有人工修正的记录
  -v, --verbose                 显示详细信息
```

### 生成报告
```bash
npm run dev -- report [options]

Options:
  -m, --meeting-id <id>        会议ID (必填)
  -o, --output <path>           输出文件路径
```

### 生成汇总报告
```bash
npm run dev -- summary [options]

Options:
  -o, --output <path>           输出文件路径
```

### 查看附件原始输入
```bash
npm run dev -- show-original [options]

Options:
  -m, --meeting-id <id>        会议ID (必填)
  -a, --attachment-id <id>      附件ID (必填)
```

### 生成搜索词报告
```bash
npm run dev -- search-report [options]

Options:
  -m, --meeting-id <id>        会议ID (必填)
  -t, --term <term>             搜索词 (必填)
  -c, --content <content>       待搜索内容
```

## 数据模型说明

### MeetingMinutes (会议纪要)
- `id`: 唯一标识符
- `meetingTitle`: 会议标题
- `meetingDate`: 会议日期
- `department`: 所属部门
- `attendees`: 参会人员列表
- `topics`: 议题列表
- `decisions`: 决议列表
- `actionItems`: 待办事项
- `attachments`: 附件列表
- `evidenceChain`: 证据链
- `corrections`: 人工修正记录
- `searchTermReports`: 搜索词报告
- `status`: 状态 (draft/submitted/reviewed/archived)

### EvidenceChain (证据链)
- `id`: 唯一标识符
- `meetingId`: 关联会议ID
- `items`: 证据项列表
- `status`: 状态 (complete/broken)
- `brokenAt`: 断开位置
- `brokenReason`: 断开原因

### ManualCorrection (人工修正)
- `id`: 唯一标识符
- `fieldName`: 字段名
- `originalValue`: 原始值 (系统判断)
- `correctedValue`: 修正后的值
- `reason`: 修正原因
- `corrector`: 修正人
- `timestamp`: 时间戳
- `systemJudgment`: 系统判断记录

### ExportSummary (导出摘要)
- `input`: 输入信息 (会议ID、附件、字段)
- `actions`: 操作记录列表 (类型、描述、时间戳)
- `conclusion`: 结论 (状态、证据链完整性、修正数)

## 模板渲染

项目使用 Handlebars 进行模板渲染，支持以下 helper：
- `formatDate`: 格式化日期
- `statusColor`: 状态着色显示
- `json`: JSON 格式化输出
- `join`: 数组合并为字符串
- `ifEquals`: 条件判断

## 样例数据

包含 4 个真实部门样例场景：
1. 技术研发部 - 预算评审会议 (完整证据链)
2. 产品部 - 迭代规划研讨会 (完整证据链)
3. 合规部 - 审计整改会议 (证据链断开)
4. 人力资源部 - 培训计划协调会 (完整证据链)

## 测试覆盖

自检脚本 (self-test.ts) 包含 45 个测试用例，覆盖：
- 基础功能测试 (3项)
- 附件补录功能测试 (4项)
- 证据链完整性测试 (5项)
- 人工修正功能测试 (5项)
- 搜索词报告功能测试 (3项)
- 统一查询入口测试 (4项)
- 导出摘要测试 (4项)
- 模板渲染测试 (3项)
- 真实部门样例数据测试 (7项)
- 边界情况测试 (7项)

## 技术栈

- TypeScript 5.0
- Node.js
- Commander (CLI 框架)
- Handlebars (模板引擎)
- Chalk (终端着色)
- cli-table3 (表格显示)

## License

MIT
