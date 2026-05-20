# 园区访客核验系统

基于 FastAPI + SQLite 的访客预约、临时车牌和黑名单核验后端工具。

## 核心功能

### 1. 数据导入
- **访客CSV导入**: 支持批量导入访客预约数据，自动校验格式（姓名、手机号、身份证号）
- **临时车牌JSON导入**: 导入临时通行车牌，含有效期校验
- **黑名单导入**: 支持CSV/JSON格式，按身份证/手机号/车牌号匹配

### 2. 访客核验
- **正常记录**: 有预约记录 + 非黑名单 + （如有车牌）车牌在有效期内
- **异常类型**:
  - `blacklist`: 黑名单人员（直接拒绝）
  - `invalid_plate`: 车牌无有效权限
  - `no_appointment`: 无预约记录
  - `early_arrival`: 提前到达
  - `late_arrival`: 超过预约离开时间

### 3. 错误记录处理
- 坏记录不直接丢弃，保存：
  - 原始文件和行号
  - 原始数据内容
  - 具体失败原因
  - 修改建议

### 4. 历史记录查询
支持多维度筛选：
- 按操作人（负责人）
- 按核验状态（pass/warning/reject）
- 按异常类型
- 按是否异常
- 按时间范围

### 5. 报告导出
导出与查询结果一致的CSV报告。

### 6. 本地持久化
使用SQLite数据库，重启服务后历史数据依然存在。

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务地址: http://localhost:8000
API文档: http://localhost:8000/docs

### 3. 运行完整测试流程
```bash
python test_flow.py
```

## API 端点

### 导入数据
- `POST /import/visitors` - 导入访客CSV
- `POST /import/plates` - 导入临时车牌JSON
- `POST /import/blacklist` - 导入黑名单

### 核验
- `POST /verify` - 访客核验

### 查询
- `GET /records` - 查询核验记录（支持筛选）
- `GET /errors` - 查询导入错误记录
- `GET /stats` - 统计数据

### 导出
- `GET /records/export` - 导出核验记录CSV

## 使用示例

### 访客核验（curl）
```bash
# 正常访客
curl -X POST "http://localhost:8000/verify?id_card=110101199001011234&plate_number=京A12345&handler=门岗王"

# 黑名单人员
curl -X POST "http://localhost:8000/verify?id_card=110101198001019999&handler=门岗王"
```

### 查询异常记录
```bash
curl "http://localhost:8000/records?is_anomaly=true"
```

### 按操作人筛选
```bash
curl "http://localhost:8000/records?handler=门岗王"
```

### 导出报告
```bash
curl "http://localhost:8000/records/export?is_anomaly=true" -o anomalies.csv
```

## 文件说明
- `main.py` - 主服务程序
- `database.py` - 数据库模型定义
- `requirements.txt` - Python依赖
- `test_flow.py` - 完整流程测试脚本
- `test_data/` - 测试数据目录
- `visitor_verification.db` - SQLite数据库文件（运行后生成）
