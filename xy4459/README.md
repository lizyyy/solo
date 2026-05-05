# 轮胎店寄存复核系统

本地全栈 Web 工具，用于轮胎店换季寄存和装车复核管理。

## 功能特性

- 📱 **扫码录入**：支持条码扫描/手动录入轮胎组信息
- 👥 **客户管理**：客户车辆、联系方式信息管理
- 📦 **仓位管理**：轮胎仓位分配与追踪
- 🔍 **检测记录**：磨损深度、胎压检测数据录入
- 📋 **预约管理**：预约取胎单创建、查询、筛选
- ⚠️ **智能风险识别**：
  - 错仓检测：轮胎实际仓位与预约仓位不符
  - 规格不匹配：同一轮胎组存在多种规格
  - 胎压异常：胎压超出正常范围 (2.2-2.8bar)
  - 磨损超限：磨损深度低于安全阈值 (1.6mm)
- 📝 **人工改判**：风险判定可人工改判，备注持久化
- 📄 **导出功能**：
  - Markdown 装车交接单
  - JSON 审计明细

## 技术栈

- **后端**：Node.js + Express
- **前端**：原生 HTML/CSS/JavaScript
- **数据存储**：本地 JSON 文件

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问：**http://localhost:3000**

## 主流程验证

### 流程一：寄存轮胎

1. **进入扫码录入界面**
   - 点击主菜单「扫码录入」
   - 输入条码（如 `TS001`），点击「查询」或按回车

2. **创建客户（如无现有客户）**
   - 点击「+ 新客户」
   - 填写：姓名、电话、车牌、车型
   - 点击「保存」

3. **录入轮胎组信息**
   - 选择客户、仓位
   - 填写4条轮胎的：规格（如 `225/50 R17`）、花纹、品牌
   - 填写检测数据：磨损深度（单位 mm）、胎压（单位 bar）
   - 添加备注（可选）
   - 点击「保存」

### 流程二：创建预约

1. **进入预约列表**
   - 点击主菜单「预约列表」

2. **新建预约**
   - 点击「+ 新增预约」
   - 选择客户
   - 选择预约日期
   - 选择预期仓位（可选）
   - 勾选要预约的轮胎组
   - 添加备注（可选）
   - 点击「创建预约」

### 流程三：装车复核

1. **开始复核**
   - 在预约列表中找到待装车预约
   - 点击「开始复核」

2. **查看风险**
   - 系统自动检测并展示风险：
     - 致命风险（红色）：磨损超限
     - 高危风险（橙色）：错仓、规格不匹配
     - 中危风险（黄色）：胎压异常

3. **人工改判**
   - 对每条风险可选择：
     - `待确认` - 初始状态
     - `确认风险` - 确认风险存在
     - `人工改判` - 认为风险不成立
   - 可添加备注说明
   - 点击「保存」记录判定

4. **完成装车**
   - 确认无误后点击「完成装车」
   - 或点击「导出 Markdown」/「导出 JSON」下载报告

### 流程四：历史记录

1. **查看历史**
   - 点击主菜单「历史记录」
   - 切换标签查看：客户、轮胎组、预约

## 数据模型

### 客户 (customers.json)

```json
{
  "id": "唯一标识",
  "name": "客户姓名",
  "phone": "联系电话",
  "vehiclePlate": "车牌号",
  "vehicleModel": "车型",
  "createdAt": "创建时间",
  "updatedAt": "更新时间"
}
```

### 轮胎组 (tireSets.json)

```json
{
  "id": "唯一标识",
  "customerId": "所属客户ID",
  "barcode": "条码",
  "location": "仓位ID",
  "specifications": ["规格数组", "共4条"],
  "brands": ["品牌数组", "共4条"],
  "patterns": ["花纹数组", "共4条"],
  "quantity": 4,
  "status": "stored/retrieved",
  "storedAt": "寄存时间",
  "retrievedAt": "取走时间",
  "notes": "备注"
}
```

### 检测记录 (inspections.json)

```json
{
  "id": "唯一标识",
  "tireSetId": "轮胎组ID",
  "wearDepths": [磨损深度mm, 共4条],
  "pressures": [胎压bar, 共4条],
  "inspector": "检测人",
  "inspectedAt": "检测时间",
  "notes": "备注"
}
```

### 预约 (appointments.json)

```json
{
  "id": "唯一标识",
  "customerId": "客户ID",
  "tireSetIds": ["轮胎组ID数组"],
  "scheduledDate": "预约日期 YYYY-MM-DD",
  "expectedLocation": "预期仓位",
  "status": "pending/in_progress/completed/cancelled",
  "createdAt": "创建时间",
  "completedAt": "完成时间",
  "notes": "备注"
}
```

### 复核记录 (reviews.json)

```json
{
  "id": "唯一标识",
  "appointmentId": "预约ID",
  "tireSetId": "轮胎组ID",
  "riskType": "风险类型",
  "decision": "pending/confirmed/overruled",
  "notes": "备注",
  "createdAt": "创建时间",
  "updatedAt": "更新时间"
}
```

## 规则配置

在 `server.js` 中可调整规则阈值：

```javascript
const RULE_CONFIG = {
  minWearDepth: 1.6,      // 最小安全磨损深度 (mm)
  normalPressure: {        // 正常胎压范围 (bar)
    min: 2.2,
    max: 2.8
  }
};
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/locations | 获取仓位列表 |
| GET/POST | /api/customers | 客户列表/创建 |
| GET/PUT | /api/customers/:id | 客户详情/更新 |
| GET/POST | /api/tire-sets | 轮胎组列表/创建 |
| GET/PUT | /api/tire-sets/:id | 轮胎组详情/更新 |
| GET/POST | /api/inspections | 检测记录列表/创建 |
| GET/POST | /api/appointments | 预约列表/创建 |
| GET/PUT | /api/appointments/:id | 预约详情/更新 |
| POST | /api/appointments/:id/check-risks | 检测风险 |
| GET/POST | /api/reviews/:appointmentId | 复核记录 |
| GET | /api/export/markdown/:id | 导出 Markdown |
| GET | /api/export/json/:id | 导出 JSON |

## 目录结构

```
.
├── data/                    # 数据存储目录
│   ├── customers.json       # 客户数据
│   ├── tireSets.json        # 轮胎组数据
│   ├── inspections.json     # 检测记录
│   ├── appointments.json    # 预约数据
│   ├── reviews.json         # 复核记录
│   └── locations.json       # 仓位配置
├── public/                  # 静态文件
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js           # API 封装
│   │   └── main.js          # 主逻辑
│   └── index.html           # 入口页面
├── server.js                # 服务端
├── package.json
└── README.md
```
