# 课程顾问线索管理系统

一个本地可运行的全栈小后台，用于小型课程顾问管理体验课报名线索。

## 技术栈

### 后端
- **Node.js** + **Express** - 服务端框架
- **SQLite** (better-sqlite3) - 数据持久化
- **Joi** - 数据验证
- **Jest** + **Supertest** - 单元测试

### 前端
- **Vue 3** + **Vite** - 前端框架
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **Element Plus** - UI组件库
- **Axios** - HTTP客户端

## 功能特性

### 核心功能
- **线索列表**：查看所有线索，支持状态和负责人筛选、分页
- **线索详情**：查看单条线索详情，包含修改历史时间线
- **编辑表单**：编辑线索信息，表单验证、状态流转限制
- **数据一致性**：保存编辑后，列表和详情页立即展示同一份后端数据
- **修改历史**：记录每次修改的前后差异
- **导出报告**：导出 Markdown 格式的核对报告

### 数据校验
- **手机号验证**：必须是有效的11位手机号（以1开头）
- **预约时间验证**：必须是有效的日期时间格式
- **状态流转验证**：
  - 新线索 → 联系中、已取消
  - 联系中 → 已预约、未到场、已取消
  - 已预约 → 已参加、未到场、已取消
  - 已参加 → 已转化、无兴趣
  - 未到场 → 重新预约、流失
  - 已取消 → 重新预约、流失
  - 其他状态为终结状态，不可变更

### 状态说明
| 状态值 | 标签 | 说明 |
|--------|------|------|
| new | 新线索 | 刚创建的线索 |
| contacting | 联系中 | 正在联系学员 |
| appointed | 已预约 | 学员已预约体验课 |
| attended | 已参加 | 学员已参加体验课 |
| no_show | 未到场 | 预约但未到场 |
| cancelled | 已取消 | 学员取消预约 |
| converted | 已转化 | 学员报名正式课程 |
| not_interested | 无兴趣 | 学员表示无兴趣 |
| lost | 流失 | 学员流失 |
| reappointed | 重新预约 | 学员重新预约 |

### 课程列表
- Python编程体验课
- 少儿Scratch编程
- Web前端开发入门
- 数据科学基础
- 人工智能入门
- 机器人编程
- 游戏开发入门
- 大数据技术基础

### 负责人列表
- 张顾问、李顾问、王顾问、赵顾问
- 刘顾问、陈顾问、杨顾问、周顾问

## 项目结构

```
zy1288/
├── backend/                    # 后端项目
│   ├── package.json
│   ├── src/
│   │   ├── app.js             # 应用入口
│   │   ├── database/
│   │   │   ├── database.js    # 数据库配置和模型
│   │   │   └── seeds.js       # 种子数据
│   │   ├── middleware/
│   │   │   └── errorHandler.js # 错误处理中间件
│   │   ├── controllers/
│   │   │   └── leadController.js # 线索控制器
│   │   ├── routes/
│   │   │   └── leads.js       # 路由
│   │   └── utils/
│   │       └── validators.js  # 验证器
│   ├── tests/
│   │   └── leads.test.js      # 单元测试
│   └── data/                   # 数据库文件目录
│
└── frontend/                   # 前端项目
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.js            # 入口文件
        ├── App.vue            # 根组件
        ├── router/
        │   └── index.js       # 路由配置
        ├── stores/
        │   └── leads.js       # Pinia状态管理
        ├── api/
        │   └── leads.js       # API封装
        └── views/
            ├── LeadList.vue   # 线索列表页
            ├── LeadDetail.vue # 线索详情页
            └── LeadEdit.vue   # 线索编辑页
```

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

### 启动项目

#### 方式一：分别启动

**启动后端服务：**
```bash
cd backend
npm run dev
```
后端服务将在 http://localhost:3000 启动

**启动前端服务：**
```bash
cd frontend
npm run dev
```
前端服务将在 http://localhost:5173 启动

#### 方式二：生产环境启动

```bash
# 后端
cd backend
npm start

# 前端
cd frontend
npm run build
npm run preview
```

### 访问应用

启动后，在浏览器中访问 http://localhost:5173

## API 文档

### 基础路径
`http://localhost:3000/api`

### 健康检查
- `GET /health` - 检查服务状态

### 线索管理
- `GET /api/leads/metadata` - 获取元数据（状态、课程、负责人）
- `GET /api/leads` - 获取线索列表（支持筛选和分页）
  - 查询参数：`status`, `responsible`, `page`, `limit`
- `GET /api/leads/:id` - 获取单条线索详情及历史
- `POST /api/leads` - 创建新线索
- `PUT /api/leads/:id` - 更新线索
- `DELETE /api/leads/:id` - 删除线索
- `GET /api/leads/:id/export` - 导出 Markdown 报告

### 响应格式

#### 成功响应
```json
{
  "success": true,
  "data": { /* 数据内容 */ }
}
```

#### 错误响应
```json
{
  "success": false,
  "error": {
    "message": "错误描述",
    "code": "错误码",
    "timestamp": "2026-05-05T12:00:00.000Z"
  }
}
```

## 种子数据

首次启动时，系统会自动插入20条测试数据，包括：
- 10条预设的典型测试数据
- 10条随机生成的测试数据

测试数据示例：
- 张三 - Python编程体验课（新线索）
- 李四 - 少儿Scratch编程（联系中）
- 王五 - Web前端开发入门（已预约）
- 赵六 - 数据科学基础（已参加）
- 周九 - 游戏开发入门（已转化）
- ...

## 数据一致性保证

系统通过以下机制确保数据一致性：

1. **单一数据源**：所有页面都从同一个 Pinia Store 获取数据
2. **即时更新**：修改操作成功后，Store 会同时更新列表和详情数据
3. **原子更新**：更新操作是原子的，不会出现部分更新的情况
4. **重新获取详情**：更新后会重新获取详情数据，确保历史记录同步

## 运行测试

### 后端单元测试

```bash
cd backend
npm test
```

测试覆盖范围：
- 健康检查
- 元数据获取
- 线索 CRUD 操作
- 数据验证（手机号、时间、必填字段）
- 状态流转验证
- 错误处理
- 数据一致性验证

## 导出 Markdown 报告

在详情页点击"导出核对报告"按钮，会自动下载一份 Markdown 格式的报告，包含：
- 基本信息表格
- 修改历史记录
- 报告生成时间

示例报告内容：
```markdown
# 线索核对报告

## 基本信息

| 字段 | 内容 |
|------|------|
| **ID** | 1 |
| **学员姓名** | 张三 |
| **手机号** | 13800138001 |
| **课程** | Python编程体验课 |
| **预约时间** | 2026-05-10 14:00 |
| **当前状态** | 新线索 |
| **负责人** | 张顾问 |
| **备注** | 对Python编程感兴趣... |
| **创建时间** | 2026-05-05 10:00 |
| **最后更新** | 2026-05-05 10:00 |

## 修改历史

*暂无修改记录*

---
*报告生成时间: 2026-05-05 12:00:00*
```

## 安全特性

1. **CORS 限制**：只允许来自 http://localhost:5173 的请求
2. **请求限流**：15分钟内最多100次请求
3. **参数验证**：所有输入数据都经过严格验证
4. **错误处理**：统一错误处理，不泄露敏感信息

## 开发说明

### 添加新课程
在 `backend/src/database/database.js` 的 `COURSES` 数组中添加

### 添加新负责人
在 `backend/src/database/database.js` 的 `RESPONSIBLES` 数组中添加

### 修改状态流转规则
在 `backend/src/database/database.js` 的 `STATUS_FLOW` 对象中修改

## 注意事项

1. SQLite 数据库文件存储在 `backend/data/` 目录下
2. 首次启动会自动创建数据库和插入种子数据
3. 测试会创建独立的测试数据库（`test_leads.db`），不影响生产数据
4. 状态流转规则是严格的，不能跳过中间状态

## 许可证

MIT License
