# 内容发布撤稿 CLI 工具

## 📋 概述

品牌部门发布文章后偶尔要紧急撤稿，但官网、公众号和合作页状态并不同步。本 CLI 工具围绕内容发布到多渠道后，撤稿要追踪渠道状态、缓存清理、引用页面和责任人展开。

## 🚀 快速开始

### 1. 本地启动

```bash
# 安装依赖
npm install

# 初始化系统并加载样例数据
npm run cli -- init --clear --samples
```

### 2. 造数

**方式一：加载内置样例（推荐快速体验）

```bash
# 初始化时自动加载 4 条样例数据
npm run cli -- init --samples
```

内置样例覆盖：
- **新闻稿** (news-001): 品牌战略新闻，多渠道发布，状态正常
- **活动页** (event-001): 开发者大会活动页，部分渠道已撤稿但缓存未清
- **产品说明** (product-001): 新功能说明文档，缺少责任人
- **问题案例** (problem-001): 撤稿有问题的样例

**方式二：导入外部数据**

```bash
# 从 JSON 文件导入
npm run cli -- import ./data/my-content.json
```

导入格式参考 `data/samples/` 目录下的样例文件。

### 3. 主要演示路径

**步骤1：检查所有内容状态**
```bash
npm run cli -- check
```

**步骤2：查看单条内容详情（包含历史记录）
```bash
npm run cli -- detail news-001 --history
```

**步骤3：运行自动演示 - 成功撤稿路径
```bash
npm run demo
```

**步骤4：生成撤稿闭环报告
```bash
npm run cli -- report
```

### 4. 失败路径演示

```bash
npm run demo-failure
```

这条演示路径模拟了以下常见的撤稿问题：
- 内容责任人缺失
- 渠道已撤稿但缓存仍可访问
- 合作方内容仍在线且未响应
- 引用页面仍包含撤稿链接
- 各渠道和页面负责人都未指定
- 人工修正记录前后差异和操作者

## 🎮 核心命令

### init - 初始化系统

```bash
npm run cli -- init [options]
```

**选项：**
- `--clear`：清空历史数据
- `--samples`：加载内置样例数据

### import - 导入数据

```bash
npm run cli -- import <file>
```

**参数：**
- `<file>`：JSON 格式的内容发布记录文件

### check - 检查撤稿状态

```bash
npm run cli -- check [contentId] [options]
```

**参数：**
- `[contentId]`：内容 ID（可选，不指定则检查所有）

**选项：**
- `--summary`：仅显示摘要信息

### detail - 查看详情

```bash
npm run cli -- detail <contentId> [options]
```

**参数：**
- `<contentId>`：内容 ID

**选项：**
- `--history`：包含操作历史记录

### report - 生成报告

```bash
npm run cli -- report
```

生成完整的撤稿闭环报告，包含：
- 总览统计
- 按类型分布
- 渠道覆盖情况
- 问题统计
- 下一步负责人安排
- 闭环判断

### list - 列出所有内容

```bash
npm run cli -- list
```

## 📊 规则引擎覆盖

### 1. 缺少责任人检查

- **问题类型：** `missing_owner`

检查内容、渠道、引用页面的责任人是否缺失
- 内容级别（高优先级）
- 渠道级别（中优先级）
- 引用页面级别（低优先级）

### 2. 缓存问题检查

- **问题类型：** `cache_issue`

检查渠道状态与缓存状态的不匹配：
- 渠道已撤稿但缓存仍可访问
- 渠道已撤稿但缓存清理中
- 渠道已撤稿但缓存状态未知

### 3. 合作方链接检查

- **问题类型：** `cooperation_unconfirmed`、`cooperation_active`、`reference_has_link`

检查合作方渠道和引用页面：
- 合作方撤稿未确认
- 合作方内容仍在线
- 合作方撤稿异常
- 引用页面链接未确认
- 引用页面仍有链接

### 4. 多版本检查

- **问题类型：** `multiple_versions`、`incomplete_versions`

检查相同 URL 的其他版本：
- 相同 URL 的其他活跃版本
- 相同 URL 的未完成撤稿版本

### 5. 部分撤稿检查

- **问题类型：** `partial_unpublish`

提示仅部分渠道完成撤稿

## 🔒 幂等性保证

### 重复撤稿保护

- 检测内容是否已执行过撤稿操作
- 检测单个渠道是否已撤稿
- 重复操作返回成功状态但不重复执行

### 人工修正记录

所有人工编辑都会留下：
- 操作者信息
- 操作原因
- 变更字段的前后差异

## 📁 项目结构

```
├── src/
│   ├── cli.js              # CLI 入口
│   ├── models/
│   │   └── content.js      # 数据模型定义
│   ├── utils/
│   │   ├── store.js       # 数据存储管理
│   │   ├── idempotent.js # 幂等性管理
│   │   └── samples.js    # 样例数据生成
│   ├── commands/
│   │   ├── init.js         # init 命令
│   │   ├── import.js       # import 命令
│   │   ├── check.js        # check 命令
│   │   ├── detail.js       # detail 命令
│   │   └── report.js       # report 命令
│   └── rules/
│       └── engine.js     # 规则引擎
├── data/                   # 数据存储目录
│   └── store.json      # 主存储文件
├── scripts/
│   ├── demo.js         # 成功路径演示
│   └── demo-failure.js # 失败路径演示
└── package.json
```

## 🎯 数据模型说明

### ContentRecord（内容记录）
- `id`: 唯一标识
- `title`: 标题
- `type`: 类型 (news/event/product
- `status`: 整体状态
- `owner`: 责任人
- `channels`: 渠道列表
- `referencePages`: 引用页面列表

### ChannelStatus（渠道状态）
- `channelName`: 渠道名称
- `channelType`: 渠道类型
- `status`: 撤稿状态
- `cacheStatus`: 缓存状态
- `unpublishAttempts`: 撤稿尝试次数
- `owner`: 渠道负责人
- `errors`: 错误信息

### ReferencePage（引用页面）
- `url`: 页面URL
- `title`: 页面标题
- `hasLink`: 是否仍有链接
- `owner`: 检查人

### AuditLog（审计日志）
- `action`: 操作类型
- `operator`: 操作者
- `before`: 变更前
- `after`: 变更后
- `diff`: 具体差异字段

## 📝 状态说明

| 状态值 | 显示名称 | 说明
|--------|----------|------
| active | 仍在线 | 内容正常在线
| pending | 待处理 | 等待处理中
| unpublished | 已撤稿 | 已成功撤稿完成
| partial | 部分撤稿 | 部分渠道已撤稿
| failed | 有问题 | 存在阻塞问题
| archived | 已归档 | 已归档处理

## 🎬 完整演示流程

### 完整成功路径：

1. **初始化**
```bash
npm run cli -- init --clear --samples
```

2. **检查所有状态**
```bash
npm run cli -- check
```

3. **查看某条详情**
```bash
npm run cli -- detail news-001
```

4. **运行成功演示**
```bash
npm run demo
```

5. **查看演示结果**
```bash
npm run cli -- check demo-news-001
npm run cli -- detail demo-news-001 --history
npm run cli -- report
```

6. **运行失败演示**
```bash
npm run demo-failure
```

7. **查看失败案例详情**
```bash
npm run cli -- check demo-fail-001
npm run cli -- detail demo-fail-001 --history
npm run cli -- report
```

## ✅ 闭环判断标准

业务闭环的条件：

1. 所有渠道状态为 `unpublished`
2. 所有渠道缓存状态为 `purged` 或确认失效
3. 所有引用页面已检查确认无链接
4. 所有内容、渠道、页面都有明确责任人
5. 无高优先级阻塞问题

当以上条件全部满足时，`report` 命令会显示「业务已闭环」。
