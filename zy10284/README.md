# 校园宿舍维修闭环台

一个完整的校园宿舍维修管理系统，支持报修、审核、派工、材料记录、完工、回访和返工全流程管理。

## 功能特性

### 核心流程
- **学生报修**：提交维修申请，支持选择宿舍、维修类型和问题描述
- **审核管理**：管理员审核报修，可通过或拦截
- **派工管理**：分配维修工人，记录工人信息
- **材料记录**：记录使用的维修材料，支持超量预警
- **完工确认**：确认维修完成
- **客户回访**：满意度评分，低于2星自动触发返工
- **返工管理**：安排返工处理

### 业务逻辑
- **重复报修检测**：同一宿舍同类问题未处理时禁止重复提交
- **自动返工触发**：评分≤2星自动进入返工流程
- **材料超量预警**：超过规定用量自动标记
- **楼栋筛选**：支持按楼栋筛选报修记录
- **数据导出**：导出本周维修情况到Excel

### 状态管理
- 待审核 (pending)
- 待派工 (assigned)
- 维修中 (processing)
- 待回访 (reviewing)
- 已完成 (completed)
- 待返工 (rework)
- 已拦截 (blocked)

## 技术栈

- **前端**：Vue 3 + Vue Router + Element Plus + Axios
- **后端**：Node.js + Express
- **数据库**：SQLite 3
- **Excel导出**：ExcelJS

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动项目

#### 方式一：同时启动前后端（推荐）
```bash
npm run dev
```

#### 方式二：分别启动
```bash
# 启动后端服务（端口 3001）
npm run server

# 启动前端服务（端口 3000）
npm run client
```

### 访问系统

打开浏览器访问：http://localhost:3000

## 预置数据

系统启动时自动预置以下数据：

### 宿舍信息
- 1号楼：101、102、201
- 2号楼：101、102
- 3号楼：301、302
- 4号楼：401

### 样例报修单
1. **待审核**：1号楼101 张三 - 水管漏水
2. **维修中**：1号楼102 李四 - 水龙头问题（已审核、已派工）
3. **待派工**：1号楼201 王五 - 电路问题（已审核）
4. **待回访**：2号楼101 赵六 - 门锁问题（已完工）
5. **已完成**：2号楼102 孙七 - 灯具问题（已回访，评分4星）

## 完整流程演示

### 流程1：从报修到完成
1. 点击"新建报修"，填写报修信息
2. 点击操作 -> 审核（状态：pending → assigned）
3. 点击操作 -> 派工（状态：assigned → processing）
4. 点击操作 -> 记录材料
5. 点击操作 -> 完工确认（状态：processing → reviewing）
6. 点击操作 -> 回访（状态：reviewing → completed，评分≥3星）

### 流程2：评分差触发返工
1. 回访时评分≤2星
2. 系统自动触发返工流程（状态：reviewing → rework）
3. 点击操作 -> 安排返工（状态：rework → processing）
4. 重新进行维修流程

### 流程3：重复报修拦截
1. 1号楼101提交"水管"类报修
2. 在该报修未完成前，再次提交1号楼101的"水管"报修
3. 系统自动拦截，提示"该宿舍已有同类报修正在处理中"

## API 接口

### 宿舍管理
- `GET /api/dorms` - 获取所有宿舍
- `GET /api/dorms/buildings` - 获取所有楼栋

### 报修管理
- `POST /api/repair-orders` - 创建报修单
- `GET /api/repair-orders` - 获取报修列表（支持筛选）
- `GET /api/repair-orders/:id` - 获取报修详情
- `POST /api/repair-orders/:id/audit` - 审核报修
- `POST /api/repair-orders/:id/assign` - 派工
- `POST /api/repair-orders/:id/materials` - 记录材料
- `POST /api/repair-orders/:id/complete` - 完工确认
- `POST /api/repair-orders/:id/review` - 回访评分
- `POST /api/repair-orders/:id/rework` - 安排返工

### 数据导出
- `GET /api/export/weekly` - 导出本周维修报表（Excel）

### 统计
- `GET /api/stats` - 获取各状态数量统计

## 项目结构

```
.
├── server/
│   ├── index.js          # 后端服务入口
│   ├── database.js       # 数据库初始化
│   └── repair.db         # SQLite数据库文件（自动生成）
├── src/
│   ├── main.js           # 前端入口
│   ├── router/
│   │   └── index.js      # 路由配置
│   └── views/
│       ├── RepairList.vue   # 报修列表页
│       └── RepairDetail.vue # 报修详情页
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

## 注意事项

1. 数据库文件 `server/repair.db` 会在首次启动时自动创建
2. 样例数据仅在数据库为空时自动插入
3. 前端通过 Vite 代理 `/api` 到后端 `http://localhost:3001`
4. 材料超量阈值：水管2根、水龙头1个、灯泡5个、门锁1个，超过自动标记

## 浏览器兼容性

- Chrome (推荐)
- Firefox
- Safari
- Edge
