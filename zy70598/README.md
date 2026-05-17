# WebSocket 会话回放 CLI

WebSocket 会话日志回放与异常定位工具，帮助开发者离线分析线上问题，快速定位导致状态错乱的帧。

## 功能特性

- 📝 **多格式解析** - 支持标准文本格式、JSON 单行格式、Nginx 代理格式等
- ⏱️ **时间排序** - 自动按时间戳重新排序，处理乱序日志
- 🔄 **状态重建** - 回放并重建会话状态历史
- 🔍 **异常定位** - 自动标记解析错误和状态异常点
- 📊 **多格式报告** - 终端摘要、机器可读 JSON、交互式 HTML 报告
- 🧩 **坏行保留** - 保留原始行号、内容和错误原因，不丢失任何信息

## 安装

```bash
npm install
npm run build
npm link  # 全局安装 ws-replay 命令
```

## 快速开始

### 1. 运行自检

```bash
ws-replay self-test
# 或
npm run self-test
```

### 2. 回放示例会话

```bash
# 基本回放（终端输出 + JSON 报告）
ws-replay replay examples/sample-session.log

# 生成 HTML 报告
ws-replay replay examples/sample-session.log --html

# 仅生成 JSON 报告
ws-replay replay examples/sample-session.log --json --no-terminal

# 指定输出目录
ws-replay replay examples/sample-session.log -o ./my-reports --html
```

### 3. 列出连接信息

```bash
ws-replay list examples/sample-session.log
```

### 4. 查看特定帧详情

```bash
# 按行号查看
ws-replay inspect examples/sample-session.log -n 10

# 按时间排序后的索引查看
ws-replay inspect examples/sample-session.log -i 5
```

## 支持的日志格式

### 标准文本格式
```
2024-05-15T09:00:00.000Z [connection-id] IN/OUT opcode payload
```

### JSON 格式
```json
{"timestamp":1705314600000,"connectionId":"ws-123","direction":"receive","opcode":"text","payload":"..."}
```

### 箭头格式
```
[2024-05-15 09:00:00.000] conn-id -> text message
[2024-05-15 09:00:01.000] conn-id <- text message
```

## 报告格式

### 1. 终端输出
- 会话概览统计
- 异常检测结果
- 帧方向统计
- 状态变更摘要
- 解析失败的帧详情
- 最终状态预览

### 2. JSON 报告
完整的机器可读数据，包括：
- 元数据（总行数、有效帧数、无效帧数、时间范围）
- 所有帧的详细信息
- 状态快照历史
- 检测到的异常
- 状态变更详情

### 3. HTML 报告
交互式 Web 报告，包含：
- 概览仪表盘
- 可切换的标签页（异常、帧列表、状态变更、最终状态）
- 表格化的详细数据
- 状态 JSON 格式化展示

## 项目结构

```
.
├── src/
│   ├── index.ts          # CLI 入口
│   ├── parser.ts         # 日志解析器
│   ├── replay-engine.ts  # 状态回放引擎
│   ├── report-generator.ts  # 报告生成器
│   ├── self-test.ts      # 自检套件
│   └── types.ts          # TypeScript 类型定义
├── examples/
│   └── sample-session.log  # 示例日志
├── package.json
├── tsconfig.json
└── README.md
```

## 使用场景

### 排查状态错乱
1. 导出线上 WebSocket 会话日志
2. 运行回放：`ws-replay replay session.log --html`
3. 在 HTML 报告中查看状态变更历史
4. 定位导致状态跳变的特定帧

### 对比预期与实际
1. 使用 `--json` 导出完整回放数据
2. 编写脚本对比状态快照与预期值
3. 使用 `inspect` 命令查看可疑帧的详细信息

### 多连接日志分析
1. 使用 `list` 命令查看所有连接 ID
2. 使用 `-c` 参数过滤特定连接

## 开发命令

```bash
npm run build        # 编译 TypeScript
npm run self-test    # 运行自检套件
npm run dev          # ts-node 直接运行
```
