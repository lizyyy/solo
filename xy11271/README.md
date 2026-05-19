# 客服质检系统

一个专门用于治理客服质检组长乱账的系统，核心解决外包转写文本中经常漏掉道歉、退款承诺和敏感词的问题。

## 核心功能

- ✅ **批量数据导入** - 支持转写文本、通话元数据、敏感词批量导入
- ✅ **智能质量检测** - 自动检测道歉用语、退款承诺、敏感词
- ✅ **失败记录追踪** - 导入失败时保留原始位置、错误原因和修改建议
- ✅ **幂等操作** - 重试失败记录不会破坏已成功导入的数据
- ✅ **复核管理** - 对待复核通话进行标记、评分和备注
- ✅ **数据导出** - 支持导出通话记录、质检问题、复核结果和统计数据

## 项目结构

```
quality-inspection-system/
├── src/
│   ├── models/            # 数据模型
│   ├── repositories/      # 数据访问层
│   ├── services/          # 业务逻辑层
│   ├── cli/               # 命令行工具
│   └── config/            # 配置文件
├── data/
│   ├── samples/           # 示例数据
│   └── exports/           # 导出文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 导入示例数据

#### 导入敏感词库

```bash
npm run import -- sensitive data/samples/sensitive_words.txt
```

#### 导入转写文本（会自动进行质量检测）

```bash
npm run import -- transcript data/samples/transcripts.txt
```

#### 导入通话元数据

```bash
npm run import -- metadata data/samples/metadata.csv
```

### 3. 查看质检结果

查看待复核通话列表：

```bash
npm run review -- list
```

查看某个通话的具体质检问题：

```bash
npm run review -- issues <transcript_id>
```

查看质检统计：

```bash
npm run review -- stats
```

### 4. 提交复核结果

```bash
npm run review -- submit \
  --transcript <transcript_id> \
  --result pass \
  --score 95 \
  --comments "服务态度良好，问题处理及时" \
  --reviewer "质检组长"
```

参数说明：
- `--result`: 复核结果，可选值 `pass` / `fail` / `need_review`
- `--score`: 评分，0-100 分
- `--comments`: 复核评语（可选）
- `--correction`: 纠正说明（可选）

### 5. 导出数据

导出全部数据：

```bash
npm run export -- all
```

单独导出：

```bash
# 导出通话记录
npm run export -- transcripts

# 导出质检问题
npm run export -- issues

# 导出复核记录
npm run export -- reviews

# 导出统计数据
npm run export -- stats
```

## 数据格式说明

### 转写文本格式

```
[CALL_ID]: CALL_001
[00:00:01] 客服小美: 您好，请问有什么可以帮您？
[00:00:08] 客户张先生: 我要投诉...
[00:00:15] 客服小美: 非常抱歉给您带来不便...
```

### 敏感词格式

```
敏感词,分类,严重程度(1-3),描述,建议处理
垃圾,辱骂,2,辱骂性语言,警告并要求文明用语
骗子,辱骂,2,辱骂性语言,警告并要求文明用语
```

### 元数据CSV格式

```csv
callId,agentId,agentName,customerPhone,startTime,duration,direction,status,queueName,tags
CALL_001,AGT001,小美,13800138001,2024-01-15 09:30:00,185,inbound,completed,投诉组,退款
```

## 检测规则

### 道歉用语检测（必须包含）

- 抱歉、对不起、不好意思
- 道歉、深表歉意
- 给您带来不便

### 退款承诺检测（必须包含）

- 退款、退钱、返还
- 赔付、赔偿、补款
- 帮您申请、可以退款

### 敏感词检测（禁止出现）

- 辱骂性语言（垃圾、骗子、傻逼等）
- 严重侮辱词语

## 批量导入特性

- ✅ **错误隔离** - 单条记录失败不影响其他记录
- ✅ **详细错误信息** - 显示行号、错误原因、原始内容
- ✅ **修改建议** - 提供具体的修复建议
- ✅ **幂等重试** - 支持对失败记录单独重试

## 统计指标

系统提供以下统计数据：

- 总通话数、已处理数、已复核数
- 缺少道歉的通话数
- 缺少退款承诺的通话数
- 含敏感词的通话数
- 问题总数及分类统计
- 复核通过率、平均分

## 示例数据说明

`data/samples/` 目录包含5条示例通话：

| 通话ID | 状态说明 |
|--------|----------|
| CALL_001_NORMAL | 正常，包含道歉和退款承诺 |
| CALL_002_MISSING_APOLOGY | 缺少道歉用语 |
| CALL_003_MISSING_REFUND | 缺少退款承诺 |
| CALL_004_WITH_SENSITIVE | 包含敏感词 |
| CALL_005_FULL_ISSUES | 缺少道歉、缺少退款承诺、含敏感词 |

## 命令参考

### 导入命令

```bash
# 查看导入帮助
npm run import -- --help

# 导入转写文本
npm run import -- transcript <file>

# 导入元数据
npm run import -- metadata <file>

# 导入敏感词
npm run import -- sensitive <file>

# 查看批次详情
npm run import -- batch <batch_id>
```

### 复核命令

```bash
# 查看复核帮助
npm run review -- --help

# 列出待复核通话
npm run review -- list [--limit 50]

# 查看通话问题
npm run review -- issues <transcript_id>

# 提交复核结果
npm run review -- submit --transcript <id> --result <pass/fail/need_review> --score <0-100>

# 查看统计
npm run review -- stats
```

### 导出命令

```bash
# 查看导出帮助
npm run export -- --help

# 导出全部
npm run export -- all [--dir <path>]

# 导出通话
npm run export -- transcripts [--output <file>] [--status <pending/processed/reviewed>]

# 导出问题
npm run export -- issues [--output <file>] [--status <open/confirmed/false_positive>]

# 导出复核
npm run export -- reviews [--output <file>]

# 导出统计
npm run export -- stats [--output <file>]
```
