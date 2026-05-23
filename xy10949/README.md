# 民宿房态导入 CLI

一个本地可运行的民宿房态合并工具，支持从多平台导出的CSV和ICS日历文件合并，自动检测连住订单、冲突检测、锁房保留。

## 功能特性

- ✅ **多格式支持**: CSV和ICS文件解析
- 🔄 **日期区间合并**: 自动识别并合并连住订单，避免拆分
- 🚨 **冲突检测**: 检测房态重叠冲突，区分锁房冲突和订单冲突
- 🔒 **锁房保留**: 识别并保留锁房/维护/自用记录
- 📊 **三类输出**: 终端摘要、机器可读JSON、Markdown报告
- 📍 **原始位置追踪**: 坏行和异常记录保留原始文件行号，方便定位

## 安装

```bash
npm install
```

## 使用方法

### 基本使用

```bash
node src/index.js examples/airbnb.csv examples/tujia.csv examples/calendar.ics
```

### 指定输出目录

```bash
node src/index.js examples/airbnb.csv -o ./my-output
```

### 指定平台名称

```bash
node src/index.js airbnb.csv tujia.csv -p 爱彼迎 途家
```

### 只生成特定输出

```bash
# 只生成JSON，不生成Markdown
node src/index.js airbnb.csv --no-markdown

# 只显示终端摘要，不生成文件
node src/index.js airbnb.csv --no-json --no-markdown
```

### 完整选项

```
Usage: homestay-import [options] <files...>

民宿房态导入工具 - 合并多平台房态日历，检测冲突，保留锁房

Options:
  -V, --version                  output the version number
  -o, --output <dir>             输出目录 (default: "./output")
  --name <name>                  输出文件名前缀 (default: "calendar")
  -p, --platform <names...>     平台名称，按输入文件顺序 (default: ["airbnb","tujia","xiecheng"])
  --no-json                      不生成JSON输出
  --no-markdown                  不生成Markdown报告
  --no-summary                   不显示终端摘要
  -h, --help                     display help for command
```

## 输入文件格式

### CSV格式

支持自动识别以下列名（中文/英文均可）：
- 房源/房间/room/房源名称
- 入住/入住日期/checkin/arrival
- 退房/退房日期/checkout/departure
- 原因/备注/reason/锁房原因
- 客人/客户/guest/房客/姓名

示例：
```csv
房源,入住日期,退房日期,客人姓名,备注
海景房A,2024-06-01,2024-06-03,张先生,
```

### ICS格式

标准iCalendar格式，支持：
- SUMMARY字段自动解析房源名和客人信息
- 支持"房源:客人"格式
- 支持"锁房:"前缀识别锁房记录

## 输出说明

### 1. 终端摘要

- 统计信息：输入文件、房源数、订单数、冲突数
- 解析错误：显示前10条错误，包含文件和行号
- 房态冲突：按房源分组，显示冲突详情
- 合并后订单概览：显示各房源订单列表

### 2. JSON结果（机器可读）

包含完整的处理结果，便于后续程序处理：
- 统计信息
- 错误详情
- 冲突详情
- 合并后的订单列表
- 无效记录列表

### 3. Markdown报告

给同事查看的友好格式，包含：
- 统计表格
- 错误详情表格
- 冲突详情表格
- 合并后房态详情
- 无法处理的记录

## 示例

```bash
# 使用示例数据
node src/index.js examples/airbnb.csv examples/tujia.csv examples/calendar.ics
```

输出文件：
- `output/calendar.json` - 机器可读结果
- `output/calendar.md` - Markdown格式报告

## 关键处理规则

### 连住合并规则
同一房源、同一客人（或同一原因）、日期连续的订单会自动合并。

### 冲突检测规则
两个订单的日期区间有重叠时，标记为冲突。其中包含锁房的标记为锁房冲突。

### 锁房识别规则
原因字段包含以下关键词时识别为锁房：
- 锁
- 维护
- 自用
- block
