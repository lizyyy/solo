# 任务失败知识库 CLI (failure-kb)

一个用于记录和搜索任务失败处理经验的命令行工具。帮助值班同事快速找到历史解决方案，而不用去翻群聊记录。

## 功能特性

- **错误指纹生成**: 基于任务名、错误码、堆栈跟踪和上下文生成唯一指纹
- **智能相似度匹配**: 多维度计算相似度（错误码、堆栈、任务名、上下文）
- **反馈学习**: 用户反馈影响推荐排序
- **知识过期管理**: 90天自动过期，不删除只提示复核
- **新人友好**: 解决方案包含详细步骤，可直接跟随操作

## 安装

```bash
npm install
```

## 快速开始

### 1. 初始化示例数据

```bash
node index.js init-samples
```

这会导入4个典型场景的示例：
- 数据库超时 (Connection timeout)
- 权限缺失 (AccessDenied)
- 数据格式错误 (Invalid JSON)
- 外部依赖失败 (ECONNREFUSED)

### 2. 搜索相似问题

```bash
# 根据新的失败日志推荐解决方案
node index.js suggest -t daily-report-generator -m "Connection timeout"
```

### 3. 导入新的失败日志

```bash
# 从命令行参数导入
node index.js ingest -t my-task -m "Error: something went wrong" -n "初步观察"

# 从文件导入
node index.js ingest -t my-task -f /path/to/error.log -r "解决方案步骤..."
```

### 4. 记录处理结果

```bash
node index.js resolve -i <entry-id> -r "问题已通过重启服务解决" -b "张三"
```

### 5. 反馈推荐效果

```bash
# 标记为有用（下次优先推荐）
node index.js feedback -i <entry-id> --useful

# 标记为无用（下次降低优先级）
node index.js feedback -i <entry-id> --not-useful
```

### 6. 生成知识报告

```bash
# 控制台输出
node index.js report

# 保存到文件
node index.js report -o report.txt

# JSON格式
node index.js report --json -o report.json
```

## 命令详解

### ingest - 导入失败日志

| 参数 | 说明 | 必填 |
|------|------|------|
| `-t, --task` | 任务名称 | 是 |
| `-m, --message` | 错误信息 | 否（需提供message、stack、file之一） |
| `-s, --stack` | 错误堆栈 | 否 |
| `-f, --file` | 从文件读取 | 否 |
| `-c, --context` | 任务上下文（JSON） | 否 |
| `-n, --notes` | 处理备注 | 否 |
| `-r, --resolution` | 解决方案 | 否 |

**示例:**
```bash
# 基本用法
node index.js ingest -t data-import -m "Error: timeout"

# 带上下文和备注
node index.js ingest -t data-import \
  -m "Connection refused" \
  -c '{"db":"main","env":"prod"}' \
  -n "出现在每天凌晨3点"

# 如果是相同错误指纹，会更新现有条目而不是创建新的
```

### search - 搜索历史知识

| 参数 | 说明 |
|------|------|
| `-t, --task` | 按任务名称搜索 |
| `-s, --status` | 按状态筛选 (pending/resolved) |
| `-e, --expired` | 只显示过期条目 |
| `-a, --active` | 只显示有效条目 |
| `-r, --review` | 只显示需复核条目 |
| `-i, --id` | 按ID查看详情 |

**示例:**
```bash
# 查看所有已解决条目
node index.js search -s resolved

# 按任务名搜索
node index.js search -t daily-report

# 查看过期需复核的条目
node index.js search --review
```

### suggest - 智能推荐

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-t, --task` | 任务名称 | 必填 |
| `-m, --message` | 错误信息 | - |
| `-s, --stack` | 错误堆栈 | - |
| `-f, --file` | 从文件读取 | - |
| `-c, --context` | 任务上下文 | - |
| `-n, --limit` | 返回结果数量 | 5 |
| `--threshold` | 相似度阈值 (0-1) | 0.2 |

**相似度说明:**
- 推荐结果会显示匹配原因，来自以下维度：
  - **错误码**: 权重35%，识别同类错误
  - **堆栈片段**: 权重30%，识别相同代码路径
  - **任务名**: 权重20%，识别相同任务
  - **上下文**: 权重15%，识别相同环境/配置

### resolve - 记录处理结果

| 参数 | 说明 |
|------|------|
| `-i, --id` | 知识条目ID（必填） |
| `-r, --resolution` | 解决方案 |
| `-n, --notes` | 处理备注 |
| `-b, --by` | 处理人 |
| `--extend` | 延长过期时间 |

**示例:**
```bash
# 添加解决方案
node index.js resolve -i xxxx-xxxx \
  -r "步骤1: 检查配置\n步骤2: 重启服务" \
  -b "李四"

# 确认知识有效，延长过期
node index.js resolve -i xxxx-xxxx --extend
```

### feedback - 用户反馈

| 参数 | 说明 |
|------|------|
| `-i, --id` | 知识条目ID（必填） |
| `--useful` | 标记为有用 |
| `--not-useful` | 标记为无用 |

**反馈影响:**
- 有用反馈: 评分+1，下次优先推荐
- 无用反馈: 评分-1，下次降低优先级
- 评分用于最终推荐排序计算

### report - 生成报告

| 参数 | 说明 |
|------|------|
| `-o, --output` | 输出文件路径 |
| `--json` | JSON格式输出 |

报告包含:
- 总体统计（总数、已解决、待处理、过期、需复核）
- 反馈统计（有用率）
- 涉及任务列表
- 常见错误码
- 待处理条目（前10条）
- 需复核条目（前10条）
- 最有帮助的解决方案（前5条）

## 工作原理

### 错误指纹算法

```
fingerprint = hash(taskName + errorCode + stackSignature + contextHash)
```

- **errorCode**: 从错误信息中提取（支持多种格式）
- **stackSignature**: 取前5个调用栈帧，去除行号
- **contextHash**: 上下文参数的MD5哈希

### 相似度计算

采用加权平均：
```
总相似度 = errorCode * 0.35 + stackTrace * 0.30 + taskName * 0.20 + context * 0.15
```

最终推荐分数：
```
推荐分数 = 相似度 * 100 + 反馈评分 * 5 + 有用数 * 2 - 无用数 * 3
过期条目分数 * 0.5
```

### 过期策略

- 知识条目默认90天过期
- 过期不删除，标记为"需复核"
- 有人确认有效后（--extend），再延长90天
- 过期条目推荐优先级减半

## 数据存储

数据存储在当前目录的 `.failure-kb/knowledge.json` 文件中。

数据结构:
```json
{
  "id": "uuid",
  "fingerprint": {
    "taskName": "...",
    "errorCode": "...",
    "stackSignature": "...",
    "contextHash": "..."
  },
  "fingerprintHash": "sha256",
  "errorMessage": "...",
  "stackTrace": "...",
  "resolution": "...",
  "notes": "...",
  "status": "pending|resolved",
  "usefulCount": 0,
  "notUsefulCount": 0,
  "feedbackScore": 0,
  "expiryDate": "ISO日期"
}
```

## 使用场景

### 场景1: 值班遇到新问题

1. 复制错误信息
2. 运行 `suggest` 命令查找相似历史
3. 按照推荐的解决方案操作
4. 如果有用，运行 `feedback --useful`
5. 如果无用，运行 `feedback --not-useful` 并记录新方案

### 场景2: 记录新解决方案

1. 问题解决后，运行 `ingest` 导入错误信息
2. 或使用 `resolve` 补充解决方案
3. 知识会在90天内有效

### 场景3: 定期知识维护

1. 运行 `report` 查看知识库状态
2. 运行 `search --review` 查看过期条目
3. 对仍有效的条目运行 `resolve --extend`

## 示例演练

```bash
# 1. 初始化示例数据
node index.js init-samples

# 2. 模拟遇到数据库超时问题
node index.js suggest -t daily-report-generator -m "Connection timeout after 30000ms"

# 3. 查看某个条目的详细信息
node index.js search -i <id-from-suggest>

# 4. 假设解决方案有效，反馈有用
node index.js feedback -i <id> --useful

# 5. 导入一个新问题
node index.js ingest -t new-task -m "Error: disk full" -n "服务器磁盘满了"

# 6. 解决后记录方案
node index.js resolve -i <new-entry-id> \
  -r "1. df -h 查看磁盘\n2. 清理日志文件\n3. 联系运维扩容" \
  -b "张三"

# 7. 生成报告
node index.js report
```

## 许可证

MIT
