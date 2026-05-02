# 临时排班换班板

一个为小团队设计的排班和换班管理系统，支持成员管理、班次模板、排班表、换班申请流程等功能。

## 功能特性

- **成员管理**：添加、删除团队成员，设置角色信息
- **班次模板**：定义不同班次的时间和颜色标识
- **排班表**：按周展示排班，支持添加和删除排班
- **换班申请**：
  - 员工发起换班申请
  - 负责人可批准或拒绝
  - 自动更新排班
  - 防止重复申请和无效申请
- **审计日志**：记录所有操作，便于追溯
- **数据持久化**：本地SQLite数据库，刷新后数据不丢失
- **输入验证**：
  - 同一人同一天不能重复排班
  - 换班双方必须都有排班
  - 待处理申请不能重复提交
  - 不能和自己换班

## 技术栈

- **后端**：Node.js + Express + SQLite
- **前端**：React + Ant Design + Axios + Day.js

## 安装

### 前置要求

- Node.js (v14 或更高)
- npm 或 yarn

### 安装依赖

在项目根目录下执行：

```bash
npm run install:all
```

或者分别安装：

```bash
# 根目录
npm install

# 后端
cd server
npm install

# 前端
cd ../client
npm install
```

## 运行

### 方式一：同时启动前后端（推荐）

```bash
npm run dev
```

这会同时启动：
- 后端服务：http://localhost:5000
- 前端开发服务器：http://localhost:3000

### 方式二：分别启动

#### 启动后端

```bash
cd server
npm run dev
```

后端服务会在 http://localhost:5001 运行

#### 启动前端

新开一个终端窗口：

```bash
cd client
npm start
```

前端会在 http://localhost:3000 打开

## 使用流程

### 1. 初始设置

1. 打开浏览器访问 http://localhost:3000
2. 进入"班次管理"，添加班次模板（如：早班、晚班等）
3. 进入"成员管理"，添加团队成员

### 2. 创建排班

1. 进入"排班表"
2. 点击"添加排班"，选择成员、班次和日期
3. 排班会显示在本周排班表中

### 3. 申请换班

1. 在排班表中找到要交换的班次
2. 点击"申请换班"
3. 选择换班对象
4. 确认对方在同一天有排班
5. 提交申请

### 4. 审批换班

1. 进入"换班申请"
2. 对待处理的申请点击"批准"或"拒绝"
3. 批准后排班表会自动更新

### 5. 查看审计日志

进入"审计日志"查看所有操作记录

## 项目结构

```
shift-swap-board/
├── server/
│   ├── index.js          # 后端主文件
│   ├── database.js       # 数据库模型
│   ├── package.json      # 后端依赖
│   └── shiftboard.db     # SQLite数据库（自动创建）
├── client/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── index.js      # 前端入口
│   │   └── App.js        # 主组件
│   └── package.json      # 前端依赖
├── package.json          # 项目根配置
└── README.md
```

## API 接口

### 成员管理
- `GET /api/members` - 获取成员列表
- `POST /api/members` - 添加成员
- `DELETE /api/members/:id` - 删除成员

### 班次管理
- `GET /api/shift-templates` - 获取班次列表
- `POST /api/shift-templates` - 添加班次
- `DELETE /api/shift-templates/:id` - 删除班次

### 排班管理
- `GET /api/schedules` - 获取排班列表
- `POST /api/schedules` - 添加排班
- `DELETE /api/schedules/:id` - 删除排班

### 换班申请
- `GET /api/swap-requests` - 获取申请列表
- `POST /api/swap-requests` - 创建申请
- `PUT /api/swap-requests/:id` - 处理申请

### 审计日志
- `GET /api/audit-logs` - 获取操作日志

## 数据库

使用SQLite数据库，文件位于 `server/shiftboard.db`，包含以下表：

- `members` - 成员信息
- `shift_templates` - 班次模板
- `schedules` - 排班记录
- `swap_requests` - 换班申请
- `audit_logs` - 审计日志

## 注意事项

- 首次运行会自动创建数据库文件
- 数据存储在本地SQLite中，请定期备份
- 前端代理设置已配置，开发时无需处理跨域

## 许可证

MIT License
