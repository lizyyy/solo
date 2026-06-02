# 城市遥感建筑变化检测 - 评测系统

风控算法运营老唐的专用评测工具，解决"标注表能找到材料但引用缺失时报告还写得很肯定"的问题。

## 功能特性

- ✅ **重复评测**: 一键重跑，结果一致不用手工对第二遍
- ✅ **样本分层**: 自动按状态、置信度、变化类型分层统计
- ✅ **导出报告**: Excel/文本多格式导出，业务同事直接能用
- ✅ **标注引用**: 自动检查标注材料引用完整性
- ✅ **旧口径兼容**: 历史口径自动沿用，有迹可循
- ✅ **版本管理**: 模型版本变了，旧报告不被无声覆盖
- ✅ **冲突检测**: 标记冲突案例，人工复核不遗漏
- ✅ **边界记录**: 置信度接近阈值自动标记重点复核
- ✅ **重复检测**: 自动去重，避免重复统计

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行演示

一键生成样例数据并运行完整评测流程：

```bash
python cli.py demo
```

演示数据包含：
- 1条 **顺利记录** (REC001) - 高置信度通过，有完整标注
- 1条 **需人工确认** (REC002) - 中置信度，存在冲突案例
- 1条 **旧口径记录** (REC008) - 从标注表补来的旧口径
- 1条 **空值记录** (REC007) - 城市和网格ID缺失
- 1条 **重复记录** (REC006) - 与REC001重复
- 1条 **边界记录** (REC005) - 置信度0.58接近阈值

### 3. 查看命令帮助

```bash
python cli.py --help
python cli.py run --help
python cli.py model --help
python cli.py report --help
```

## 目录结构

```
data/
├── eval_logs/           # 评测日志（按模型版本分目录）
│   └── v2.0/
│       └── eval_logs.json
├── annotation_tables/   # 标注表材料
│   └── annotations.json
├── threshold_notes/     # 阈值备注
│   └── thresholds.txt
├── conflict_cases/      # 冲突案例
│   └── conflicts.json
└── reports/             # 生成的评测报告
    └── report_v2.0_YYYYMMDD_HHMMSS/
        ├── report_meta.json
        ├── records.json
        ├── stratified_summary.json
        ├── report_v2.0_YYYYMMDD_HHMMSS.xlsx
        ├── report_v2.0_YYYYMMDD_HHMMSS.txt
        └── 冲突清单.txt
```

## 使用指南

### 一、样本放置规范

#### 1. 评测日志 (eval_logs)

**放置位置**: `data/eval_logs/{模型版本}/`

**支持格式**: JSON, CSV, Excel

**字段说明**:

| 字段名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| record_id | 是 | 记录唯一标识 | REC001 |
| city | 是 | 城市 | 北京市 |
| district | 是 | 区域 | 朝阳区 |
| grid_id | 是 | 网格ID | G001 |
| change_type | 是 | 变化类型 | 新增建筑/拆除建筑/扩建/改建/无变化 |
| confidence | 是 | 置信度 | 高/中/低 |
| confidence_score | 否 | 置信度分数(0-1) | 0.92 |
| verify_status | 否 | 初始核验状态 | 通过/待人工确认/不通过 |
| material_sources | 否 | 材料来源列表 | ["评测日志", "标注表"] |
| eval_timestamp | 否 | 评测时间 | ISO格式时间戳 |

**示例 (JSON)**:
```json
[
  {
    "record_id": "REC001",
    "city": "北京市",
    "district": "朝阳区",
    "grid_id": "G001",
    "change_type": "新增建筑",
    "confidence": "高",
    "confidence_score": 0.92,
    "verify_status": "通过",
    "material_sources": ["评测日志", "标注表"]
  }
]
```

#### 2. 标注表材料 (annotation_tables)

**放置位置**: `data/annotation_tables/`

**字段说明**:

| 字段名 | 必需 | 说明 |
|--------|------|------|
| material_id | 否 | 材料ID |
| record_id | 是 | 对应记录ID |
| source_type | 否 | 来源类型 |
| content | 是 | 标注内容 |
| caliber_version | 否 | 口径版本 |
| is_active | 否 | 是否有效 |
| created_at | 否 | 创建时间 |

#### 3. 阈值备注 (threshold_notes)

**放置位置**: `data/threshold_notes/`

**格式**: 每行 `{城市}_{变化类型}={备注}`

示例:
```
北京市_新增建筑=严格阈值0.9
上海市_扩建=标准阈值0.85
```

#### 4. 冲突案例 (conflict_cases)

**放置位置**: `data/conflict_cases/`

**格式**: JSON

示例:
```json
[
  {
    "case_id": "CASE001",
    "record_ids": ["REC002"],
    "description": "与2024年Q2人工标注结果冲突",
    "severity": "high"
  }
]
```

### 二、模型版本切换

#### 注册新版本

```bash
python cli.py model register v2.1 "优化了郊区识别准确率" \
  --caliber-note "调整了新增建筑的判定阈值"
```

#### 查看所有版本

```bash
python cli.py model list
```

#### 切换激活版本

```bash
python cli.py model use v2.1
```

#### 查看当前版本

```bash
python cli.py model current
```

### 三、运行评测

#### 基本运行

```bash
python cli.py run v2.0
```

#### 沿用旧口径

```bash
python cli.py run v2.0 --old-caliber v1.0
```

#### 覆盖已有报告

⚠️ 谨慎使用！默认不覆盖，防止旧报告被无声覆盖。

```bash
python cli.py run v2.0 --overwrite
```

#### 指定日志文件

```bash
python cli.py run v2.0 --log-file batch_2024_q2.json
```

### 四、查看报告

#### 列出所有报告

```bash
python cli.py report list
```

#### 按模型版本筛选

```bash
python cli.py report list --model-version v2.0
```

#### 查看报告摘要

```bash
python cli.py report show report_v2.0_20240602_143000
```

#### 查看冲突清单

```bash
python cli.py report conflicts report_v2.0_20240602_143000
```

## 报告说明

### Excel报告结构

| Sheet名称 | 内容 |
|-----------|------|
| 报告概览 | 统计摘要、各类别计数 |
| 全部记录 | 所有记录的完整信息 |
| 通过记录 | 核验通过的记录 |
| 待人工确认记录 | 需要人工审核的记录 |
| 不通过记录 | 核验不通过的记录 |
| 旧口径沿用记录 | 沿用历史口径的记录 |
| 边界记录 | 置信度接近阈值的记录 |
| 数据缺失记录 | 关键字段缺失的记录 |
| 重复记录 | 检测到的重复记录 |
| 冲突清单 | 存在冲突的记录及处理建议 |
| 引用缺失清单 | 缺少标注引用的记录 |
| 重复记录清单 | 重复记录去重建议 |
| 边界记录清单 | 边界记录复核建议 |
| 处理建议 | 业务友好的操作指导 |

### 处理建议分类

系统自动生成以下类型的处理建议：

1. **【重要提醒】引用缺失** - 补充标注材料
2. **【重要提醒】冲突案例** - 人工复核判定
3. **【注意】重复记录** - 核对去重
4. **【注意】边界记录** - 重点复核或调阈值
5. **【待处理】人工确认** - 业务同事3日内审核
6. **【信息】旧口径** - 口径更新考虑重标注

## 常见问题

### Q: 报告为什么没有被覆盖？

A: 默认启用防覆盖保护，同一模型版本的报告不会被无声覆盖。如需覆盖，请加 `--overwrite` 参数，或使用新的模型版本号。

### Q: 怎么知道上次是怎么判的？

A: 每个报告都保存在独立的时间戳目录下，用 `python cli.py report list` 查看历史报告，用 `report show` 查看详情。

### Q: 标注表更新了怎么重新评测？

A: 更新 `data/annotation_tables/` 下的文件后，重新运行评测即可：
```bash
python cli.py run v2.0 --overwrite
```

### Q: 边界记录的判定阈值是多少？

A: 默认置信度分数在 0.55-0.65 之间会被标记为边界记录。可在 `evaluation_engine.py` 中调整。

### Q: 重复记录怎么判定的？

A: 基于 (城市, 区域, 网格ID, 变化类型) 四元组判断重复。

## 模块说明

| 文件 | 功能 |
|------|------|
| [models.py](file:///Users/lzy/pro/solo/workspaces/zy72191/building_change_detection/models.py) | 数据模型定义 |
| [log_loader.py](file:///Users/lzy/pro/solo/workspaces/zy72191/building_change_detection/log_loader.py) | 评测日志加载解析 |
| [annotation_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72191/building_change_detection/annotation_manager.py) | 标注材料与旧口径管理 |
| [evaluation_engine.py](file:///Users/lzy/pro/solo/workspaces/zy72191/building_change_detection/evaluation_engine.py) | 样本分层与评测引擎 |
| [report_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72191/building_change_detection/report_manager.py) | 报告与版本管理 |
| [report_exporter.py](file:///Users/lzy/pro/solo/workspaces/zy72191/building_change_detection/report_exporter.py) | 报告导出 |
| [pipeline.py](file:///Users/lzy/pro/solo/workspaces/zy72191/building_change_detection/pipeline.py) | 流程编排 |
| [cli.py](file:///Users/lzy/pro/solo/workspaces/zy72191/cli.py) | 命令行接口 |

## 命令速查

```bash
# 演示
python cli.py demo

# 运行评测
python cli.py run <模型版本> [--old-caliber <版本>] [--overwrite]

# 模型版本管理
python cli.py model list
python cli.py model register <版本> <描述>
python cli.py model use <版本>
python cli.py model current

# 报告管理
python cli.py report list [--model-version <版本>]
python cli.py report show <报告ID>
python cli.py report conflicts <报告ID>
```
