# 蓝牙巡检工具 (BLE Inspection Tool)

一个本地可运行的全栈 Web 工具，用于导入和复盘蓝牙巡检数据。适用于门店的电子价签、小票打印机、Beacon、扫码枪和员工耳机等蓝牙设备的管理和监控。

## 功能特性

### 数据导入
- 支持导入以下类型的文件：
  - `ble-scans.jsonl` - BLE 扫描记录
  - `devices.csv` - 设备台账
  - `pairing-events.csv` - 配对事件记录
  - `zones.json` - 区域定义
- 批量导入和分类型导入
- 自动关联扫描记录与设备台账

### 风险标签分析
系统会自动根据以下规则检测设备风险：

| 风险类型 | 说明 | 触发条件 |
|---------|------|---------|
| RSSI 信号抖动 | 信号强度波动过大 | 30分钟内波动超过 20dBm |
| 弱信号 | 平均信号强度过低 | 平均 RSSI < -75 dBm |
| 长时间失联 | 设备长时间未被扫描到 | 超过 120 分钟未扫描 |
| 低电量 | 设备电池电量不足 | 电量 < 20% (警告), < 10% (严重) |
| 配对失败过多 | 60分钟内配对失败次数过多 | 超过 3 次失败 |
| 随机地址漂移 | 检测到相似 MAC 地址 | 相同 OUI 的多个地址 |
| 重复设备 | 相同名称或序列号的设备 | 名称或序列号重复 |
| 区域越界 | 设备类型不符合区域规则 | 在禁止区域出现 |

### 页面功能

1. **设备看板**
   - 统计概览（设备总数、扫描次数、异常数量）
   - 设备类型分布
   - 最新异常列表
   - 扫描趋势图

2. **设备管理**
   - 设备列表（搜索、筛选、分页）
   - 设备详情页
   - 风险标签显示
   - 批量操作

3. **设备详情页**
   - 设备基本信息
   - RSSI 信号趋势图
   - 配对统计
   - 时间线（扫描、配对、异常）
   - 相关异常列表

4. **区域视图**
   - 区域卡片展示
   - 区域详情页
   - 信号热力图（按网格分布）
   - 区域内设备列表
   - 区域异常统计

5. **异常队列**
   - 异常列表（按严重程度、状态筛选）
   - 异常详情
   - 处理记录（确认、误报、已处理）
   - 批量操作
   - 处理人备注

6. **数据导入**
   - 文件格式说明
   - 拖放上传
   - 批量导入
   - 分类型导入
   - 触发风险分析

7. **报告导出**
   - 报告配置（时间范围、包含内容）
   - HTML 预览
   - Markdown 格式导出
   - CSV 格式导出
   - 高风险设备、区域问题、配对失败汇总

## 技术栈

### 后端
- Node.js + Express
- Sequelize ORM
- SQLite 数据库
- 依赖：cors, multer, csv-parser, lodash, dayjs

### 前端
- Vue 3 + Vite
- Vue Router
- Pinia
- Chart.js + vue-chartjs
- Axios
- dayjs
- lodash

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 初始化数据（可选）

项目包含种子数据和示例数据文件，可以快速体验系统功能。

```bash
cd backend
npm run seed
```

这将：
1. 重置并同步数据库
2. 导入示例数据（区域、设备、扫描记录、配对事件）
3. 运行风险分析
4. 生成各种异常样例

### 启动服务

**方式一：分别启动**

```bash
# 启动后端 (端口 3000)
cd backend
npm run dev

# 新终端窗口启动前端 (端口 5173)
cd frontend
npm run dev
```

**方式二：生产模式**

```bash
# 构建前端
cd frontend
npm run build

# 启动后端（会提供静态文件）
cd ../backend
npm start
```

### 访问系统

- 前端开发环境：http://localhost:5173
- 后端 API：http://localhost:3000
- 健康检查：http://localhost:3000/api/health
- 统计接口：http://localhost:3000/api/stats

## 数据文件格式

### 1. 设备台账 (devices.csv)

```csv
mac_address,device_name,device_type,serial_number,model,manufacturer,battery_level,is_random_address
00:1A:2B:3C:4D:5E,ESL-货架A1-牛奶区,esl,ESL-2024-001,ESL-Pro-2.4,Sunmi,85,false
```

**字段说明：**
- `mac_address` - MAC 地址（必填）
- `device_name` - 设备名称
- `device_type` - 设备类型
  - `esl` - 电子价签
  - `printer` - 小票打印机
  - `beacon` - Beacon 信标
  - `scanner` - 扫码枪
  - `headset` - 员工耳机
  - `other` - 其他
- `serial_number` - 序列号
- `model` - 型号
- `manufacturer` - 制造商
- `battery_level` - 电量（0-100）
- `is_random_address` - 是否随机地址

### 2. 扫描记录 (ble-scans.jsonl)

每一行一个 JSON 对象：

```json
{"mac_address": "00:1A:2B:3C:4D:5E", "rssi": -65, "tx_power": -59, "timestamp": "2024-12-15T08:00:00Z", "source": "gateway-1", "advertising_data": {"local_name": "ESL-A1"}}
```

**字段说明：**
- `mac_address` - MAC 地址（必填）
- `rssi` - 接收信号强度（必填，负值，越大越强）
- `tx_power` - 发射功率
- `timestamp` - 扫描时间（ISO 格式）
- `source` - 扫描源（网关标识）
- `advertising_data` - 广播数据
- `is_connectable` - 是否可连接

### 3. 配对事件 (pairing-events.csv)

```csv
mac_address,event_type,status,host_device,host_mac,timestamp,duration_seconds,error_code,error_message,operator
00:1A:2B:3C:4D:61,pair,success,收银台1-PC,AA:BB:CC:DD:EE:01,2024-12-15T08:05:00Z,15,,,张三
```

**字段说明：**
- `mac_address` - 设备 MAC 地址（必填）
- `event_type` - 事件类型：`pair`(配对), `unpair`(取消配对), `connect`(连接), `disconnect`(断开)
- `status` - 状态：`success`(成功), `failed`(失败), `timeout`(超时)
- `host_device` - 主机设备名称
- `host_mac` - 主机 MAC 地址
- `timestamp` - 事件时间
- `duration_seconds` - 持续时间（秒）
- `error_code` - 错误码
- `error_message` - 错误信息
- `operator` - 操作人

### 4. 区域定义 (zones.json)

```json
{
  "zones": [
    {
      "zone_code": "ZONE-001",
      "zone_name": "零售区A",
      "zone_type": "retail",
      "description": "主要零售区域",
      "location": {
        "floor": 1,
        "building": "主门店"
      },
      "expected_device_types": ["esl", "beacon"],
      "allowed_device_types": ["esl", "beacon", "scanner"],
      "forbidden_device_types": [],
      "rssi_threshold": -75,
      "expected_scan_frequency_minutes": 5,
      "max_allowed_disconnect_minutes": 60
    }
  ]
}
```

**字段说明：**
- `zone_code` - 区域代码（必填）
- `zone_name` - 区域名称（必填）
- `zone_type` - 区域类型：`retail`(零售), `warehouse`(仓库), `office`(办公), `checkout`(收银), `entrance`(入口), `storage`(存储)
- `description` - 描述
- `location` - 位置信息
- `expected_device_types` - 预期设备类型
- `allowed_device_types` - 允许设备类型
- `forbidden_device_types` - 禁止设备类型
- `rssi_threshold` - RSSI 阈值
- `max_allowed_disconnect_minutes` - 失联阈值（分钟）

## API 文档

### 设备 API (`/api/devices`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/devices` | 获取设备列表（支持分页、筛选） |
| GET | `/api/devices/:id` | 获取设备详情 |
| GET | `/api/devices/stats` | 获取设备统计 |
| GET | `/api/devices/:id/timeline` | 获取设备时间线 |
| GET | `/api/devices/:id/scan-stats` | 获取设备扫描统计 |
| PUT | `/api/devices/:id` | 更新设备信息 |

**查询参数：**
- `page` - 页码
- `pageSize` - 每页数量
- `device_type` - 设备类型筛选
- `status` - 状态筛选
- `zone_id` - 区域 ID
- `search` - 搜索关键词（MAC、名称、序列号）
- `sort_by` - 排序字段
- `sort_order` - 排序方向 (ASC/DESC)

### 区域 API (`/api/zones`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/zones` | 获取区域列表 |
| GET | `/api/zones/:id` | 获取区域详情 |
| GET | `/api/zones/stats` | 获取区域统计 |
| GET | `/api/zones/:id/heatmap` | 获取区域热力图数据 |
| GET | `/api/zones/:id/devices` | 获取区域内设备列表 |
| POST | `/api/zones` | 创建区域 |
| PUT | `/api/zones/:id` | 更新区域 |
| DELETE | `/api/zones/:id` | 删除区域 |

### 异常 API (`/api/anomalies`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/anomalies` | 获取异常列表 |
| GET | `/api/anomalies/:id` | 获取异常详情 |
| GET | `/api/anomalies/stats` | 获取异常统计 |
| PUT | `/api/anomalies/:id` | 更新异常 |
| POST | `/api/anomalies/:id/handle` | 添加处理记录 |

### 导入 API (`/api/import`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/devices` | 导入设备 CSV |
| POST | `/api/import/ble-scans` | 导入扫描记录 JSONL |
| POST | `/api/import/pairing-events` | 导入配对事件 CSV |
| POST | `/api/import/zones` | 导入区域 JSON |
| POST | `/api/import/batch` | 批量导入 |
| POST | `/api/import/analyze` | 触发风险分析 |

### 报告 API (`/api/reports`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports` | 获取报告（HTML/Markdown/CSV） |
| GET | `/api/reports/preview` | 预览报告 |

## 异常处理

### 异常状态流转

```
open (待处理) 
  → acknowledged (已确认) 
  → investigating (处理中) 
  → resolved (已解决)
  或
  → false_positive (误报)
```

### 处理操作

在异常队列页面，可以对异常执行以下操作：
1. **确认异常** - 标记为已确认
2. **标记误报** - 标记为误报并关闭
3. **分派处理** - 分配给处理人
4. **记录处理** - 记录处理详情
5. **标记解决** - 标记为已解决

## 示例数据

项目在 `sample-data/` 目录下提供了完整的示例数据：

- `zones.json` - 6个区域定义
- `devices.csv` - 16台设备（包含各种类型和异常样例）
- `ble-scans.jsonl` - 50+ 条扫描记录（包含信号抖动、弱信号等异常）
- `pairing-events.csv` - 18条配对事件（包含多次失败样例）

**异常样例预览：**

1. **RSSI 信号抖动**
   - 打印机-收银台1 (00:1A:2B:3C:4D:61)
   - RSSI 从 -45 到 -90 剧烈波动

2. **弱信号**
   - ESL-货架A2-零食区 (00:1A:2B:3C:4D:5F)
   - 平均 RSSI < -85 dBm

3. **低电量**
   - ESL-货架C1-生鲜区：5%（严重）
   - Beacon-仓库入口：8%（严重）
   - ESL-货架B1-饮料区：15%（警告）

4. **长时间失联**
   - ESL-货架B1-饮料区
   - 最后扫描：2天前

5. **配对失败过多**
   - 打印机-收银台1：3次失败
   - 耳机-员工李四：3次失败

6. **随机地址漂移**
   - 随机地址设备1和设备2
   - 相同 OUI (02:1A:2B)，不同地址

## 开发指南

### 项目结构

```
zy1137/
├── backend/                    # 后端代码
│   ├── config/                # 配置文件
│   │   └── database.js        # 数据库连接
│   ├── middleware/            # 中间件
│   │   └── errorHandler.js    # 错误处理
│   ├── models/                # 数据模型
│   │   ├── Device.js
│   │   ├── ScanRecord.js
│   │   ├── PairingEvent.js
│   │   ├── Zone.js
│   │   ├── Anomaly.js
│   │   ├── HandlingRecord.js
│   │   └── index.js
│   ├── routes/                # API 路由
│   │   ├── devices.js
│   │   ├── zones.js
│   │   ├── anomalies.js
│   │   ├── import.js
│   │   └── reports.js
│   ├── scripts/               # 脚本
│   │   └── seedData.js        # 种子数据
│   ├── services/              # 业务服务
│   │   ├── dataImporter.js    # 数据导入服务
│   │   ├── riskAnalyzer.js    # 风险分析引擎
│   │   └── reportGenerator.js # 报告生成器
│   ├── utils/                 # 工具函数
│   │   ├── dataParser.js      # 数据解析
│   │   └── response.js        # 响应格式化
│   ├── server.js              # 服务器入口
│   └── package.json
├── frontend/                   # 前端代码
│   ├── src/
│   │   ├── components/         # 组件
│   │   │   └── icons.js       # SVG 图标
│   │   ├── router/             # 路由
│   │   │   └── index.js
│   │   ├── styles/             # 样式
│   │   │   └── main.css
│   │   ├── utils/              # 工具
│   │   │   └── api.js         # API 封装
│   │   ├── views/              # 页面视图
│   │   │   ├── Dashboard.vue
│   │   │   ├── Devices.vue
│   │   │   ├── DeviceDetail.vue
│   │   │   ├── Zones.vue
│   │   │   ├── ZoneDetail.vue
│   │   │   ├── Anomalies.vue
│   │   │   ├── Import.vue
│   │   │   └── Reports.vue
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── sample-data/               # 示例数据
│   ├── devices.csv
│   ├── ble-scans.jsonl
│   ├── pairing-events.csv
│   └── zones.json
├── package.json
└── README.md
```

### 数据模型

```
Device (设备)
├── id
├── mac_address (唯一)
├── device_name
├── device_type (ENUM)
├── serial_number
├── model
├── manufacturer
├── battery_level
├── last_seen
├── first_seen
├── is_random_address
├── canonical_device_id (关联主设备，用于随机地址)
├── zone_id
├── status (ENUM: active/inactive/maintenance/missing)
├── risk_tags (JSON)
├── notes
└── metadata (JSON)

ScanRecord (扫描记录)
├── id
├── device_id
├── mac_address
├── rssi
├── tx_power
├── scan_timestamp
├── scan_source
├── is_connectable
├── advertising_data (JSON)
└── raw_data (JSON)

PairingEvent (配对事件)
├── id
├── device_id
├── mac_address
├── event_type
├── status
├── host_device
├── host_mac
├── event_timestamp
├── duration_seconds
├── error_code
├── error_message
├── operator
└── metadata (JSON)

Zone (区域)
├── id
├── zone_name
├── zone_code (唯一)
├── zone_type
├── description
├── location (JSON)
├── expected_device_types (JSON)
├── allowed_device_types (JSON)
├── forbidden_device_types (JSON)
├── rssi_threshold
├── expected_scan_frequency_minutes
├── max_allowed_disconnect_minutes
└── is_active

Anomaly (异常)
├── id
├── device_id
├── mac_address
├── zone_id
├── anomaly_type (ENUM)
├── severity (ENUM: critical/high/medium/low/warning/info)
├── status (ENUM: open/acknowledged/investigating/resolved/false_positive)
├── detected_at
├── last_updated_at
├── title
├── description
├── evidence (JSON)
├── risk_score
├── assigned_to
├── handler
├── notes (JSON)
└── threshold_config (JSON)

HandlingRecord (处理记录)
├── id
├── anomaly_id
├── device_id
├── action_type
├── action_time
├── handler
├── details
├── result
├── previous_status
└── new_status
```

### 运行测试

```bash
cd backend
npm test
```

### 数据库重置

如需重置数据库并重新导入数据：

```bash
cd backend
FORCE_SYNC=true npm run seed
```

## 常见问题

### Q: 如何解决 "Permission denied" 错误？

确保 SQLite 数据库文件（默认 `ble-inspection.db`）有写入权限。

### Q: 前端无法连接后端？

检查：
1. 后端是否在 3000 端口运行
2. 前端 vite.config.js 中的代理配置是否正确
3. 浏览器控制台是否有 CORS 错误

### Q: 导入的数据没有显示？

检查：
1. 文件格式是否正确
2. MAC 地址格式是否规范
3. 后端日志是否有错误信息

### Q: 风险分析没有检测到异常？

检查：
1. 是否有足够的扫描记录（需要至少 2 条来计算波动）
2. 时间是否在阈值范围内（默认检测过去 30 分钟的数据）
3. 是否调用了 `/api/import/analyze` 或触发了分析

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具。
