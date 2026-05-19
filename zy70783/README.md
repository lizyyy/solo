# TraceID 多源拼接排查 CLI

一个专为真实研发团队设计的命令行工具，用于在网关、应用、任务日志之间自动拼接 Trace 链路，解决手动排查时容易漏掉中间段的问题。

## ✨ 核心特性

- **多源日志聚合**: 同时读取网关、应用、任务等多个日志文件
- **智能日志解析**: 支持多种主流日志格式（Spring Boot、JSON、自定义格式）
- **时间自动排序**: 按时间戳自动排序所有日志
- **缺口智能识别**: 检测异常时间缺口、缺失的父 Span、重复 Span
- **双输出格式**: 同时生成人读的 Markdown 报告和机器读的 JSON 数据
- **通配符支持**: 支持 `*.log` 等通配符批量加载

## 🚀 快速开始

### 环境要求
- Python 3.7+
- 无需额外依赖（纯标准库实现）

### 基本用法

```bash
# 查看帮助
python3 trace_debugger.py -h

# 列出所有 Trace ID
python3 trace_debugger.py -f gateway.log app.log task.log --list-traces

# 分析指定 Trace ID，生成 Markdown 报告
python3 trace_debugger.py -f gateway.log app.log task.log -t 4a3b2c1d0e9f8g7h

# 同时生成 JSON 机器可读输出
python3 trace_debugger.py -f *.log -t 4a3b2c1d0e9f8g7h --json-output result.json

# 自定义时间缺口阈值（默认 5000ms）
python3 trace_debugger.py -f *.log -t 4a3b2c1d0e9f8g7h --max-gap 3000
```

## 📁 测试样例说明

本项目包含真实场景的测试数据，覆盖以下场景：

| 文件 | 场景 | 说明 |
|------|------|------|
| `gateway.log` | 正常网关日志 | API 网关入口日志 |
| `app.log` | 正常应用日志 | 订单服务、库存服务调用链 |
| `task.log` | 正常任务日志 | 异步任务执行日志 |
| `dirty_data.log` | 脏数据测试 | 包含无效格式、缺失 Span、重复 Span |

## 🔍 检测能力说明

### 1. 时间缺口检测
自动识别相邻 Span 之间的时间差是否超过阈值，帮助发现：
- 网络超时
- 第三方服务延迟
- 日志丢失

### 2. 缺失 Span 检测
检查所有 `parentSpanId` 是否存在，帮助发现：
- 中间服务日志未收集
- 跨链路 Trace 丢失
- 日志采样导致的断链

### 3. 重复 Span 检测
检测同一 Span ID 出现多次的情况，帮助发现：
- 日志重复上报
- 服务重试导致重复记录
- Span ID 生成冲突

## 📊 报告结构

### Markdown 报告包含
1. **链路概览表格**: 所有 Span 的时间线视图
2. **时序分析**: 总耗时、起止时间
3. **问题检测汇总**: 缺口、缺失、重复 Span 详细列表
4. **服务调用关系图**: Mermaid 可视化
5. **原始日志附录**: 便于溯源

### JSON 输出包含
- 完整的结构化日志条目
- 所有检测到的问题详情
- 统计汇总信息
- 可直接导入其他分析工具

## 🛠 支持的日志格式

工具自动识别以下格式：

```text
# 格式 1: 方括号服务名
2026-05-19 10:00:00.123 INFO [api-gateway] traceId=xxx, spanId=yyy

# 格式 2: key=value 格式  
2026-05-19T10:00:00.200Z INFO serviceName=order-service traceId=xxx

# 格式 3: JSON 格式
{"timestamp":"...","traceId":"xxx","spanId":"yyy"}
```

## 🎯 典型工作流

### 场景 1: 线上问题快速排查
```bash
# Step 1: 下载所有相关日志到当前目录
# gateway.log, app.log, task.log

# Step 2: 列出所有 Trace，找异常的
python3 trace_debugger.py -f *.log --list-traces

# Step 3: 深入分析可疑 Trace
python3 trace_debugger.py -f *.log -t 4a3b2c1d0e9f8g7h -o analysis.md
```

### 场景 2: 验证链路完整性
```bash
# 使用包含脏数据的日志进行鲁棒性测试
python3 trace_debugger.py -f *.log dirty_data.log -t 4a3b2c1d0e9f8g7h
```

## 📝 使用示例

### 列出现有 Trace ID
```
Trace ID                            条目数   服务数
--------------------------------------------------
4a3b2c1d0e9f8g7h                       11       5
1b2c3d4e5f6a7b8c                        1       1
9z8y7x6w5v4u3t2s                        1       1
```

### 分析结果输出
```
============================================================
🔍 TraceID 多源拼接排查 CLI
============================================================
📁 加载 4 个日志文件...
  解析: gateway.log
  解析: app.log
  解析: task.log
  解析: dirty_data.log
✅ 解析完成: 14 条有效日志, 7 条跳过

📍 找到 Trace: 4a3b2c1d0e9f8g7h
   日志条目: 11
   涉及服务: 5

🔍 问题检测结果:
   时间缺口: 1
   缺失 Span: 1
   重复 Span: 1

📄 Markdown 报告已生成: trace_report.md
📄 JSON 输出已生成: result.json

🎉 分析完成!
```

## 🤝 为团队优化的设计

1. **零依赖**: 直接运行，不需要 pip install 任何东西
2. **出错提示友好**: 找不到 Trace 时会提示使用 `--list-traces`
3. **进度反馈**: 解析大文件时显示实时进度
4. **编码兼容**: 自动处理 UTF-8 和 GBK 编码问题
5. **增量支持**: 只需要加日志文件，不需要修改工具代码

---

**同事，再也不用在三个日志文件之间反复 Ctrl+F 了！** 🎉
