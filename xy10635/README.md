# 法律咨询冲突分派系统

一个完整的法律咨询案件管理系统，支持案件分派、冲突检索、转派回访、线索漏斗分析等功能。

## 功能特性

### 核心业务功能
- **案件管理**: 创建、编辑、查询案件，支持按状态和领域筛选
- **冲突检索**: 检查对方主体是否在其他案件中出现，识别潜在冲突
- **律师分派**: 根据律师容量和专业领域自动/手动分派案件
- **转派回访**: 案件转派记录，支持回访跟进，记录回访结果
- **线索漏斗**: 可视化展示案件从线索到结案的转化过程

### 系统特性
- **幂等操作**: API支持幂等性，防止重复提交
- **状态历史**: 完整记录案件状态变更历史，包括操作人、时间、原因
- **修改记录**: 保存对方主体、案件领域、律师容量的修改前后值
- **导出功能**: 支持按责任人、处理时间筛选导出案件数据
- **统计面板**: 案件统计卡片，展示各状态案件数量
- **数据校验**: 案件领域等字段严格校验

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- 幂等性中间件
- RESTful API

### 前端
- React 18 + TypeScript
- Vite 构建工具
- Recharts 图表库
- Axios HTTP 客户端

## 快速开始

### 环境要求
- Node.js >= 16
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

### 初始化数据库

```bash
cd backend
# 创建数据库表
npm run init-db

# 插入样例数据
npm run seed
```

### 启动服务

```bash
# 启动后端服务 (端口 3001)
cd backend
npm start

# 新开终端，启动前端服务 (端口 3000)
cd frontend
npm run dev
```

### 访问系统
打开浏览器访问: http://localhost:3000

## API 接口文档

### 案件接口
- `GET /api/cases` - 获取案件列表
- `POST /api/cases` - 创建案件
- `GET /api/cases/:id` - 获取案件详情
- `POST /api/cases/:id/change-status` - 变更案件状态
- `POST /api/cases/:id/check-conflict` - 冲突检索
- `GET /api/cases/statistics` - 获取统计数据
- `GET /api/cases/lead-funnel` - 获取线索漏斗数据
- `GET /api/cases/export` - 导出案件

### 律师接口
- `GET /api/lawyers` - 获取律师列表
- `POST /api/lawyers` - 创建律师
- `POST /api/lawyers/assign` - 分派案件
- `POST /api/lawyers/reassign` - 转派案件
- `POST /api/lawyers/reassignments/:id/follow-up` - 完成回访

### 请求头
- `X-Idempotency-Key`: 幂等性键（可选，用于防止重复提交）

## 数据模型

### 案件 (cases)
- 案件编号、标题、对方主体、案件领域
- 状态、优先级、指派律师ID
- 创建人、创建时间、更新时间

### 律师 (lawyers)
- 姓名、专业领域
- 案件容量、当前负载
- 状态、创建时间、更新时间

### 状态历史 (status_history)
- 案件ID、原状态、新状态
- 操作人、变更原因、创建时间

### 冲突检查 (conflict_checks)
- 案件ID、对方主体
- 检查结果、冲突详情
- 检查人、创建时间

### 转派记录 (reassignments)
- 案件ID、原律师ID、新律师ID
- 转派原因、转派人
- 是否需要回访、是否完成
- 回访备注、回访人、回访时间

### 修改记录 (case_modifications)
- 案件ID、字段名
- 原值、新值
- 修改人、创建时间

## 业务场景覆盖

### 1. 案件创建与分派
- 录入案件信息，校验案件领域
- 系统自动识别律师容量
- 分派案件给合适的律师

### 2. 冲突检索
- 输入对方主体名称
- 系统检查是否存在相同对方主体的案件
- 返回冲突详情，提示潜在风险

### 3. 案件转派
- 选择新的律师（校验容量）
- 记录转派原因
- 可选择是否需要回访

### 4. 转派回访
- 查看待回访的转派记录
- 完成回访，记录回访备注
- 系统自动标记回访完成

### 5. 线索漏斗分析
- 可视化展示各阶段案件数量
- 分析案件转化效率
- 支持从页面和接口双端查询

### 6. 数据导出
- 按责任人筛选
- 按处理时间范围筛选
- 导出CSV格式报告

## 项目结构

```
├── backend/                 # 后端项目
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── routes/          # 路由
│   │   ├── middleware/      # 中间件
│   │   ├── utils/           # 工具函数
│   │   └── scripts/         # 脚本
│   ├── data/                # 数据库文件
│   └── package.json
├── frontend/                # 前端项目
│   ├── src/
│   │   ├── components/      # 组件
│   │   ├── services/        # API服务
│   │   └── types/           # 类型定义
│   └── package.json
└── README.md
```

## 验收要点

1. ✅ 案件领域正确校验（8个预设值）
2. ✅ 转派回访留痕（记录回访人、时间、备注）
3. ✅ 线索漏斗可从页面和接口两边查询
4. ✅ 保留对方主体、案件领域、律师容量的修改前后值
5. ✅ 导出报告支持按责任人和处理时间筛选
6. ✅ API支持幂等操作
7. ✅ 完整的状态变更历史记录
8. ✅ 冲突检索功能正常
9. ✅ 律师容量校验和控制

## License

MIT
