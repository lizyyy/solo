# 客服知识库命中率统计 CLI (kbhr)

一个本地可运行的客服知识库命中率统计工具，帮助客服主管了解哪些知识文章真正被用到，而不是只看文章浏览量。

## 功能特性

- **多维度统计**: 按问题、答案、客服引用、用户反馈统计命中率
- **会话级命中**: 处理同一会话多篇文章的情况
- **智能识别**: 区分客服直接复制和改写后的引用
- **版本追踪**: 处理文章改版后历史归属问题
- **幂等设计**: 重复导入、重复执行保持数据一致
- **人工修正留痕**: 所有修正操作记录前后差异和操作者
- **完整追踪**: 每一步都有状态变化、历史记录和失败原因

## 安装

### 环境要求
- Python 3.9+
- pip 或 poetry

### 安装步骤

```bash
cd /path/to/project
pip install -e .
```

或者使用 development mode:
```bash
pip install -e .
```

## 快速开始

### 1. 初始化数据库

```bash
kbhr init
```

输出示例:
```
初始化中...
  数据库路径: /Users/xxx/.kbhr/kbhr.db
  数据目录: /Users/xxx/.kbhr/data
✓ 初始化完成

下一步操作:
  1. kbhr sample          生成样例数据
  2. kbhr import <file>   导入数据文件
  3. kbhr check           计算命中率
  4. kbhr report          查看报告
```

### 2. 生成样例数据

内置样例涵盖三大业务场景:
- **退款**: 退款流程、退款失败原因
- **物流**: 物流查询、商品损坏处理
- **账号**: 密码找回、账号注销

```bash
kbhr sample
```

输出示例:
```
生成样例数据...
  知识库文章: 7 篇
  客服会话: 10 个
  机器人推荐: 10 条
  客服引用: 4 条
  用户反馈: 10 条

导入数据...
  总计: 41 条
  成功: 41
  跳过(重复): 0
  失败: 0

计算命中率...
  创建命中事件: 14
  跳过重复: 0

✓ 样例数据准备完成

下一步:
  kbhr report    查看综合报告
```

### 3. 查看综合报告

```bash
kbhr report
```

报告包含:
- 📊 综合概览（文章数、总命中、转化率）
- 🔥 高命中文章 TOP 5
- ⚠️ 低转化文章 TOP 5
- 🔧 建议改写的文章
- 📁 按分类统计

### 4. 查看文章详情

```bash
kbhr detail KB-REFUND-002
```

查看特定文章的:
- 基本信息和命中统计
- 版本历史
- 人工修正记录
- 最近命中明细

### 5. 对比文章版本差异

```bash
kbhr detail KB-REFUND-001 --diff 1 2
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `kbhr init` | 初始化数据库和目录结构 |
| `kbhr sample` | 生成并导入内置样例数据 |
| `kbhr import <file>` | 导入自定义JSON数据文件 |
| `kbhr check` | 重新计算命中率 |
| `kbhr status` | 查看系统状态 |
| `kbhr status --history` | 查看导入历史 |
| `kbhr status --logs` | 查看系统日志 |
| `kbhr detail <id>` | 查看文章详情 |
| `kbhr detail <id> --diff v1 v2` | 对比两个版本 |
| `kbhr report` | 生成综合报告 |
| `kbhr report --json` | 导出JSON格式报告 |

## 数据格式

导入文件为JSON格式，结构如下:

```json
{
  "articles": [
    {
      "article_id": "KB-001",
      "version": 1,
      "title": "文章标题",
      "content": "文章内容...",
      "category": "分类",
      "tags": ["标签1", "标签2"],
      "is_active": true
    }
  ],
  "conversations": [
    {
      "conversation_id": "CONV-001",
      "user_id": "USER-001",
      "agent_id": "AGENT-001",
      "started_at": "2026-05-01T10:00:00",
      "ended_at": "2026-05-01T10:05:00",
      "channel": "web",
      "summary": "会话摘要",
      "messages": [
        {
          "message_id": "msg-001",
          "sender_type": "user",
          "content": "用户消息内容",
          "timestamp": "2026-05-01T10:00:00"
        }
      ]
    }
  ],
  "recommendations": [
    {
      "recommendation_id": "REC-001",
      "conversation_id": "CONV-001",
      "message_id": "msg-002",
      "article_id": "KB-001",
      "article_version": 1,
      "rank": 1,
      "score": 0.95,
      "recommended_at": "2026-05-01T10:00:05"
    }
  ],
  "citations": [
    {
      "citation_id": "CITE-001",
      "conversation_id": "CONV-001",
      "message_id": "msg-003",
      "article_id": "KB-001",
      "article_version": 1,
      "cited_text": "引用的具体文本",
      "is_copy": false,
      "is_rewritten": true,
      "cited_at": "2026-05-01T10:02:00"
    }
  ],
  "feedbacks": [
    {
      "feedback_id": "FB-001",
      "conversation_id": "CONV-001",
      "article_id": "KB-001",
      "rating": 5,
      "comment": "很有帮助",
      "is_helpful": true,
      "resolved": true,
      "feedback_at": "2026-05-01T10:06:00"
    }
  ]
}
```

## 核心规则

### 1. 同一会话多篇文章
- 每篇文章独立记录命中
- 按`conversation_id + article_id`去重
- 同一会话同一文章多次推荐只算一次

### 2. 客服复制与改写
- `is_copy=true`: 客服直接复制文章内容
- `is_rewritten=true`: 客服改写后使用
- 命中类型分别标记为 `cited_copy` 和 `cited_rewritten`

### 3. 反馈缺失处理
- 无反馈的命中事件只记录命中
- 转化率统计只计算有反馈的数据
- 报告中明确区分"有反馈"和"无反馈"

### 4. 文章改版历史归属
- 每篇文章支持多版本（version字段）
- 历史命中归属到当时的版本
- `detail`命令可查看所有版本
- `--diff` 对比版本差异

### 5. 重复导入幂等
- 所有数据有唯一ID
- 重复导入时跳过已存在记录
- 导入记录显示跳过数量

### 6. 人工修正留痕
- 所有手动修改写入 `manual_corrections` 表
- 记录 `before_value` 和 `after_value`
- 记录 `operator` 操作者

## 主要演示路径

### 完整演示流程

```bash
# 1. 初始化
kbhr init

# 2. 导入样例数据（包含退款、物流、账号三大场景）
kbhr sample

# 3. 查看综合报告
kbhr report

# 4. 查看高命中文章详情
kbhr detail KB-REFUND-001

# 5. 对比改版前后版本
kbhr detail KB-REFUND-001 --diff 1 2

# 6. 查看低转化文章（建议改写）
kbhr detail KB-REFUND-002

# 7. 查看导入历史
kbhr status --history

# 8. 导出JSON报告
kbhr report --json > report.json
```

### 失败路径演示

```bash
# 1. 导入不存在的文件（失败场景1）
kbhr import /path/to/nonexistent.json
# 输出: 文件不存在

# 2. 导入格式错误的JSON（失败场景2）
echo 'invalid json' > bad.json
kbhr import bad.json
# 输出: JSON解析错误

# 3. 查看错误日志
kbhr status --logs
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `KBHR_DB` | 数据库文件路径 | `~/.kbhr/kbhr.db` |
| `KBHR_DATA_DIR` | 数据目录 | `~/.kbhr/data` |
| `KBHR_OPERATOR` | 操作者标识 | `system` |

示例:
```bash
# 使用独立数据库进行测试
KBHR_DB=/tmp/test.db kbhr init
KBHR_DB=/tmp/test.db kbhr sample
KBHR_DB=/tmp/test.db kbhr report
```

## 项目结构

```
.
├── pyproject.toml
├── README.md
└── src/
    └── kb_hit_rate/
        ├── __init__.py
        ├── config.py          # 配置管理
        ├── models.py          # 数据模型
        ├── database.py        # 数据库管理
        ├── data_schema.py     # 输入数据Schema
        ├── importer.py        # 数据导入器
        ├── hit_calculator.py  # 命中率计算
        ├── report_generator.py # 报告生成
        ├── sample_data.py     # 内置样例数据
        └── cli.py             # 命令行入口
```

## 统计指标说明

| 指标 | 说明 |
|------|------|
| 总命中次数 | 机器人推荐 + 客服引用次数 |
| 唯一会话数 | 覆盖的不同会话数量 |
| 机器人推荐 | 机器人自动推荐的次数 |
| 客服引用 | 客服实际使用的次数 |
| 直接复制 | 客服直接复制原文 |
| 改写后使用 | 客服改写内容后使用 |
| 转化率 | 有帮助反馈 / 总反馈 * 100% |
| 建议改写 | 无帮助率 ≥ 40% 且反馈 ≥ 3条 |
