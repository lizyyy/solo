# 供水抢修领料管理API

解决夜间抢修领料导入混乱问题，支持CSV/JSON导入，自动校验分类。

## 功能特性

- 支持领料CSV文件上传导入
- 支持车辆JSON数据导入
- 自动校验并分类：正常/待确认/失败
- 失败记录保留原始字段和建议处理方式
- 同一批次重复提交不生效（幂等性）
- 5条验证规则覆盖：
  - 紧急领用规则
  - 归还差异规则
  - 库存负数规则
  - 车辆验证规则
  - 抢修单号规则

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问接口

- API文档: http://localhost:8000/docs
- 首页: http://localhost:8000/

## API接口

### 物料导入

```bash
curl -X POST "http://localhost:8000/api/import/materials?batch_id=BATCH-001" \
  -H "Content-Type: multipart/form-data" \
  -F "csv_file=@sample_materials.csv"
```

### 车辆导入

```bash
curl -X POST "http://localhost:8000/api/import/vehicles" \
  -H "Content-Type: multipart/form-data" \
  -F "json_file=@sample_vehicles.json"
```

### 查询库存

```bash
curl "http://localhost:8000/api/inventory"
```

### 查询车辆

```bash
curl "http://localhost:8000/api/vehicles"
```

### 查询批次列表

```bash
curl "http://localhost:8000/api/batches"
```

### 查询批次详情

```bash
curl "http://localhost:8000/api/batch/{batch_id}"
```

### 查询单条记录详情

```bash
curl "http://localhost:8000/api/record/{record_id}"
```

## 样例数据说明

### sample_materials.csv 包含8条记录：

1. **WX20240520001 - VAL-001 (DN100闸阀 5个)** - ✅ 正常通过
2. **WX20240520001 - PIP-001 (PE管 30米)** - ✅ 正常通过
3. **WX20240520002 - VAL-002 (DN50球阀 2个)** - ⚠️ 待确认（车辆状态是维修中）
4. **WX20240520002 - TOO-001 (管钳 1把)** - ⚠️ 待确认（车辆状态是维修中）
5. **WX20240520003 - VAL-001 (DN100闸阀 100个)** - ❌ 失败（库存只有50个）
6. **WX20240520001 - FIT-001 (弯头 5个)** - ⚠️ 待确认（归还数量差异大）
7. **WX20240520004 - VAL-999 (未知阀门 10个)** - ❌ 失败（车辆未登记）
8. **WX2024 - TOO-002 (活动扳手 2把)** - ⚠️ 待确认（抢修单号格式异常）

## 验证规则说明

| 规则 | 说明 | 处理结果 |
|------|------|----------|
| 抢修单号规则 | 单号不能为空，长度小于5需确认 | 失败/待确认 |
| 车辆验证规则 | 车辆必须已登记，状态异常需确认 | 失败/待确认 |
| 库存负数规则 | 非紧急领用不能超过库存 | 失败 |
| 紧急领用规则 | 紧急领用可超库存但需人工确认 | 成功/待确认 |
| 归还差异规则 | 归还数量异常需核实，不能≤0 | 待确认/失败 |

## 运行测试

使用样例数据测试：

```bash
# 启动服务后，访问 /docs 使用 Swagger UI 测试
# 上传 sample_materials.csv 文件进行导入测试
```

## 项目结构

```
.
├── main.py              # API主入口
├── models.py            # 数据库模型
├── schemas.py           # Pydantic数据结构
├── services.py          # 业务逻辑和规则引擎
├── database.py          # 数据库配置
├── requirements.txt     # 依赖列表
├── sample_materials.csv # 样例领料数据
├── sample_vehicles.json # 样例车辆数据
└── README.md            # 本文档
```
