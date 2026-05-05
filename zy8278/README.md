# 赛事评分排名复核 API 服务

本地赛事评分排名复核服务，支持培训机构赛后导入数据、排名预览、申诉调整和报告导出。

## 功能特性

- **数据导入**: 支持导入 `contestants.csv`、`judge_scores.csv`、`rank_rules.yaml` 和 `appeals.jsonl`
- **排名计算**:
  - 支持去掉最高/最低分
  - 两种排名模式:
    - 竞赛排名 (1, 2, 2, 4) - 并列名次占位
    - 密集排名 (1, 2, 2, 3) - 并列名次不占位
- **晋级标记**:
  - 晋级线附近同分选手 (tie_at_boundary)
  - 刚好等于边界分选手 (exactly_boundary)
  - 申诉改分后跨线选手 (cross_line_after_appeal)
- **申诉管理**: 支持导入申诉记录、审核通过/驳回
- **报告导出**: 导出排名 CSV 和复核报告 Markdown

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/

## API 使用指南 (curl 演示)

### 数据导入

#### 1. 导入选手信息

```bash
curl -X POST "http://localhost:8000/import/contestants" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/contestants.csv"
```

#### 2. 导入评委打分

```bash
curl -X POST "http://localhost:8000/import/judge-scores" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/judge_scores.csv"
```

#### 3. 导入排名规则

```bash
curl -X POST "http://localhost:8000/import/rank-rules" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/rank_rules.yaml"
```

#### 4. 导入申诉记录

```bash
curl -X POST "http://localhost:8000/import/appeals" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/appeals.jsonl"
```

### 排名查询

#### 1. 获取完整排名

```bash
curl "http://localhost:8000/ranking"
```

#### 2. 按类别筛选排名

```bash
curl "http://localhost:8000/ranking?category=少年组"
```

#### 3. 指定排名模式 (覆盖配置)

```bash
# 使用密集排名
curl "http://localhost:8000/ranking?ranking_mode=dense"

# 使用竞赛排名
curl "http://localhost:8000/ranking?ranking_mode=competition"
```

#### 4. 自定义晋级规则

```bash
# 自定义晋级名额为前 3 名
curl "http://localhost:8000/ranking?promotion_threshold=3"

# 自定义晋级分数线为 9.0 分
curl "http://localhost:8000/ranking?promotion_score=9.0"
```

#### 5. 排名预览 (对比两种模式)

```bash
curl "http://localhost:8000/ranking/preview?compare_modes=true"
```

### 申诉管理

#### 1. 获取申诉列表

```bash
# 获取所有申诉
curl "http://localhost:8000/appeals"

# 按状态筛选
curl "http://localhost:8000/appeals?status=pending"
curl "http://localhost:8000/appeals?status=approved"
curl "http://localhost:8000/appeals?status=rejected"
```

#### 2. 处理申诉

```bash
# 通过申诉 (appeal_id 需要从列表中获取)
curl -X POST "http://localhost:8000/appeals/1/process?approve=true"

# 驳回申诉
curl -X POST "http://localhost:8000/appeals/2/process?approve=false"
```

### 报告导出

#### 1. 导出排名 CSV

```bash
# 导出全部排名
curl -o ranking_all.csv "http://localhost:8000/report/csv"

# 按类别导出
curl -o ranking_少年组.csv "http://localhost:8000/report/csv?category=少年组"
```

#### 2. 导出复核报告 (Markdown)

```bash
curl -o review_report.md "http://localhost:8000/report/md"
```

### 统计信息

```bash
curl "http://localhost:8000/stats"
```

## 数据文件格式说明

### 1. contestants.csv (选手信息)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| contestant_id | string | 是 | 选手唯一标识 |
| name | string | 是 | 选手姓名 |
| category | string | 否 | 组别/类别 |
| group | string | 否 | 分组 |
| info | string | 否 | 其他信息 |

示例:
```csv
contestant_id,name,category,group,info
C001,张明,少年组,A组,钢琴演奏
C002,李华,少年组,A组,小提琴演奏
```

### 2. judge_scores.csv (评委打分)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| contestant_id | string | 是 | 选手ID |
| judge_id | string | 是 | 评委ID |
| score | float | 是 | 分数 |

示例:
```csv
contestant_id,judge_id,score
C001,J1,8.5
C001,J2,9.0
C001,J3,8.8
```

### 3. rank_rules.yaml (排名规则)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rule_name | string | 否 | 规则名称 |
| drop_highest | int | 否 | 去掉最高分数量 (默认0) |
| drop_lowest | int | 否 | 去掉最低分数量 (默认0) |
| ranking_mode | string | 否 | 排名模式: competition/dense |
| promotion_threshold | int | 否 | 晋级名额 (前N名) |
| promotion_score | float | 否 | 晋级分数线 |
| categories | list | 否 | 有效类别列表 |

示例:
```yaml
rule_name: "2024年度器乐比赛排名规则"
drop_highest: 1
drop_lowest: 1
ranking_mode: "competition"
promotion_threshold: 5
promotion_score: 8.8
categories:
  - "少年组"
  - "青年组"
```

### 4. appeals.jsonl (申诉记录)

每行一个 JSON 对象:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| contestant_id | string | 是 | 选手ID |
| judge_id | string | 否 | 评委ID |
| original_score | float | 是 | 原始分数 |
| new_score | float | 是 | 申诉后分数 |
| reason | string | 否 | 申诉原因 |
| status | string | 否 | 状态: pending/approved/rejected |

示例:
```jsonl
{"contestant_id": "C007", "judge_id": "J2", "original_score": 8.4, "new_score": 9.0, "reason": "评委打分时将8.9误写为8.4", "status": "pending"}
{"contestant_id": "C004", "judge_id": "J5", "original_score": 8.5, "new_score": 9.1, "reason": "分数统计错误", "status": "pending"}
```

## 排名模式说明

### 竞赛排名 (Competition Ranking) - 默认

并列名次占用后续排名位置:
- 分数: 100, 95, 95, 90
- 排名: 1, 2, 2, 4

### 密集排名 (Dense Ranking)

并列名次不占用后续排名位置:
- 分数: 100, 95, 95, 90
- 排名: 1, 2, 2, 3

## 晋级状态标记

服务会自动标记以下特殊情况的选手:

| 状态 | 说明 |
|------|------|
| `promoted` | 正常晋级 |
| `tie_at_boundary` | 晋级线附近同分 |
| `exactly_boundary` | 刚好等于边界分 |
| `cross_line_after_appeal` | 申诉改分后跨线晋级 |
| `not_promoted` | 未晋级 |

## 完整工作流示例

```bash
# 1. 安装依赖并启动服务
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000 &

# 2. 导入所有数据
curl -X POST "http://localhost:8000/import/contestants" -F "file=@samples/contestants.csv"
curl -X POST "http://localhost:8000/import/judge-scores" -F "file=@samples/judge_scores.csv"
curl -X POST "http://localhost:8000/import/rank-rules" -F "file=@samples/rank_rules.yaml"
curl -X POST "http://localhost:8000/import/appeals" -F "file=@samples/appeals.jsonl"

# 3. 查看初始排名
curl "http://localhost:8000/ranking"

# 4. 处理申诉
curl "http://localhost:8000/appeals"
curl -X POST "http://localhost:8000/appeals/1/process?approve=true"
curl -X POST "http://localhost:8000/appeals/2/process?approve=false"

# 5. 查看更新后的排名
curl "http://localhost:8000/ranking"

# 6. 导出报告
curl -o final_ranking.csv "http://localhost:8000/report/csv"
curl -o review_report.md "http://localhost:8000/report/md"
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 主应用
│   ├── database.py          # 数据库配置
│   ├── models.py            # 数据模型
│   ├── ranking_service.py   # 排名计算逻辑
│   ├── import_service.py    # 数据导入服务
│   └── report_service.py    # 报告生成服务
├── samples/
│   ├── contestants.csv      # 示例选手数据
│   ├── judge_scores.csv     # 示例打分数据
│   ├── rank_rules.yaml      # 示例排名规则
│   └── appeals.jsonl        # 示例申诉记录
├── requirements.txt         # 依赖列表
└── README.md               # 本文档
```
