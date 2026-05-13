# 体检套餐加项弃检管理系统

全栈 Web 应用，支持体检套餐和项目互斥管理、预约排期、加项订单、弃检原因记录、最终报告归档。

## 功能特性

### 统计卡片
- 体检套餐数量统计
- 体检项目数量统计
- 预约数量统计
- 今日预约统计
- 已归档报告统计
- 异常数量统计

### 异常看板
- 项目互斥冲突异常记录
- 异常状态管理（待处理/已解决）
- 异常严重程度标识
- 人工处理记录前后值对比

### 搜索过滤
- 按用户姓名搜索预约
- 按日期范围筛选
- 按状态筛选
- 按归档人筛选报告

### 报告导出
- 生成体检报告归档
- 按责任人和处理时间筛选
- 导出 Excel 格式报告

### 修改历史记录
- 套餐修改前后值对比
- 项目修改前后值对比
- 预约修改前后值对比

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- ExcelJS（Excel 导出）

### 前端
- React 18
- Ant Design 5
- Axios
- Day.js

## 快速开始

### 环境要求
- Node.js >= 16
- npm 或 yarn

### 安装依赖

```bash
# 后端依赖
cd backend
npm install

# 前端依赖
cd ../frontend
npm install
```

### 初始化数据

```bash
cd backend
npm run init
```

该命令会创建示例数据：
- 9个体检项目
- 3个体检套餐（基础、标准、豪华）
- 1组项目互斥（肝功能 <-> 肾功能）
- 3个预约记录
- 1个加项订单示例
- 1个弃检记录示例

### 启动服务

```bash
# 启动后端服务 (端口: 3001)
cd backend
npm start

# 启动前端服务 (端口: 3000)
cd ../frontend
npm start
```

### 访问应用
打开浏览器访问: http://localhost:3000

## 关键 API 接口

### 统计数据
```
GET /api/stats
```

### 套餐管理
```
GET /api/packages
POST /api/packages
PUT /api/packages/:id
```

### 项目管理
```
GET /api/items
POST /api/items
PUT /api/items/:id
```

### 项目互斥
```
GET /api/item-exclusions
POST /api/item-exclusions
```

### 预约管理
```
GET /api/appointments
POST /api/appointments
PUT /api/appointments/:id
```

### 加项订单
```
POST /api/appointments/:id/addons
```

### 弃检记录
```
POST /api/appointments/:id/waivers
```

### 异常管理
```
GET /api/exceptions
PUT /api/exceptions/:id/resolve
```

### 报告管理
```
POST /api/reports/generate/:appointmentId
GET /api/reports
POST /api/reports/export
```

### 修改历史
```
GET /api/history/:entityType/:entityId
```

## 报告导出说明

1. 进入"报告归档"页面
2. 可按归档人和日期范围筛选
3. 点击"导出Excel"按钮下载所有报告
4. Excel包含以下字段：
   - 报告编号
   - 用户姓名
   - 联系电话
   - 套餐名称
   - 预约日期
   - 预约时间
   - 总金额
   - 归档人
   - 归档时间

## 项目互斥说明

系统自动检测项目互斥：
1. 定义项目互斥关系（如：肝功能和肾功能不能同时选择）
2. 添加加项时自动检查是否与现有项目冲突
3. 冲突时创建异常记录并阻止操作
4. 异常显示在看板中，可人工处理并记录处理方案

## 目录结构

```
.
├── backend/
│   ├── src/
│   │   ├── index.js          # 入口文件
│   │   ├── database.js       # 数据库配置
│   │   ├── routes.js         # 路由定义
│   │   ├── services/         # 业务逻辑
│   │   └── scripts/          # 初始化脚本
│   ├── data/                 # 数据库文件
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── index.js          # 入口文件
│   │   ├── App.js            # 主组件
│   │   └── api.js            # API 封装
│   ├── public/
│   └── package.json
└── README.md
```

## 注意事项

1. 首次运行请先执行 `npm run init` 初始化数据库
2. 数据库文件存储在 `backend/data/` 目录
3. 后端默认端口 3001，前端默认端口 3000
4. 如需修改配置，请分别修改前后端启动参数
