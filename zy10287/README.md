# 人力外包入离场管理系统

## 功能特点

1. **人员管理**：录入外包人员基本信息，身份证号去重防止重复建档
2. **培训管理**：记录培训信息，标记培训状态
3. **工牌管理**：工牌发放与回收追踪
4. **入场管理**：入场登记与审批，自动检测未培训人员并预警
5. **离场管理**：离场登记，工牌回收检查
6. **结算管理**：结算记录与附件占位，工牌未回收预警
7. **排班管理**：人员排班，离场人员排班预警
8. **看板统计**：实时查看未培训人员、未回收工牌等异常数据
9. **数据导出**：按项目导出Excel报表
10. **数据持久化**：SQLite数据库存储，重启服务数据不丢失

## 业务规则校验

- 未培训人员入场时给出警告提示
- 工牌未回收就结算时给出警告提示
- 离场人员再次排班时给出警告提示
- 同一身份证号禁止重复建档
- 工牌号唯一不重复

## 项目结构

```
outsourcing-management/
├── server/              # 后端服务
│   ├── index.js        # 服务入口
│   ├── database.js     # 数据库初始化
│   └── routes.js       # API路由
├── client/             # 前端React应用
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── index.js
│       └── components/
├── data/               # SQLite数据库文件目录
├── uploads/            # 附件上传目录
└── package.json        # 项目配置
```

## 安装运行

### 方式一：分开运行（开发推荐）

1. **安装后端依赖**
```bash
npm install
```

2. **启动后端服务**（端口3001）
```bash
npm start
# 或开发模式（自动重启）
npm run dev
```

3. **安装前端依赖**（新开终端）
```bash
cd client
npm install
```

4. **启动前端服务**（端口3000）
```bash
npm start
```

5. 访问 http://localhost:3000

### 方式二：生产构建

1. 安装所有依赖
```bash
npm run install-all
```

2. 构建前端
```bash
cd client
npm run build
```

3. 启动后端服务（同时托管前端）
```bash
cd ..
npm start
```

4. 访问 http://localhost:3001

## API接口

### 人员管理
- `GET /api/persons` - 获取人员列表（支持project和keyword参数过滤）
- `GET /api/persons/:id` - 获取人员详情
- `POST /api/persons` - 新增人员

### 培训管理
- `GET /api/trainings` - 获取培训列表
- `POST /api/trainings` - 新增培训记录
- `PUT /api/trainings/:id` - 更新培训记录

### 工牌管理
- `GET /api/badges` - 获取工牌列表
- `POST /api/badges` - 发放工牌
- `PUT /api/badges/:id/return` - 回收工牌

### 入场/离场/结算/排班
- `POST /api/entries` - 登记入场
- `PUT /api/entries/:id/approve` - 审批入场
- `POST /api/exits` - 登记离场
- `POST /api/settlements` - 添加结算
- `POST /api/schedules` - 添加排班

### 看板与导出
- `GET /api/dashboard` - 获取看板统计数据
- `GET /api/export` - 导出Excel（支持type参数：all/noTraining/noBadgeReturn）

## 数据库

使用SQLite数据库，文件位于 `data/outsourcing.db`

数据表：
- persons - 人员信息
- trainings - 培训记录
- badges - 工牌记录
- entries - 入场记录
- exits - 离场记录
- settlements - 结算记录
- schedules - 排班记录

## 技术栈

- **后端**：Node.js + Express + SQLite3
- **前端**：React 18 + Ant Design 5 + Axios
- **导出**：xlsx (SheetJS)
