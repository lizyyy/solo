# 死信队列消息采样 CLI

从大量死信消息中快速提取有代表性的样本，帮助开发团队高效定位问题。

## 功能特性

- **JSONL 读取**: 支持逐行解析，处理大文件
- **错误原因分组**: 自动按错误类型聚类统计
- **分层采样**: 按占比分配采样数，小概率问题也不遗漏
- **敏感数据脱敏**: 自动处理手机号、邮箱、密码等
- **多格式输出**: 终端摘要、机器可读 JSON、团队分享报告

## 安装

```bash
# 克隆或下载项目后
pip install -e .

# 或直接安装依赖
pip install -r requirements.txt
```

## 使用示例

### 基础用法
```bash
deadletter-sampler deadletters.jsonl
```

### 自定义输出目录
```bash
deadletter-sampler deadletters.jsonl -o ./my_output
```

### 调整采样数
```bash
# 总共最多采样 200 条，每组最多 10 条
deadletter-sampler deadletters.jsonl -n 200 --max-per-group 10
```

### 禁用脱敏
```bash
deadletter-sampler deadletters.jsonl --no-redact
```

### 指定字段名
```bash
# 如果错误原因字段是 "err_msg"，业务键字段是 "order_no"
deadletter-sampler deadletters.jsonl \
    --error-field err_msg \
    --key-field order_no
```

### 静默模式
```bash
deadletter-sampler deadletters.jsonl -q
```

## 输入格式 (JSONL)

每行一个 JSON 对象，推荐包含：

```json
{"error_reason": "数据库连接超时", "business_key": "order_123", "payload": "..."}
{"error_reason": "参数校验失败", "business_key": "user_456", "payload": "..."}
```

### 支持的错误原因字段名（自动识别）
- `error_reason` (默认)
- `reason`
- `error`
- `exception`

### 支持的业务键字段名（自动识别）
- `business_key` (默认)
- `order_id`
- `user_id`
- `transaction_id`
- `biz_id`
- `key`

## 输出文件

运行后在输出目录生成以下文件：

| 文件 | 说明 |
|------|------|
| `summary.json` | 机器可读的完整统计数据，包含所有错误类型分布 |
| `samples.jsonl` | 采样结果，JSONL 格式，已脱敏 |
| `errors.jsonl` | 解析错误的原始行，保留行号方便定位 |
| `report.md` | 适合发给团队的 Markdown 格式报告 |

## 采样算法说明

采用**分层采样 (Stratified Sampling)**：

1. 每个错误类型至少采样 1 条（确保小概率问题不遗漏）
2. 剩余配额按错误类型占比分配（确保大问题有足够样本）
3. 可配置每组最大采样数（避免某类占用太多配额）

## 常见问题

### Q: 遇到解析错误怎么办？
A: 查看 `errors.jsonl` 文件，里面包含了原始行号和错误原因。常见原因：
- 文件编码不是 UTF-8
- 某行 JSON 格式不完整
- 有空行

### Q: 如何自定义脱敏规则？
A: 直接修改 `deadletter_sampler/redactor.py` 中的正则和关键字。

### Q: 为什么采样数可能小于配置的 max-samples？
A: 如果错误类型很少，或者消息总数很少，采样不会超过实际消息数。

## 完整命令行参数

```
Arguments:
  input_file                  死信消息 JSONL 文件路径

Options:
  -o, --output-dir            输出目录 (默认: ./deadletter_output)
  -n, --max-samples INTEGER   最大采样总数 (默认: 100)
  --max-per-group INTEGER     每组最大采样数 (默认: 无限制)
  --min-per-group INTEGER     每组最小采样数 (默认: 1)
  --error-field TEXT          错误原因字段名 (默认: error_reason)
  --key-field TEXT            业务键字段名 (默认: business_key)
  --seed INTEGER              随机种子 (默认: 42)
  --no-redact                 禁用敏感数据脱敏
  -q, --quiet                 静默模式
  --help                      显示帮助信息
```
