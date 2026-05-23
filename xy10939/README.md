# 回收衣物分拣 API

公益衣物回收分拣管理系统，支持批次追踪、分类管理、消毒记录、转赠管理、异常处理、报告导出等功能。

## 技术栈

- Python 3.8+
- FastAPI
- SQLAlchemy
- SQLite (本地持久化)
- Uvicorn

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python init_sample_data.py
```

此脚本将创建：
- 6个衣物分类（上衣、裤子、连衣裙、外套、内衣、配饰）
- 3个转赠机构（希望小学、阳光敬老院、山区扶贫站）
- 5个淘汰原因
- 2个捐赠批次
- 8件衣物记录
- 包含消毒记录、转赠记录、淘汰记录、异常处理
- 1份分拣报告

### 3. 启动服务

```bash
python main.py
```

或使用 uvicorn 直接启动：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API 文档

服务启动后，访问以下地址查看交互式 API 文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口概览

### 批次管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/batches/ | 创建捐赠批次 |
| GET | /api/batches/ | 查询批次列表 |
| GET | /api/batches/{batch_id} | 查询批次详情（含统计） |
| GET | /api/batches/no/{batch_no} | 按批次号查询 |
| PUT | /api/batches/{batch_id}/status | 更新批次状态 |

### 衣物管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/clothing/ | 创建衣物记录 |
| GET | /api/clothing/ | 查询衣物列表 |
| GET | /api/clothing/{item_id} | 查询衣物详情（含关联记录） |
| PUT | /api/clothing/{item_id} | 更新衣物信息（人工修正） |
| PUT | /api/clothing/{item_id}/status | 推进衣物状态 |

### 消毒管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/sterilization/ | 创建消毒记录 |

### 转赠管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/donation/ | 创建转赠记录 |

### 淘汰管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/rejection/ | 创建淘汰记录 |

### 异常处理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/exceptions/ | 创建异常记录 |
| GET | /api/exceptions/ | 查询异常列表 |
| PUT | /api/exceptions/{exception_id}/resolve | 解决异常 |

### 报告管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/reports/ | 生成分拣报告 |
| GET | /api/reports/ | 查询报告列表 |

### 数据导出

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/export/{batch_id} | 导出批次完整数据 |

### 基础数据

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/categories/ | 获取衣物分类 |
| POST | /api/categories/ | 创建衣物分类 |
| GET | /api/organizations/ | 获取转赠机构 |
| POST | /api/organizations/ | 创建转赠机构 |
| GET | /api/rejection-reasons/ | 获取淘汰原因 |
| POST | /api/rejection-reasons/ | 创建淘汰原因 |

### 状态枚举

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/status/batch-statuses | 获取批次状态枚举 |
| GET | /api/status/clothing-statuses | 获取衣物状态枚举 |

## 数据模型关系

### 核心模型

1. **DonationBatch (捐赠批次)** - 主记录
   - 包含捐赠人信息、接收时间、批次状态
   - 关联多件衣物

2. **ClothingItem (衣物)** - 明细记录
   - 包含名称、品牌、分类、状态等
   - 关联消毒记录、转赠记录、淘汰记录
   - 完整的状态变更历史

3. **StatusHistory (状态历史)** - 追溯记录
   - 记录每次状态变更
   - 包含操作人、变更原因、时间

4. **SterilizationRecord (消毒记录)** - 处理记录
   - 消毒方法、温度、时长、结果
   - 关联具体衣物

5. **DonationRecord (转赠记录)** - 出库记录
   - 转赠机构、接收人、时间
   - 关联具体衣物

6. **RejectionRecord (淘汰记录)** - 异常处理
   - 淘汰原因、操作人、备注
   - 关联具体衣物

7. **ProcessingException (处理异常)** - 异常追溯
   - 保存原始输入、错误信息、处理结论
   - 关联批次和衣物
   - 支持标记已解决

8. **SortingReport (分拣报告)** - 汇总报告
   - 批次统计信息：总数、已分拣、已消毒、已转赠、已淘汰、待处理
   - 支持导出

## 状态流转

### 批次状态

- CREATED: 已创建
- SORTING: 分拣中
- SORTED: 已分拣
- STERILIZING: 消毒中
- STERILIZED: 已消毒
- DONATING: 转赠中
- COMPLETED: 已完成
- EXCEPTION: 异常

### 衣物状态

- PENDING: 待分拣
- SORTED: 已分类
- STERILIZING: 消毒中
- STERILIZED: 已消毒
- READY: 待转赠
- DONATED: 已转赠
- REJECTED: 已淘汰

## 数据追溯特性

1. **主记录与明细记录关联**：每个批次下的所有衣物都可通过 batch_id 关联查询
2. **完整状态历史**：每件衣物的每次状态变更都记录在 status_history 表中，包含操作人和原因
3. **异常处理可追溯**：异常记录保存原始输入和处理结论，可关联到具体批次和衣物
4. **报告统计**：分拣报告汇总批次的各项统计数据，可追溯到具体衣物
5. **导出功能**：支持导出批次的完整数据，包含所有关联记录

## 使用示例

### 创建捐赠批次

```bash
curl -X POST "http://localhost:8000/api/batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "donor_name": "王五",
    "donor_phone": "13900139003",
    "donor_address": "杭州市西湖区",
    "total_count": 3,
    "remark": "家庭捐赠"
  }'
```

### 推进衣物状态

```bash
curl -X PUT "http://localhost:8000/api/clothing/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "已消毒",
    "operator": "张管理员",
    "reason": "高温消毒合格"
  }'
```

### 导出批次数据

```bash
curl -X GET "http://localhost:8000/api/export/1"
```

## 数据库文件

SQLite 数据库文件位于项目根目录：`clothing_recycle.db`

如需重置数据库，直接删除该文件，重新运行服务会自动创建新的数据库结构。
