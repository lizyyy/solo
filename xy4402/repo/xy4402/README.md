# 餐厨废油回收 REST API 服务

一个专为餐厨废油回收小承包商设计的本地 REST API 服务，用于管理司机日常上传的门店合同表、称重票、GPS 轨迹和回收联单，支持风险识别和稽核导出。

## 功能特性

### 📦 核心功能
- **批次管理**: 按日期管理司机的回收任务
- **文件上传**: 支持称重票 CSV、回收联单 JSON、GPS 轨迹 JSON
- **门店合同管理**: 管理合同门店信息，支持状态跟踪
- **车辆管理**: 管理回收车辆和司机信息

### 🔍 风险识别引擎
系统自动检测以下风险：
| 风险类型 | 描述 | 严重程度 |
|---------|------|---------|
| 重复称重 | 同一门店在同一小时内有相同重量的称重记录 | 高 |
| 合同门店不匹配 | 称重或联单中的门店不在合同门店列表中 | 中 |
| GPS 轨迹未到店 | 车辆 GPS 轨迹未到达回收门店附近 | 高 |
| 超时回收 | 回收时间超出标准工作时间（6:00-18:00） | 中 |
| 疑似偷倒 | 在非合同门店区域停留超过 5 分钟 | 严重 |
| 重量异常 | 称重重量与平均值偏差超过 2.5 倍标准差 | 中 |

### 📤 导出功能
- **稽核 Markdown**: 导出当天完整稽核报告，包含概览、风险统计、批次详情
- **审计 JSON**: 导出当天完整审计数据，包含所有批次、风险、称重记录、联单

### 📋 人工复核
- 支持添加复核意见
- 复核决定：通过/驳回/待处理/升级处理
- 风险解决跟踪

## 技术栈

- **运行时**: Node.js 16+
- **框架**: Express.js
- **数据库**: SQLite (Sequelize ORM)
- **文件处理**: Multer (文件上传), csv-parser (CSV 解析)
- **日期处理**: Moment.js
- **数据验证**: 内置验证

## 项目结构

```
xy4402/
├── src/
│   ├── app.js                    # 应用入口
│   ├── config/
│   │   └── database.js           # 数据库配置
│   ├── models/
│   │   ├── index.js              # 模型导出
│   │   ├── store.js              # 门店模型
│   │   ├── vehicle.js            # 车辆模型
│   │   ├── batch.js              # 批次模型
│   │   ├── waybill.js            # 联单模型
│   │   ├── weighingRecord.js     # 称重记录模型
│   │   ├── gpsTrack.js           # GPS 轨迹模型
│   │   ├── review.js             # 复核意见模型
│   │   └── riskRecord.js         # 风险记录模型
│   ├── routes/
│   │   ├── batches.js            # 批次路由
│   │   ├── stores.js             # 门店路由
│   │   └── vehicles.js           # 车辆路由
│   ├── services/
│   │   ├── batchService.js       # 批次处理服务
│   │   ├── riskEngine.js         # 风险识别引擎
│   │   └── exportService.js      # 导出服务
│   └── utils/
│       ├── uploadConfig.js       # 上传配置
│       ├── fileParser.js         # 文件解析器
│       └── geoUtils.js           # 地理计算工具
├── scripts/
│   └── seed.js                   # 数据初始化脚本
├── data/
│   └── examples/                 # 示例数据文件
│       ├── weighing_normal.csv
│       ├── weighing_with_duplicate.csv
│       ├── weighing_with_invalid_store.csv
│       ├── waybill_normal.json
│       ├── waybill_with_overdue.json
│       ├── gps_track_normal.json
│       └── gps_track_not_at_store.json
├── docs/
│   └── curl_examples.md          # API 调用示例
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（可选）

```bash
npm run seed
```

这会创建示例数据：
- 5 个门店（川味轩火锅店、湘菜馆、粤式茶餐厅等）
- 4 辆车（京A12345、京B67890 等）
- 1 个示例批次

### 3. 启动服务

```bash
npm start
```

或者使用开发模式（自动重启）：

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 4. 验证服务

```bash
curl http://localhost:3000/health
```

## API 文档

### 基础端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/` | 服务信息 |
| GET | `/health` | 健康检查 |

### 门店管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/stores` | 获取门店列表 |
| GET | `/api/stores?search={keyword}` | 搜索门店 |
| GET | `/api/stores?status={status}` | 按状态筛选 |
| GET | `/api/stores/:id` | 获取门店详情 |
| POST | `/api/stores` | 创建门店 |
| PUT | `/api/stores/:id` | 更新门店 |
| DELETE | `/api/stores/:id` | 删除门店 |

**门店状态**: `active` (生效), `inactive` (失效), `suspended` (暂停)

### 车辆管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/vehicles` | 获取车辆列表 |
| GET | `/api/vehicles?search={keyword}` | 搜索车辆 |
| GET | `/api/vehicles?status={status}` | 按状态筛选 |
| GET | `/api/vehicles/:id` | 获取车辆详情 |
| POST | `/api/vehicles` | 创建车辆 |
| PUT | `/api/vehicles/:id` | 更新车辆 |
| DELETE | `/api/vehicles/:id` | 删除车辆 |

**车辆状态**: `active` (可用), `inactive` (停用), `maintenance` (维护中)

### 批次管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/batches` | 获取批次列表 |
| GET | `/api/batches?date={YYYY-MM-DD}` | 按日期筛选 |
| GET | `/api/batches?hasRisks=true` | 筛选有风险的批次 |
| GET | `/api/batches/:id` | 获取批次详情 |
| POST | `/api/batches` | 创建批次 |
| POST | `/api/batches/:id/upload` | 上传文件 |
| POST | `/api/batches/:id/review` | 添加复核意见 |
| POST | `/api/batches/risks/:id/resolve` | 解决风险 |

### 导出功能

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/batches/export/markdown` | 导出当天稽核 Markdown |
| GET | `/api/batches/export/markdown?date=2026-05-04` | 导出指定日期稽核 Markdown |
| GET | `/api/batches/export/json` | 导出当天审计 JSON |
| GET | `/api/batches/export/json?date=2026-05-04` | 导出指定日期审计 JSON |

## 工作流程

### 标准工作流程

```
1. 创建批次 (POST /api/batches)
       ↓
2. 上传文件 (POST /api/batches/:id/upload)
   - 称重票 CSV (weighingCSV)
   - 回收联单 JSON (waybillJSON)
   - GPS 轨迹 JSON (gpsTrack)
       ↓
3. 系统自动风险检测
   - 解析文件数据
   - 运行风险识别引擎
   - 生成风险记录
       ↓
4. 查看风险 (GET /api/batches/:id)
       ↓
5. 人工复核 (POST /api/batches/:id/review)
   - approve: 通过
   - reject: 驳回
   - pending: 待处理
   - escalate: 升级处理
       ↓
6. 导出稽核报告
   - Markdown: /api/batches/export/markdown
   - JSON: /api/batches/export/json
```

## 文件格式说明

### 称重票 CSV 格式

```csv
称重票编号,门店名称,重量(千克),称重时间,操作员
W001,川味轩火锅店,235.5,2026-05-04 09:30:00,张三
W002,湘菜馆,180.0,2026-05-04 10:15:00,张三
```

**支持的字段名**（中英文均可）：
- 称重票编号 / weighing_number / number
- 门店名称 / store_name / store
- 重量(千克) / 重量 / weight
- 称重时间 / weighing_time / time
- 操作员 / operator

### 回收联单 JSON 格式

```json
[
  {
    "联单编号": "WB20260504001",
    "门店名称": "川味轩火锅店",
    "门店编号": "ST001",
    "回收时间": "2026-05-04 09:30:00",
    "重量(千克)": 235.5,
    "油类类型": "餐厨废油",
    "门店签字": "张经理",
    "司机签字": "张三"
  }
]
```

**支持的字段名**（中英文均可）：
- 联单编号 / waybill_number / waybillNumber / number
- 门店名称 / store_name / storeName / store
- 门店编号 / store_code / storeCode
- 回收时间 / collection_time / collectionTime / time
- 重量(千克) / 重量 / weight
- 油类类型 / oil_type / oilType
- 门店签字 / store_signature / storeSignature
- 司机签字 / driver_signature / driverSignature

### GPS 轨迹 JSON 格式

```json
[
  {
    "时间": "2026-05-04 09:00:00",
    "纬度": 39.9000,
    "经度": 116.4000,
    "速度": 45.5
  }
]
```

**支持的字段名**（中英文均可）：
- 时间 / time / timestamp / datetime
- 纬度 / lat / latitude
- 经度 / lon / longitude / lng
- 速度 / speed
- 海拔 / altitude / elevation

也支持 GeoJSON 格式：
```json
[
  {
    "geometry": {
      "coordinates": [116.4000, 39.9000]
    },
    "properties": {
      "time": "2026-05-04 09:00:00",
      "speed": 45.5
    }
  }
]
```

## 风险检测规则

### 1. 重复称重检测

**规则**: 同一门店在同一小时内有相同重量的称重记录

**检测逻辑**:
- 按门店名称 + 重量 + 小时级别时间 进行分组
- 如果分组内有多个记录，则标记为重复

### 2. 合同门店不匹配检测

**规则**: 称重或联单中的门店不在合同门店列表中

**检测逻辑**:
- 对比记录中的门店名称/编号与系统中状态为 `active` 的门店
- 支持模糊匹配（门店名称包含搜索）

### 3. GPS 轨迹未到店检测

**规则**: 车辆 GPS 轨迹中没有任何轨迹点距离回收门店 500 米以内

**检测逻辑**:
- 对于每个回收门店，检查所有 GPS 轨迹点
- 使用 Haversine 公式计算两点距离
- 阈值：500 米（可配置）

### 4. 超时回收检测

**规则**: 回收时间不在标准工作时间内（6:00 - 18:00）

**检测逻辑**:
- 检查联单中的回收时间
- 早于 6:00 或晚于 18:00 标记为超时

### 5. 疑似偷倒检测

**规则**: 在非合同门店区域停留超过 5 分钟

**检测逻辑**:
- 分析 GPS 轨迹中的停留点（连续多个点在 100 米范围内）
- 计算停留时长
- 检查停留点是否在任何合同门店 500 米范围内
- 如果不在且停留超过 5 分钟，标记为疑似偷倒

### 6. 重量异常检测

**规则**: 称重重量与批次平均值偏差超过 2.5 倍标准差

**检测逻辑**:
- 计算批次中所有称重记录的平均值和标准差
- 计算每个记录的 Z 分数
- Z 分数 > 2.5 标记为异常

## 使用示例

### 完整示例脚本

```bash
# 1. 获取车辆ID
VEHICLE_ID=$(curl -s http://localhost:3000/api/vehicles | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['items'][0]['id'])")

# 2. 创建批次
BATCH_ID=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d "{\"vehicleId\": \"$VEHICLE_ID\", \"date\": \"2026-05-04\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 3. 上传文件
curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/upload" \
  -F "weighingCSV=@data/examples/weighing_normal.csv" \
  -F "waybillJSON=@data/examples/waybill_normal.json" \
  -F "gpsTrack=@data/examples/gps_track_normal.json"

# 4. 查看风险
curl "http://localhost:3000/api/batches/$BATCH_ID"

# 5. 复核
curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"reviewerName": "张主管", "comment": "数据核实无误", "decision": "approve"}'

# 6. 导出报告
curl -O -J "http://localhost:3000/api/batches/export/markdown?date=2026-05-04"
curl -O -J "http://localhost:3000/api/batches/export/json?date=2026-05-04"
```

### 更多示例

详细的 curl 示例请参考 [docs/curl_examples.md](docs/curl_examples.md)。

## 配置说明

### 环境变量

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| PORT | 3000 | 服务端口 |

### 风险检测配置

以下配置可在代码中调整：

| 配置项 | 默认值 | 位置 |
|--------|--------|------|
| 标准工作时间开始 | 6:00 | riskEngine.js:205 |
| 标准工作时间结束 | 18:00 | riskEngine.js:206 |
| GPS 到店阈值 | 500 米 | riskEngine.js:168 |
| 疑似偷倒停留阈值 | 5 分钟 | riskEngine.js:374 |
| 重量异常 Z 分数阈值 | 2.5 | riskEngine.js:286 |

## 数据模型

### 门店 (Store)

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| name | String | 门店名称 |
| code | String | 门店编号（唯一） |
| address | String | 地址 |
| latitude | Float | 纬度 |
| longitude | Float | 经度 |
| contact | String | 联系人 |
| phone | String | 联系电话 |
| contractStartDate | Date | 合同开始日期 |
| contractEndDate | Date | 合同结束日期 |
| status | Enum | 状态 |

### 车辆 (Vehicle)

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| plateNumber | String | 车牌号（唯一） |
| type | String | 车辆类型 |
| capacity | Float | 载重量（吨） |
| driverName | String | 司机姓名 |
| driverPhone | String | 司机电话 |
| status | Enum | 状态 |

### 批次 (Batch)

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| batchNumber | String | 批次号（唯一） |
| date | DateOnly | 回收日期 |
| vehicleId | UUID | 关联车辆 |
| status | Enum | 状态 |
| riskLevel | Enum | 风险等级 |
| totalWeight | Float | 总重量（千克） |
| storeCount | Integer | 门店数量 |
| waybillCount | Integer | 联单数量 |
| hasRisks | Boolean | 是否有风险 |

### 风险记录 (RiskRecord)

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| batchId | UUID | 关联批次 |
| riskType | Enum | 风险类型 |
| severity | Enum | 严重程度 |
| description | Text | 描述 |
| details | Text | 详细信息（JSON） |
| detectedAt | Date | 检测时间 |
| isResolved | Boolean | 是否已解决 |
| resolvedAt | Date | 解决时间 |
| resolvedBy | String | 解决人 |
| resolutionNote | Text | 解决说明 |

## 开发说明

### 添加新的风险检测规则

1. 在 `src/services/riskEngine.js` 中添加新的检测方法
2. 在 `RISK_TYPES` 常量中添加新的风险类型
3. 在 `RISK_TYPE_NAMES` 中添加中文名称
4. 在 `analyze()` 方法中调用新的检测方法

### 扩展文件格式支持

1. 在 `src/utils/fileParser.js` 中添加新的解析方法
2. 更新 `src/utils/uploadConfig.js` 中的文件类型过滤器
3. 更新 `src/routes/batches.js` 中的上传字段配置

## 许可证

MIT License

## 常见问题

### Q: 数据库文件存在哪里？
A: 默认在 `./data/database.sqlite`

### Q: 如何重置数据库？
A: 运行 `npm run seed` 会重置数据库并重新创建示例数据

### Q: 支持哪些日期格式？
A: 支持以下格式：
- `YYYY-MM-DD HH:mm:ss`
- `YYYY-MM-DD HH:mm`
- `YYYY/MM/DD HH:mm:ss`
- `YYYY-MM-DDTHH:mm:ss`
- `YYYY-MM-DD`

### Q: 如何测试风险检测？
A: 使用 `data/examples/` 目录下的示例文件：
- `weighing_with_duplicate.csv` - 测试重复称重检测
- `weighing_with_invalid_store.csv` - 测试门店不匹配检测
- `waybill_with_overdue.json` - 测试超时回收检测
- `gps_track_not_at_store.json` - 测试 GPS 未到店检测
