# 农机亩数地块去重结算确认API

用于农机合作社结算时合并GPS面积和农户确认单，处理重复作业地块，计算最终结算金额。

## 技术栈

- Python 3.8+
- FastAPI
- SQLAlchemy
- SQLite
- pytest

## 项目结构

```
.
├── main.py              # API主入口
├── models.py            # 数据模型
├── schemas.py           # Pydantic数据结构
├── services.py          # 业务逻辑服务
├── database.py          # 数据库配置
├── seed_data.py         # 测试数据生成脚本
├── test_settlement.py   # pytest测试用例
├── requirements.txt     # 依赖包
└── README.md           # 项目说明
```

## 核心功能

### 1. 地块去重
- 自动检测同一地块同一作业项目的重复GPS记录
- 相似度阈值：95%以上视为重复
- 只保留一条记录，标记重复状态

### 2. 面积差异处理
- 自动比较GPS面积与农户确认面积
- 差异率 ≤ 10%：使用农户确认面积
- 差异率 > 10%：标记为冲突，需人工审核

### 3. 结算管理
- 支持按批次创建结算单
- 自动计算最终面积和金额
- 状态流转：草稿 → 处理中 → 冲突 → 已确认 → 已结算 / 已取消

### 4. 异常处理
- 完整记录异常类型、原始输入、处理人、处理结论
- 支持异常记录独立处理

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成测试数据

```bash
python seed_data.py
```

会自动生成：
- 3个农户（张三、李四、王五）
- 每个农户3个地块，共9个地块
- 3个作业项目（耕地、播种、收割）
- GPS面积记录（含重复地块用于测试去重）
- 农户确认单（含差异数据用于测试冲突检测）

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

或者直接运行：

```bash
python main.py
```

服务启动后访问：
- API文档：http://localhost:8000/docs
- Redoc文档：http://localhost:8000/redoc

### 4. 运行测试

```bash
pytest test_settlement.py -v
```

## API接口示例（curl）

### 健康检查

```bash
curl http://localhost:8000/health
```

### 农户管理

```bash
# 创建农户
curl -X POST http://localhost:8000/farmers/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试农户",
    "phone": "13800000000",
    "id_card": "110101199001010000",
    "village": "测试村"
  }'

# 查询农户列表
curl http://localhost:8000/farmers/
```

### 地块管理

```bash
# 创建地块
curl -X POST http://localhost:8000/plots/ \
  -H "Content-Type: application/json" \
  -d '{
    "farmer_id": 1,
    "plot_code": "P001",
    "plot_name": "第一块地",
    "location": "东区",
    "standard_area": 10.5,
    "land_type": "水田"
  }'
```

### 作业项目管理

```bash
# 创建作业项目
curl -X POST http://localhost:8000/projects/ \
  -H "Content-Type: application/json" \
  -d '{
    "project_code": "PLOW001",
    "project_name": "耕地作业",
    "unit_price": 80.0,
    "unit": "mu"
  }'
```

### GPS记录

```bash
# 上传GPS记录
curl -X POST http://localhost:8000/gps-records/ \
  -H "Content-Type: application/json" \
  -d '{
    "plot_id": 1,
    "project_id": 1,
    "gps_area": 10.2,
    "device_id": "GPS001",
    "operator": "操作员A",
    "batch_no": "BATCH20250101"
  }'
```

### 农户确认单

```bash
# 创建农户确认单
curl -X POST http://localhost:8000/confirmations/ \
  -H "Content-Type: application/json" \
  -d '{
    "plot_id": 1,
    "farmer_id": 1,
    "project_id": 1,
    "confirmed_area": 10.8,
    "confirmed_by": "确认员A",
    "batch_no": "BATCH20250101"
  }'
```

### 结算管理（主流程）

```bash
# 1. 创建结算单（自动去重、检测冲突）
curl -X POST http://localhost:8000/settlements/ \
  -H "Content-Type: application/json" \
  -d '{
    "farmer_id": 1,
    "gps_batch_no": "BATCH20250101",
    "confirmation_batch_no": "BATCH20250101",
    "notes": "2025年第一季结算"
  }'

# 2. 查询结算单详情
curl http://localhost:8000/settlements/1

# 3. 查询结算单列表（可按状态过滤）
curl "http://localhost:8000/settlements/?status=conflict"

# 4. 推进结算状态
curl -X PUT http://localhost:8000/settlements/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "processing",
    "processed_by": "审核员",
    "notes": "开始审核"
  }'

# 5. 人工修正（冲突流程）
curl -X POST http://localhost:8000/settlements/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "settlement_id": 1,
    "processed_by": "审核主管",
    "corrections": [
      {
        "settlement_item_id": 1,
        "final_area": 10.5,
        "notes": "经协商确认面积"
      }
    ],
    "notes": "人工审核通过"
  }'

# 6. 撤销/关闭结算单
curl -X PUT "http://localhost:8000/settlements/1/cancel?processed_by=管理员&reason=农户申请撤销"

# 7. 导出结算单
curl http://localhost:8000/settlements/1/export
```

### 异常处理

```bash
# 处理异常记录
curl -X POST http://localhost:8000/exceptions/handle \
  -H "Content-Type: application/json" \
  -d '{
    "exception_record_id": 1,
    "handled_by": "处理人",
    "handling_result": "已协调解决",
    "handling_notes": "双方确认以10.5亩结算"
  }'
```

## 结算状态说明

| 状态 | 说明 |
|------|------|
| draft | 草稿 |
| processing | 处理中 |
| conflict | 冲突（需人工审核） |
| confirmed | 已确认 |
| settled | 已结算 |
| cancelled | 已取消 |

## 异常类型

| 类型 | 说明 |
|------|------|
| AREA_CONFLICT | 面积差异超过阈值 |
| NO_GPS_DATA | 无GPS数据 |
| NO_CONFIRMATION | 无农户确认单 |
| DUPLICATE_PLOT | 重复作业地块 |

## 核心算法

### 地块去重算法

```python
def detect_duplicate_plots(gps_records, threshold=0.95):
    for i in range(n):
        for j in range(i + 1, n):
            if gps1.plot_id == gps2.plot_id and gps1.project_id == gps2.project_id:
                min_area = min(gps1.gps_area, gps2.gps_area)
                max_area = max(gps1.gps_area, gps2.gps_area)
                if min_area / max_area >= threshold:
                    标记为重复
```

### 最终面积确定规则

```python
if 差异率 <= 10%:
    最终面积 = 农户确认面积
else:
    标记为冲突，需人工审核
```

## 注意事项

1. 数据库默认使用SQLite，文件名为 `farm_settlement.db`
2. 测试数据库为 `test.db`，运行测试时自动创建和清理
3. 面积单位统一为亩（mu）
4. 金额单位统一为元

## 扩展建议

- 支持Excel批量导入GPS记录和确认单
- 增加结算单PDF导出功能
- 增加操作日志审计
- 支持多条件组合查询和统计报表
- 增加用户权限管理
