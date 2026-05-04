# 分诊转运压测台

一个专为医院急诊演练设计的全栈 Web 应用，用于模拟和管理急诊分诊、转运流程、床位调度等复杂场景。

## 功能特性

### 📊 核心功能

- **患者管理**：创建、编辑、删除患者信息，支持批量导入患者数据
- **三栏看板**：等待分诊 → 分诊中 → 治疗中，实时展示患者流转
- **分诊分级**：红区（紧急）、黄区（紧急）、绿区（非紧急）三级分诊
- **转运队列**：可拖拽调整的转运队列，自动计算优先级
- **科室床位**：实时监控科室容量和床位状态
- **规则引擎**：自动检测等待超时、床位冲突、分诊错误、转运漏看
- **实时同步**：WebSocket 实时推送状态更新
- **操作日志**：完整记录所有操作，支持追溯
- **数据导出**：Markdown 演练复盘报告、CSV 异常清单

### 🎯 解决的核心痛点

1. **分诊错误检测**：自动提示基于主诉的分诊级别建议
2. **等待超时预警**：红/黄/绿区分别设置超时阈值，自动告警
3. **床位释放同步**：检测患者出院/转运后床位未释放的同步问题
4. **转运队列漏看**：监控转运请求等待时间，防止关键患者被遗漏
5. **科室容量预警**：实时监测各科室床位占用率，提前预警

## 技术架构

### 前端技术栈

- **框架**：Vue 3 + Composition API
- **构建工具**：Vite
- **状态管理**：Pinia
- **路由**：Vue Router
- **HTTP 客户端**：Axios
- **拖拽排序**：Sortable.js
- **样式**：纯 CSS（CSS 变量 + 响应式设计）

### 后端技术栈

- **运行时**：Node.js
- **框架**：Express
- **数据库**：SQLite（文件型，无需额外安装）
- **实时通信**：WebSocket（ws 库）
- **日期处理**：date-fns
- **CSV 导出**：csv-writer

### 项目结构

```
xy4319/
├── client/                    # 前端项目
│   ├── src/
│   │   ├── api/              # API 接口封装
│   │   │   └── index.js
│   │   ├── router/           # 路由配置
│   │   │   └── index.js
│   │   ├── stores/           # Pinia 状态管理
│   │   │   ├── patients.js   # 患者状态
│   │   │   ├── transfers.js  # 转运状态
│   │   │   └── system.js     # 系统状态
│   │   ├── styles/           # 全局样式
│   │   │   └── main.css
│   │   ├── views/            # 页面视图
│   │   │   ├── Dashboard.vue     # 仪表板（主看板）
│   │   │   ├── Patients.vue      # 患者管理
│   │   │   ├── Transfers.vue     # 转运队列
│   │   │   ├── Departments.vue   # 科室床位
│   │   │   ├── Logs.vue          # 操作日志
│   │   │   ├── Reports.vue       # 报表导出
│   │   │   └── Settings.vue      # 系统设置
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                    # 后端项目
│   ├── database.js           # SQLite 数据库模型
│   ├── rulesEngine.js        # 规则引擎核心
│   ├── websocket.js          # WebSocket 服务
│   ├── logger.js             # 操作日志服务
│   ├── exportService.js      # 导出服务
│   ├── sampleData.js         # 示例数据生成
│   ├── routes.js             # API 路由
│   └── index.js              # 服务器入口
├── data/                      # 数据存储目录（自动创建）
├── package.json
└── README.md
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装步骤

1. **安装依赖**

```bash
# 安装根目录和前端依赖
npm run install-all
```

或手动安装：

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

2. **启动开发服务器**

```bash
# 同时启动前后端（推荐）
npm run dev
```

或分别启动：

```bash
# 启动后端服务（端口 3000）
npm run server

# 启动前端开发服务器（端口 5173）
npm run client
```

3. **访问应用**

- 前端地址：http://localhost:5173
- 后端 API：http://localhost:3000/api
- WebSocket：ws://localhost:3000

### 首次使用

1. 启动应用后，点击页面右上角的 **「加载示例数据」** 按钮
2. 系统将自动创建示例患者、科室、床位和转运数据
3. 切换到 **「仪表板」** 查看三栏看板
4. 尝试拖拽患者卡片改变状态，拖拽转运队列调整优先级

## 功能模块详解

### 1. 仪表板 (Dashboard)

**核心功能**：
- 实时统计卡片（总患者、红区、黄区、绿区、待转运、可用床位）
- 异常告警区域（等待超时、转运漏看、床位同步异常）
- 三栏看板（等待分诊 → 分诊中 → 治疗中）
- 转运队列列表
- 患者编辑/新增模态框

**交互特性**：
- 拖拽患者卡片在三栏之间移动，自动更新状态
- 点击患者卡片查看详情和编辑
- 转运队列可拖拽调整顺序，自动更新优先级

### 2. 患者管理 (Patients)

**核心功能**：
- 患者列表展示（支持按分诊级别、状态筛选）
- 患者搜索（按姓名、主诉）
- 新增/编辑患者信息
- 批量导入患者（JSON 格式）

**分诊级别配置**：

| 级别 | 颜色 | 超时阈值 | 优先级权重 | 说明 |
|------|------|----------|------------|------|
| 红区 | 🔴 | 5 分钟 | 100 | 紧急，需立即处理 |
| 黄区 | 🟡 | 30 分钟 | 50 | 紧急，需尽快处理 |
| 绿区 | 🟢 | 120 分钟 | 10 | 非紧急，可稍候 |

### 3. 转运队列 (Transfers)

**核心功能**：
- 待处理/进行中/已完成 三个标签页
- 转运请求卡片展示（患者信息、优先级、等待时间、目标科室）
- 拖拽排序调整转运顺序
- 手动调整优先级
- 标记转运完成

**优先级计算规则**：
```
优先级 = 基础优先级（分诊级别） + 超时加成（超时分钟数 × 2） + 特殊病情加成
```

### 4. 科室床位 (Departments)

**核心功能**：
- 科室容量统计卡片
- 科室容量预警（可用床位 < 20% 时告警）
- 各科室床位状态展示
- 床位详情表格（支持按状态、科室筛选）

### 5. 操作日志 (Logs)

**核心功能**：
- 操作日志列表（支持分页）
- 按严重程度筛选（调试/信息/警告/错误/严重）
- 按操作类型筛选
- 关键词搜索
- 日志详情查看（支持 JSON 格式化显示）

### 6. 报表导出 (Reports)

**核心功能**：
- 演练复盘报告（Markdown 格式）
  - 包含患者数据、转运记录、床位使用、规则检查结果
  - 支持预览和下载
- 数据导出
  - 患者数据 CSV
  - 异常事件清单 CSV
  - 转运记录 CSV
  - 操作日志 CSV

### 7. 系统设置 (Settings)

**核心功能**：
- 分诊规则配置（超时阈值、优先级权重）
- 实时同步设置（WebSocket 连接、自动刷新间隔）
- 数据管理（加载示例数据、清除所有数据）
- 系统信息查看

## 规则引擎说明

### 自动规则检查

系统每 30 秒自动运行一次规则检查，检测以下异常：

#### 1. 等待超时检测

```javascript
// 基于分诊级别的不同超时阈值
红区：等待 > 5 分钟 → 超时警告
黄区：等待 > 30 分钟 → 超时警告
绿区：等待 > 120 分钟 → 超时警告
```

#### 2. 床位同步检测

检测以下不一致状态：
- 患者已出院/转运，但床位仍显示被占用
- 床位显示被占用，但对应患者不存在或已出院

#### 3. 转运漏看检测

- 转运请求等待时间超过对应分诊级别的超时阈值
- 高优先级转运请求长时间未被处理

#### 4. 分诊级别建议

基于主诉自动推荐分诊级别：

**红区指征**：
- 心跳骤停、呼吸骤停、严重呼吸困难
- 意识丧失、休克、严重创伤大出血
- 急性心肌梗死、脑卒中发作、严重过敏反应

**黄区指征**：
- 胸痛、呼吸困难、意识障碍
- 严重腹痛、高热、急性创伤
- 中毒、癫痫发作

### 规则检查 API

```bash
# 手动触发规则检查
POST /api/rules/check

# 获取分诊级别建议
POST /api/rules/triage-suggestion
Content-Type: application/json

{
  "patient": {
    "name": "张三",
    "chiefComplaint": "胸痛2小时",
    "triageLevel": "green"
  }
}
```

## API 接口文档

### 患者管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/patients | 获取患者列表 |
| GET | /api/patients/:id | 获取单个患者 |
| POST | /api/patients | 创建患者 |
| PUT | /api/patients/:id | 更新患者 |
| DELETE | /api/patients/:id | 删除患者 |
| POST | /api/patients/batch | 批量导入患者 |

### 科室与床位

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/departments | 获取科室列表 |
| GET | /api/departments/:id/capacity | 获取科室容量 |
| GET | /api/beds | 获取床位列表 |
| GET | /api/ambulances | 获取救护车列表 |

### 转运队列

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/transfers | 获取转运队列 |
| POST | /api/transfers | 创建转运请求 |
| PUT | /api/transfers/:id | 更新转运状态 |
| POST | /api/transfers/reorder | 重新排序转运队列 |

### 规则与日志

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/rules/check | 运行规则检查 |
| POST | /api/rules/triage-suggestion | 获取分诊建议 |
| GET | /api/logs | 获取操作日志 |
| GET | /api/logs/stats | 获取日志统计 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/export/report | 下载 Markdown 复盘报告 |
| GET | /api/export/incidents | 下载异常事件 CSV |
| GET | /api/export/patients | 下载患者数据 CSV |

### 系统管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/system/info | 获取系统信息 |
| POST | /api/sample-data | 创建示例数据 |
| DELETE | /api/sample-data | 清除所有数据 |

## 数据库设计

### 核心数据表

#### 1. patients（患者表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID） |
| name | TEXT | 患者姓名 |
| age | INTEGER | 年龄 |
| gender | TEXT | 性别 |
| chiefComplaint | TEXT | 主诉 |
| triageLevel | TEXT | 分诊级别（red/yellow/green） |
| status | TEXT | 状态（waiting/triage/treatment/discharged/transferred） |
| arrivalTime | TEXT | 到达时间 |
| bedId | TEXT | 关联床位 ID |
| targetDepartment | TEXT | 目标科室 |
| notes | TEXT | 备注 |
| createdAt | TEXT | 创建时间 |
| updatedAt | TEXT | 更新时间 |

#### 2. departments（科室表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 科室名称 |
| totalBeds | INTEGER | 总床位数 |
| availableBeds | INTEGER | 可用床位数 |
| description | TEXT | 描述 |

#### 3. beds（床位表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| bedNumber | TEXT | 床位编号 |
| departmentId | TEXT | 所属科室 ID |
| status | TEXT | 状态（available/occupied/maintenance） |
| patientId | TEXT | 关联患者 ID |
| type | TEXT | 床位类型（普通/ICU/隔离等） |
| location | TEXT | 位置描述 |

#### 4. transfer_queue（转运队列表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| patientId | TEXT | 患者 ID |
| priority | INTEGER | 优先级 |
| queuePosition | INTEGER | 队列位置 |
| status | TEXT | 状态（pending/in_progress/completed/cancelled） |
| fromDepartment | TEXT | 来源科室 |
| toDepartment | TEXT | 目标科室 |
| reason | TEXT | 转运原因 |
| assignedAt | TEXT | 分配时间 |
| transferredAt | TEXT | 完成时间 |

#### 5. operation_logs（操作日志表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| action | TEXT | 操作类型 |
| entityType | TEXT | 实体类型 |
| entityId | TEXT | 实体 ID |
| severity | TEXT | 严重级别 |
| message | TEXT | 消息 |
| details | TEXT | 详细数据（JSON） |
| userId | TEXT | 操作用户 |
| createdAt | TEXT | 创建时间 |

#### 6. incidents（异常事件表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| type | TEXT | 事件类型 |
| severity | TEXT | 严重级别 |
| description | TEXT | 描述 |
| relatedEntityId | TEXT | 关联实体 ID |
| relatedEntityType | TEXT | 关联实体类型 |
| detectedAt | TEXT | 检测时间 |
| resolvedAt | TEXT | 解决时间 |
| status | TEXT | 状态（open/resolved） |

## 实时同步机制

### WebSocket 连接

前端在应用启动时自动建立 WebSocket 连接：

```javascript
const ws = new WebSocket('ws://localhost:3000')

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe' }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // 处理不同类型的消息
}
```

### 消息类型

| 类型 | 说明 |
|------|------|
| rule_results | 规则检查结果广播 |
| patient_update | 患者数据更新（created/updated/deleted） |
| transfer_update | 转运队列更新 |
| log_entry | 新操作日志 |
| incident | 新异常事件 |

### 自动规则检查

服务器每 30 秒自动运行一次规则检查，并通过 WebSocket 广播结果。

## 部署说明

### 开发环境

```bash
# 安装依赖
npm run install-all

# 启动开发服务器
npm run dev
```

### 生产环境

```bash
# 构建前端
npm run build

# 启动生产服务器
npm start
```

## 注意事项

1. **数据存储**：SQLite 数据库文件存储在 `data/` 目录下，定期备份该目录
2. **WebSocket**：生产环境建议使用 WSS（安全 WebSocket）
3. **日志保留**：操作日志默认保留最多 500 条，可根据需要调整
4. **示例数据**：加载示例数据不会删除现有数据，只是追加

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**分诊转运压测台** - 让急诊演练更真实、更高效、更有价值。
