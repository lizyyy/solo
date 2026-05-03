# 陶艺工作室窑炉排烧系统

一个小型全栈 Web 应用，帮助陶艺工作室管理作品排烧、窑炉调度、泥料釉料兼容性检查。

## 功能特性

### 核心排窑功能
- **排窑工作台**: 左侧待排作品列表，右侧烧窑任务管理
- **智能兼容性检查**:
  - 尺寸是否超出层架
  - 温区不匹配
  - 泥料和釉料兼容风险
  - 交付日期太近风险

### 作品管理
- 录入作品信息（客户、泥料、釉料、尺寸、交付日期、备注）
- 支持状态流转（待排 → 已入窑 → 烧成中 → 已出窑 → 已交付）
- 状态时间线记录

### 基础数据管理
- **客户管理**: 维护客户信息
- **泥料管理**: 泥料类型、温度范围、锥号
- **釉料管理**: 釉料类型、温度范围、兼容泥料配置
- **窑炉管理**: 窑炉配置、层架尺寸、层间距
- **烧成曲线**: 素烧、釉烧、不同锥号的曲线配置

### 导入导出
- 支持 CSV/JSON 导入作品
- 导出 Markdown 或 HTML 版烧窑单（含风险提示、层架占用）

## 技术栈

- **前端**: Vue 3 + Vite + Element Plus
- **后端**: Node.js + Express
- **数据库**: SQLite（文件存储，无需额外安装）

## 项目结构

```
zy1058/
├── backend/                 # 后端服务
│   ├── package.json
│   ├── src/
│   │   ├── app.js          # 主入口
│   │   ├── db.js           # 数据库配置
│   │   ├── seedData.js     # 示例数据
│   │   ├── routes/         # API 路由
│   │   │   ├── artworks.js
│   │   │   ├── customers.js
│   │   │   ├── materials.js
│   │   │   ├── kilns.js
│   │   │   ├── firingTasks.js
│   │   │   └── importExport.js
│   │   └── services/       # 业务逻辑
│   │       ├── validationService.js  # 兼容性校验
│   │       └── exportService.js      # 报告导出
│   └── data/               # SQLite 数据库文件
├── frontend/               # 前端应用
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── router/index.js
│       ├── api/           # API 服务
│       └── views/         # 页面组件
│           ├── Dashboard.vue
│           ├── KilnWorkbench.vue
│           ├── Artworks.vue
│           ├── Customers.vue
│           ├── Materials.vue
│           ├── KilnManagement.vue
│           ├── FiringTasks.vue
│           └── ImportExport.vue
└── README.md
```

## 安装与启动

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 启动服务

需要同时启动后端和前端服务（建议两个终端窗口）：

**终端 1 - 启动后端：**
```bash
cd backend
npm run dev
```
后端服务将运行在 `http://localhost:3000`

**终端 2 - 启动前端：**
```bash
cd frontend
npm run dev
```
前端服务将运行在 `http://localhost:5173`

### 3. 访问应用

打开浏览器访问：`http://localhost:5173`

## 示例数据

首次启动后端时，会自动初始化示例数据：

### 窑炉
- **一号电窑**: 电窑，最高温 1320°C，5 层架（每层 60×60cm）
- **二号气窑**: 气窑，最高温 1280°C，4 层架（每层 70×70cm）

### 烧成曲线
- **标准素烧 06号锥**: 素烧，最高 980°C
- **标准釉烧 06号锥**: 釉烧，最高 980°C
- **高温釉烧 10号锥**: 釉烧，最高 1280°C

### 泥料
- 高白泥、紫砂泥、陶土、瓷土（不同温度范围）

### 釉料
- 透明釉、青瓷釉、铁锈釉、窑变釉（含兼容泥料配置）

### 客户
- 张三、李四、王五（示例客户）

### 作品
- 3 件示例作品，包含交付日期和不同泥釉组合

## 使用指南

### 1. 排窑工作台（核心功能）

**新建烧窑任务：**
1. 点击右上角「新建任务」
2. 填写任务名称、选择窑炉和烧成曲线
3. 设置计划开始时间

**分配作品：**
1. 左侧列表显示所有「待排」状态的作品
2. 支持搜索和按交付日期筛选
3. 点击作品右侧「加入」按钮，或勾选后批量加入
4. 作品会从左侧移到右侧任务列表

**风险检查：**
1. 点击右侧「风险检查」按钮
2. 系统会检查：
   - 尺寸是否超出层架
   - 温区是否匹配
   - 泥釉兼容性
   - 交付日期风险
3. 严重风险显示为红色，警告显示为橙色

**导出烧窑单：**
1. 点击「Markdown」或「HTML」导出
2. 烧窑单包含：作品清单、风险提示、层架占用、待确认事项

### 2. 作品管理

**新建作品：**
1. 点击「新建作品」
2. 填写作品名称、选择客户（可选）
3. 选择泥料和釉料
4. 填写尺寸（宽×高×深，单位 cm）、重量（kg）
5. 设置交付日期和备注

**状态流转：**
1. 在作品详情页点击状态操作按钮
2. 支持：待排 → 已入窑 → 烧成中 → 已出窑 → 已交付
3. 每次状态变更都会记录时间线

### 3. 基础数据配置

**配置泥料兼容规则：**
1. 进入「材料管理」→「釉料管理」
2. 编辑釉料时可设置「兼容泥料」和「不兼容釉料」
3. 排窑时系统会自动检查兼容性

**配置窑炉层架：**
1. 进入「窑炉管理」
2. 设置层架数量、每层尺寸、层间距
3. 排窑时检查作品尺寸是否超限

### 4. 导入导出

**导入作品：**
1. 进入「导入导出」→「导入作品」
2. 下载模板（CSV 或 JSON）
3. 按格式填写作品数据
4. 上传文件，预览后点击「导入数据」

**导出作品：**
1. 进入「导入导出」→「导出作品」
2. 按状态或客户筛选
3. 点击「预览数据」确认
4. 选择导出格式（CSV 或 JSON）

## API 接口

### 作品管理
- `GET /api/artworks` - 获取作品列表
- `GET /api/artworks/:id` - 获取作品详情
- `POST /api/artworks` - 创建作品
- `PUT /api/artworks/:id` - 更新作品
- `DELETE /api/artworks/:id` - 删除作品
- `PUT /api/artworks/:id/status` - 更新作品状态
- `GET /api/artworks/:id/history` - 获取状态历史

### 烧窑任务
- `GET /api/firing-tasks` - 获取任务列表
- `GET /api/firing-tasks/:id` - 获取任务详情
- `POST /api/firing-tasks` - 创建任务
- `PUT /api/firing-tasks/:id` - 更新任务
- `DELETE /api/firing-tasks/:id` - 删除任务
- `GET /api/firing-tasks/:id/artworks` - 获取任务作品
- `POST /api/firing-tasks/:id/artworks` - 添加作品到任务
- `DELETE /api/firing-tasks/:id/artworks/:artworkId` - 从任务移除作品
- `GET /api/firing-tasks/:id/validate` - 兼容性检查
- `GET /api/firing-tasks/:id/export/:format` - 导出烧窑单
- `GET /api/firing-tasks/:id/history` - 获取任务历史

### 导入导出
- `POST /api/import/artworks` - 批量导入作品
- `GET /api/export/artworks` - 导出作品列表

## 数据持久化

所有数据存储在 `backend/data/kiln.db` SQLite 文件中。

**重置数据：**
删除该文件后重启后端服务，系统会重新初始化示例数据。

## 排窑校验规则

### 尺寸检查
- 作品宽度 > 层架宽度 → 严重风险
- 作品深度 > 层架深度 → 严重风险
- 作品高度 > 层间距 → 严重风险

### 温区匹配
- 泥料温度范围与烧成曲线不重叠 → 严重风险
- 釉料温度范围与烧成曲线不重叠 → 严重风险
- 泥料锥号与曲线锥号不一致 → 警告
- 釉料锥号与曲线锥号不一致 → 警告

### 泥釉兼容
- 釉料配置了不兼容泥料，而作品泥料在列表中 → 严重风险
- 釉料配置了兼容泥料，而作品泥料不在列表中 → 警告

### 交付日期
- 交付日期已过期 → 严重风险
- 交付日期在 3 天内 → 警告
- 交付日期在 7 天内 → 提示

## 常见问题

**Q: 如何添加新的泥料或釉料？**
A: 进入「材料管理」页面，点击「新建泥料」或「新建釉料」。

**Q: 如何配置泥釉兼容性？**
A: 编辑釉料时，可以设置「兼容泥料」和「不兼容釉料」。目前通过后端代码配置，后续版本会支持前端编辑。

**Q: 导出的烧窑单包含什么内容？**
A: 包含：任务基本信息、作品清单、风险检查结果、层架占用情况、待确认事项列表。

**Q: 如何备份数据？**
A: 直接备份 `backend/data/kiln.db` 文件即可。

**Q: 系统支持多用户吗？**
A: 当前版本是单用户系统，适合小型工作室使用。

## 开发说明

### 后端开发
```bash
cd backend
npm run dev    # 开发模式（自动重启）
npm run start  # 生产模式
```

### 前端开发
```bash
cd frontend
npm run dev     # 开发模式
npm run build   # 构建生产版本
```

### 修改校验规则
编辑 `backend/src/services/validationService.js` 文件。

### 修改导出模板
编辑 `backend/src/services/exportService.js` 文件。

## 许可证

MIT License
