# 消防维保管理系统 - 本地运行指南

## 快速启动

### 方式一：一键启动
```bash
chmod +x run.sh
./run.sh
```

### 方式二：手动启动

1. 创建虚拟环境
```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 生成测试数据
```bash
python generate_test_data.py
```

4. 启动服务
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 访问地址

- API文档: http://localhost:8000/docs
- 备用文档: http://localhost:8000/redoc

## API接口说明

### 1. 上传批次文件并校验

```
POST /api/batch/upload
```

**参数:**
- `batch_no`: 批次号（可选，不传自动生成）
- `equipment_file`: 设备台账Excel（必填）
- `photo_file`: 照片清单Excel（可选）
- `contract_file`: 合同Excel（可选）

**返回:**
```json
{
  "batch_no": "BATCH20240101120000",
  "status": "completed",
  "normal_count": 0,
  "pending_confirm_count": 1,
  "failed_count": 5,
  "normal_items": [...],
  "pending_confirm_items": [...],
  "failed_items": [...]
}
```

**幂等性说明:**
同一批次号重复提交时，系统直接返回之前的处理结果，不会重复处理。

### 2. 查询设备追溯

```
GET /api/equipment/{equipment_code}/trace
```

从到期提醒的单条明细一路追溯到最终报告。

**返回:**
- 维保日期历史
- 所有合同列表
- 照片清单
- 校验历史
- 最终汇总报告

### 3. 查询批次状态

```
GET /api/batch/{batch_no}
```

### 4. 查询过期设备列表

```
GET /api/expired
```

## 使用curl测试示例

```bash
# 上传文件测试
curl -X POST "http://localhost:8000/api/batch/upload?batch_no=TEST001" \
  -F "equipment_file=@test_equipment.xlsx" \
  -F "photo_file=@test_photos.xlsx" \
  -F "contract_file=@test_contracts.xlsx"

# 查询设备追溯
curl "http://localhost:8000/api/equipment/MHQ003/trace"

# 查询过期设备
curl "http://localhost:8000/api/expired"
```

## 校验规则说明

| 规则 | 类型 | 处理建议 |
|------|------|----------|
| 维保已过期 | 失败 | 请立即安排维保并更新维保日期 |
| 同设备多合同 | 待确认 | 请确认合同归属关系 |
| 缺少巡检照片 | 失败 | 请补拍上传后再次提交 |

## 测试数据说明

运行 `python generate_test_data.py` 后生成3个测试文件：

1. **test_equipment.xlsx** - 6台设备，其中：
   - MHQ001: 维保已过期
   - MHQ004: 维保已过期
   - MHQ003: 关联2份合同

2. **test_photos.xlsx** - 4张照片，仅3台设备有照片

3. **test_contracts.xlsx** - 4份合同，其中MHQ003有2份合同

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置文件
│   ├── database.py        # 数据库连接
│   ├── models.py          # 数据模型
│   ├── schemas.py         # Pydantic Schema
│   ├── excel_parser.py    # Excel解析
│   ├── validation_engine.py  # 校验引擎
│   └── main.py          # API主入口
├── uploads/              # 上传文件目录
├── requirements.txt      # 依赖清单
├── generate_test_data.py  # 测试数据生成
├── run.sh               # 启动脚本
└── fire_maintenance.db   # SQLite数据库
```
