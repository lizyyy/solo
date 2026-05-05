# 农机合作社作业派工管理工具

一个面向县域农机合作社的本地全栈 Web 管理工具，用于春耕作业前的风险评估和派工管理。

## 功能特性

### 数据管理
- **农户地块管理**：管理农户信息、地块面积、位置、作物类型等
- **机具管理**：管理机具信息、保养记录、保养间隔等
- **机手管理**：管理机手信息、驾驶证、联系电话等
- **预约管理**：管理作业预约，关联地块、机具、机手和时段
- **油料补贴管理**：管理油料补贴金额、油耗等信息

### 风险校验（自动拦截/提醒）
- **高风险（拦截作业）**：
  - 机具保养逾期：距离上次保养超过设定间隔天数
  - 机手证照过期：驾驶证已过期
  - 时段冲突：同一机具同一时段有多个预约
  - 补贴异常：面积与油耗/补贴偏差超过 50%

- **中风险（仅提醒）**：
  - 保养即将逾期：剩余不到 7 天
  - 证照即将过期：30 天内过期

### 操作功能
- **一键导入示例数据**：快速体验系统功能
- **CSV 文件导入**：支持导入地块、机具、机手、预约、补贴数据
- **手动改判**：对自动拦截的风险项进行人工放行，记录改判原因
- **风险视图**：按地块/机具查看风险，快速定位问题
- **导出功能**：
  - Markdown 派工单：适合打印、分享
  - JSON 审计包：适合备份、审计

## 技术栈

### 后端
- **Node.js**：运行环境
- **Express.js**：Web 框架
- **better-sqlite3**：SQLite 数据库驱动（同步 API，高性能）
- **moment.js**：日期时间处理
- **multer**：文件上传处理
- **csv-parser**：CSV 文件解析
- **cors**：跨域处理

### 前端
- **React 18**：UI 框架
- **Vite**：构建工具
- **React Router**：路由管理
- **Ant Design (antd)**：UI 组件库
- **Axios**：HTTP 客户端
- **dayjs**：日期时间处理

## 项目结构

```
xy4487/
├── server/                 # 后端代码
│   ├── index.js           # 服务器入口
│   ├── database.js        # 数据库初始化
│   └── routes/            # API 路由
│       ├── index.js       # 路由汇总
│       ├── plots.js       # 地块管理 API
│       ├── machines.js    # 机具管理 API
│       ├── operators.js   # 机手管理 API
│       ├── reservations.js# 预约管理 API
│       ├── subsidies.js   # 油料补贴 API
│       ├── import.js      # 数据导入 API
│       ├── validation.js  # 风险校验 API
│       └── export.js      # 数据导出 API
├── client/                 # 前端代码
│   ├── src/
│   │   ├── main.jsx       # 入口文件
│   │   ├── App.jsx        # 主应用组件
│   │   ├── index.css      # 全局样式
│   │   ├── utils/
│   │   │   └── api.js     # API 封装
│   │   └── pages/         # 页面组件
│   │       ├── Dashboard.jsx    # 仪表盘
│   │       ├── Plots.jsx        # 地块管理
│   │       ├── Machines.jsx     # 机具管理
│   │       ├── Operators.jsx    # 机手管理
│   │       ├── Reservations.jsx # 预约管理
│   │       ├── Subsidies.jsx    # 油料补贴
│   │       ├── ImportData.jsx   # 数据导入
│   │       ├── ExportData.jsx   # 数据导出
│   │       └── RiskView.jsx     # 风险视图
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── data/                   # 数据库文件目录（运行时生成）
├── package.json            # 根配置
└── README.md               # 本文档
```

## 安装步骤

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

在项目根目录下执行以下命令：

```bash
# 安装后端和前端所有依赖
npm run install-all
```

或者分别安装：

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
```

## 运行步骤

### 开发模式（推荐）

在项目根目录下执行：

```bash
npm run dev
```

这会同时启动：
- 后端服务器：http://localhost:3000
- 前端开发服务器：http://localhost:5173

### 单独启动后端

```bash
npm run server
```

后端将在 http://localhost:3000 运行。

### 单独启动前端

```bash
npm run client
```

前端将在 http://localhost:5173 运行。

### 生产模式

```bash
# 构建前端
cd client
npm run build

# 启动后端（会自动服务前端构建产物）
cd ..
npm start
```

访问 http://localhost:3000 即可使用。

## 完整使用流程

### 1. 启动系统
按照上述步骤启动系统，浏览器访问前端地址。

### 2. 导入数据（首次使用）

#### 方式一：一键导入示例数据
1. 点击左侧菜单 **"数据导入"**
2. 点击 **"一键导入示例数据"** 按钮
3. 系统将自动导入：
   - 3 个农户地块
   - 3 台机具（部分保养逾期用于测试）
   - 3 位机手（部分证照过期用于测试）
   - 4 个预约（包含时段冲突用于测试校验）
   - 3 条油料补贴记录

#### 方式二：CSV 文件导入
在 **"数据导入"** 页面，可分别导入各类数据：

**地块 CSV 格式：**
```csv
农户姓名,地块名称,面积(亩),位置,作物类型
张三,东河村1号地,50.5,东河村东侧,小麦
李四,西坡村2号地,35.2,西坡村南,玉米
```

**机具 CSV 格式：**
```csv
机具名称,机具类型,车牌号,上次保养日期,保养间隔(天),状态
东方红-1,拖拉机,鲁A12345,2024-01-15,90,active
久保田-1,收割机,鲁A12346,2024-02-20,90,active
```

**机手 CSV 格式：**
```csv
机手姓名,身份证号,驾驶证类型,驾驶证号,驾驶证到期日期,联系电话
赵师傅,370101198001011234,G1,370101202001011234,2025-06-30,13800138001
```

**预约 CSV 格式（需要先导入地块、机具、机手）：**
```csv
地块名称,机具名称,机手姓名,开始时间,结束时间,作业类型
东河村1号地,东方红-1,赵师傅,2024-04-15 08:00,2024-04-15 12:00,耕地
```

**油料补贴 CSV 格式：**
```csv
地块名称,补贴金额(元),油耗(L),补贴日期,状态
东河村1号地,500.0,100.0,2024-04-10,approved
```

### 3. 风险校验

#### 方式一：逐个校验
1. 进入 **"预约管理"** 页面
2. 选择某个预约，点击 **"风险校验"**
3. 系统将显示该预约的所有风险项

#### 方式二：批量校验
1. 进入 **"风险视图"** 页面
2. 点击 **"执行全局校验"** 按钮
3. 系统将校验所有待处理预约

### 4. 查看风险

在 **"风险视图"** 页面，提供多个维度的风险查看：

- **全部预约**：显示所有预约及其风险状态
- **被拦截**：只显示有高风险且未改判的预约
- **已改判**：显示已人工放行的预约
- **按地块**：按地块分组查看风险
- **按机具**：按机具分组查看风险

风险状态标识：
- 🔴 **拦截**：存在高风险，无法正常派工
- 🟡 **放行（已改判）**：原高风险已被人工放行
- 🟢 **正常**：无高风险，可正常派工
- 🟠 **警告**：存在中风险，仅提醒

### 5. 手动改判

对于被自动拦截的预约，如果经过人工核实后认为可以放行，可以进行手动改判：

1. 在 **"预约管理"** 或 **"风险视图"** 中找到被拦截的预约
2. 点击 **"查看风险"** 或 **"改判"** 按钮
3. 查看具体的风险项
4. 点击某项风险的 **"手动改判"** 按钮
5. 输入改判原因，确认提交

改判记录会被保存到审计日志中，可在导出的审计包中查看。

### 6. 导出功能

#### 导出 Markdown 派工单
1. 进入 **"数据导出"** 页面
2. 点击 **"导出 Markdown 派工单"**
3. 系统将生成包含所有预约信息的 Markdown 文件
4. 文件可直接用 Markdown 编辑器打开查看，或打印

单个预约的派工单也可在 **"预约管理"** 中点击 **"导出派工单"** 单独导出。

#### 导出 JSON 审计包
1. 进入 **"数据导出"** 页面
2. 点击 **"导出 JSON 审计包"**
3. 系统将生成完整的 JSON 格式数据文件，包含：
   - 所有基础数据（地块、机具、机手、预约、补贴）
   - 所有风险评估记录
   - 所有审计日志
   - 统计汇总信息

## 数据库说明

### 数据表结构

系统使用 SQLite 数据库，包含以下 8 张表：

| 表名 | 说明 |
|------|------|
| plots | 农户地块表 |
| machines | 机具表 |
| operators | 机手表 |
| reservations | 预约表 |
| oil_subsidies | 油料补贴表 |
| risk_assessments | 风险评估表 |
| audit_logs | 审计日志表 |

### 风险类型定义

| 风险类型代码 | 说明 | 风险等级 |
|-------------|------|---------|
| maintenance_overdue | 保养逾期 | 高风险（拦截） |
| maintenance_warning | 保养即将逾期 | 中风险（提醒） |
| license_expired | 证照过期 | 高风险（拦截） |
| license_expiring | 证照即将过期 | 中风险（提醒） |
| time_conflict | 时段冲突 | 高风险（拦截） |
| subsidy_abnormality | 补贴异常 | 高风险（拦截） |
| subsidy_warning | 补贴偏差较大 | 中风险（提醒） |

### 校验参数

以下参数为硬编码的默认值，可根据实际情况在代码中调整：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 保养间隔 | 90 天 | 默认保养周期 |
| 保养警告阈值 | 剩余 7 天 | 保养即将逾期的提醒阈值 |
| 证照警告阈值 | 剩余 30 天 | 证照即将过期的提醒阈值 |
| 预期油耗 | 2 L/亩 | 每亩预期油耗（用于补贴异常校验） |
| 预期补贴 | 10 元/亩 | 每亩预期补贴（用于补贴异常校验） |
| 异常偏差阈值 | 50% | 超过此偏差判定为异常（拦截） |
| 警告偏差阈值 | 20% | 超过此偏差判定为警告（提醒） |

## API 接口说明

### 基础路径
所有 API 都以 `/api` 为前缀。

### 地块管理
- `GET /api/plots` - 获取所有地块
- `GET /api/plots/:id` - 获取单个地块
- `POST /api/plots` - 创建地块
- `PUT /api/plots/:id` - 更新地块
- `DELETE /api/plots/:id` - 删除地块

### 机具管理
- `GET /api/machines` - 获取所有机具（含保养状态）
- `GET /api/machines/:id` - 获取单个机具
- `POST /api/machines` - 创建机具
- `PUT /api/machines/:id` - 更新机具
- `DELETE /api/machines/:id` - 删除机具

### 机手管理
- `GET /api/operators` - 获取所有机手（含证照状态）
- `GET /api/operators/:id` - 获取单个机手
- `POST /api/operators` - 创建机手
- `PUT /api/operators/:id` - 更新机手
- `DELETE /api/operators/:id` - 删除机手

### 预约管理
- `GET /api/reservations` - 获取所有预约（含关联信息）
- `GET /api/reservations/:id` - 获取单个预约
- `POST /api/reservations` - 创建预约
- `PUT /api/reservations/:id` - 更新预约
- `PUT /api/reservations/:id/status` - 更新预约状态
- `DELETE /api/reservations/:id` - 删除预约

### 油料补贴管理
- `GET /api/subsidies` - 获取所有补贴
- `GET /api/subsidies/:id` - 获取单个补贴
- `POST /api/subsidies` - 创建补贴
- `PUT /api/subsidies/:id` - 更新补贴
- `DELETE /api/subsidies/:id` - 删除补贴

### 数据导入
- `POST /api/import/plots` - 导入地块 CSV
- `POST /api/import/machines` - 导入机具 CSV
- `POST /api/import/operators` - 导入机手 CSV
- `POST /api/import/reservations` - 导入预约 CSV
- `POST /api/import/subsidies` - 导入补贴 CSV
- `POST /api/import/sample` - 一键导入示例数据

### 风险校验
- `POST /api/validation/reservation/:id` - 校验单个预约
- `POST /api/validation/all` - 校验所有待处理预约
- `POST /api/validation/override/:riskId` - 手动改判风险
- `POST /api/validation/cancel-override/:riskId` - 取消改判

### 数据导出
- `GET /api/export/dispatch-notes` - 导出所有派工单（Markdown）
  - 查询参数：`status`（状态过滤）、`date_from`（开始日期）、`date_to`（结束日期）
- `GET /api/export/audit-package` - 导出审计包（JSON）
- `GET /api/export/reservation/:id/dispatch-note` - 导出单个预约派工单

## 常见问题

### Q1: 数据库文件在哪里？
数据库文件位于 `data/agricultural.db`。如果需要备份，直接复制该文件即可。

### Q2: 如何重置数据？
删除 `data/agricultural.db` 文件，重启服务器后会自动创建新的空数据库。或者在 **"数据导入"** 页面重新导入示例数据（会清空现有数据）。

### Q3: 保养间隔可以调整吗？
可以。在添加或编辑机具时，可以设置 `maintenance_interval_days`（保养间隔天数）字段，默认是 90 天。

### Q4: 手动改判后如何恢复？
在 **"风险视图"** 的 **"已改判"** 标签页中，找到已改判的风险，点击 **"取消改判"** 即可恢复原拦截状态。

### Q5: 端口被占用怎么办？
- 后端默认端口 3000：设置环境变量 `PORT` 可修改
- 前端默认端口 5173：修改 `client/vite.config.js` 中的 `server.port`

示例：
```bash
# Windows (PowerShell)
$env:PORT=3001; npm run server

# macOS/Linux
PORT=3001 npm run server
```

### Q6: 如何修改风险校验的参数？
风险校验逻辑位于 `server/routes/validation.js` 文件中，可以直接修改以下参数：

```javascript
// 预期油耗和补贴（用于补贴异常校验）
const expectedFuelPerMu = 2;      // 每亩预期油耗（升）
const expectedSubsidyPerMu = 10;  // 每亩预期补贴（元）

// 偏差阈值
if (fuelDeviation > 0.5 || subsidyDeviation > 0.5) {  // 50% 异常
  // 高风险（拦截）
}
if (fuelDeviation > 0.2 || subsidyDeviation > 0.2) {  // 20% 警告
  // 中风险（提醒）
}
```

## 许可证

MIT License

## 更新日志

### v1.0.0 (2024-04-10)
- 初始版本发布
- 实现基础数据管理（地块、机具、机手、预约、补贴）
- 实现 4 种高风险拦截和 2 种中风险提醒
- 实现手动改判功能
- 实现 CSV 数据导入和示例数据一键导入
- 实现 Markdown 派工单和 JSON 审计包导出
- 实现风险视图（按地块/机具查看）
- 完成前后端联调测试
