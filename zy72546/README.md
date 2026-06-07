# 机器人话术版本仓库

## 项目概述

专为模型评测团队和运营复核团队设计的人工改判表版本管理系统。**不做数据清洗，保留所有原始信息**，支持完整的版本追溯和边界规则处理。

## 核心设计原则

1. **原始信息完整保留**：原始行号、人工改动、处理状态、备注全部记录，绝不洗成一行干净数据
2. **版本可追溯**：每一次修改都有完整历史，能看到改前改后的差别
3. **边界规则明确**：不靠口头约定，所有规则写在代码里
4. **重复导入不翻倍**：智能去重，避免数据数量膨胀

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python app.py
```

访问 http://localhost:5000

## 三步标准工作流

### 步骤1：导入人工改判表
- 支持 Excel (.xlsx) 和 CSV 格式
- 自动识别列名（支持中英文表头）
- 保留 Excel 中的原始行号
- 自动计算内容哈希值，用于去重

**支持的列名映射：**
| 中文列名 | 英文列名 | 说明 |
|---------|---------|------|
| 样本编号 | sample_id | 样本唯一标识 |
| 模型版本 | model_version | 模型版本号 |
| 提示词版本 | prompt_version | 提示词版本号（可后续补充） |
| 原始回答 | original_answer | 模型原始输出 |
| 人工改判回答 | manual_answer | 人工修正后的回答 |
| 人工改动说明 | manual_changes | 人工改动的具体说明 |
| 备注 | remarks | 模型评测同事的备注信息 |

### 步骤2：模型评测同事补看提示词版本号
- 小孟可以在详情页补充或修改提示词版本号
- 每次修改自动生成版本历史
- 工作流状态推进到 `step2_prompt_updated`

### 步骤3：运营复核人复核后产品复盘页更新
- 运营复核人可以查看所有边界异常
- 支持通过、打回、回滚三种操作
- 复核完成后工作流推进到 `step3_reviewed`
- 支持导出完整数据用于产品复盘

## 边界规则（Boundary Rules）

### 规则1：模型版本换了但样本编号没变

**触发条件**：
- 同一样本编号（sample_id）
- 同一批次（batch_id）
- 同一原始行号（original_row_number）
- 但模型版本（model_version）与上次导入不同

**系统行为**：
1. 自动标记 `boundary_status = 'needs_review'`（待复核）
2. 设置 `processing_status = 'pending_review'`
3. 生成边界说明：`模型版本从 X 变为 Y，但样本编号 Z 未变，需要运营复核人复核`
4. **不会自动归为正常**，必须等待运营复核人人工判断

**复核选项**：
- **通过（approve）**：确认样本编号正确，模型版本升级正常，标记为正常
- **打回（reject）**：样本编号有误，退回给模型评测同事
- **回滚（rollback）**：撤销本次变更，恢复到上一版本

### 规则2：重复导入同一批表

**触发条件**：
- 同批次号 + 同样本编号 + 同原始行号
- 内容哈希值完全相同

**系统行为**：
1. 标记为重复数据，跳过不入库
2. 导入统计中 `duplicate_count` 计数
3. 不会导致仓库数量翻倍

### 规则3：部分字段修改的重新导入

**触发条件**：
- 同批次号 + 同样本编号 + 同原始行号
- 但内容哈希值不同（至少一个字段有改动）

**系统行为**：
1. 旧记录标记为历史版本（`is_latest = False`）
2. 创建新记录作为最新版本
3. 为每个变更字段生成版本历史记录
4. 保留原有工作流状态和复核信息
5. 自动触发边界规则检查

## 版本历史说明

每次修改都会在 `VersionHistory` 表中生成一条记录，包含：
- `version_number`：版本号，递增
- `field_name`：修改的字段名
- `old_value`：修改前的值
- `new_value`：修改后的值
- `changed_by`：修改人
- `change_reason`：修改原因
- `full_snapshot`：修改前完整记录快照
- `changed_at`：修改时间

## 数据库表结构

### ManualJudgment（人工改判主表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | Integer | 主键 |
| batch_id | String(100) | 批次号 |
| original_row_number | Integer | Excel 原始行号 |
| sample_id | String(100) | 样本编号 |
| model_version | String(100) | 模型版本 |
| prompt_version | String(100) | 提示词版本 |
| original_answer | Text | 原始回答 |
| manual_answer | Text | 人工改判回答 |
| manual_changes | Text | 人工改动说明 |
| remarks | Text | 备注 |
| processing_status | String(50) | 处理状态 |
| reviewer | String(100) | 复核人 |
| review_time | DateTime | 复核时间 |
| boundary_status | String(50) | 边界状态（normal/needs_review） |
| boundary_note | Text | 边界说明 |
| content_hash | String(64) | 内容哈希值（SHA256） |
| workflow_step | String(50) | 工作流步骤 |
| is_latest | Boolean | 是否为最新版本 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### VersionHistory（版本历史表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | Integer | 主键 |
| manual_judgment_id | Integer | 关联主表ID |
| version_number | Integer | 版本号 |
| field_name | String(100) | 修改字段 |
| old_value | Text | 旧值 |
| new_value | Text | 新值 |
| changed_by | String(100) | 修改人 |
| change_reason | Text | 修改原因 |
| full_snapshot | Text | 完整快照（JSON） |
| changed_at | DateTime | 修改时间 |

### ImportBatch（导入批次表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | Integer | 主键 |
| batch_id | String(100) | 批次号（唯一） |
| file_name | String(255) | 文件名 |
| imported_by | String(100) | 导入人 |
| imported_at | DateTime | 导入时间 |
| record_count | Integer | 总记录数 |
| new_count | Integer | 新增数 |
| updated_count | Integer | 更新数 |
| duplicate_count | Integer | 重复数 |

## API 接口

| 接口 | 方法 | 说明 |
|-----|------|------|
| `/api/import` | POST | 导入人工改判表 |
| `/api/records` | GET | 获取记录列表（支持分页筛选） |
| `/api/record/<id>` | GET | 获取单条记录及版本历史 |
| `/api/record/<id>/update_prompt_version` | POST | 更新提示词版本号 |
| `/api/record/<id>/update_remark` | POST | 修改备注 |
| `/api/record/<id>/review` | POST | 运营复核 |
| `/api/batches` | GET | 获取导入批次列表 |
| `/api/statistics` | GET | 获取统计数据 |
| `/api/export/<batch_id>` | GET | 导出批次数据 |

## 常见问题

### Q: 小孟只改了一条备注，能看到改前改后吗？
A: 可以。每次修改备注都会生成版本历史记录，在详情页的"版本历史"中可以看到前后对比。

### Q: 重复导入同一张表会怎样？
A: 系统会计算每条记录的内容哈希，完全相同的会被标记为重复跳过，不会导致数据翻倍。

### Q: 模型版本升级了但样本号没变，系统会怎么处理？
A: 系统会自动标记为"待复核"状态，不会自动判为正常，必须等待运营复核人确认。

### Q: 备注里的重要信息会被洗掉吗？
A: 绝对不会。所有原始信息包括备注都会完整保留，甚至每次修改备注都会保留历史版本。

## 文件结构

```
.
├── app.py              # 主应用程序
├── requirements.txt    # 依赖包
├── templates/
│   └── index.html      # 前端页面
├── uploads/            # 上传文件存储
└── robot_script.db     # SQLite 数据库（自动创建）
```
