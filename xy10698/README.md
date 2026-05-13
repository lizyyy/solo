# 知识库命中反馈闭环系统

智能客服知识库命中反馈全链路追踪系统，实现从坐席采纳、用户追问到运营修订的完整闭环。

## 功能特性

### 数据覆盖
- 问题意图管理
- 回复版本控制
- 坐席采纳记录
- 误答反馈追踪
- 知识修订留痕
- 命中分析统计

### 业务规则
- 误答升级机制
- 版本回滚功能
- 人工修订留痕
- 重复反馈合并

### 前端功能
- 搜索过滤（按名称、分类）
- 详情时间线（全链路追踪）
- 复核面板（修订回复、回滚版本）
- 数据统计（命中率、待修订、责任人）

### 后端接口
- 状态接口
- CRUD 操作
- 数据导出（CSV）
- 业务规则 API

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── server.js        # 主服务入口
│   │   ├── database.js      # 数据库配置
│   │   └── seed.js          # 造数脚本
│   ├── data/                # SQLite 数据目录
│   └── package.json
├── frontend/                # 前端应用
│   ├── public/
│   ├── src/
│   │   ├── App.js           # 主应用
│   │   └── index.js
│   └── package.json
└── package.json             # 根项目配置
```

## 快速开始

### 1. 安装依赖

```bash
# 安装所有依赖（根目录 + 后端 + 前端）
npm run install:all
```

或者分别安装：

```bash
# 后端
cd backend && npm install

# 前端
cd frontend && npm install
```

### 2. 初始化数据（造数）

```bash
# 在根目录执行，初始化测试数据
npm run seed
```

造数脚本会自动创建以下测试数据：
- 5 个用户（坐席、运营、主管）
- 5 个知识库意图（退款流程、物流查询、退换货政策等）
- 多个回复版本
- 8 条命中记录
- 4 条反馈记录
- 修订历史记录

### 3. 启动服务

#### 方式一：同时启动前后端（推荐）

```bash
# 在根目录执行
npm run dev
```

#### 方式二：分别启动

```bash
# 启动后端服务（端口 3001）
cd backend && npm run dev

# 启动前端服务（端口 3000）
cd frontend && npm start
```

### 4. 访问应用

- 前端地址：http://localhost:3000
- 后端 API：http://localhost:3001

## 后端接口文档

### 基础信息
- 基础地址：`http://localhost:3001/api`

### 状态接口

```bash
# 服务健康检查
GET /api/status
```

### 统计接口

```bash
# 获取仪表盘统计数据
GET /api/stats

# 响应示例：
{
  "hitRate": 75.5,
  "totalHits": 100,
  "pendingRevisions": 5,
  "responsiblePersons": [
    {"id": "user-1", "name": "张三", "count": 3}
  ]
}
```

### 意图接口

```bash
# 获取意图列表（支持搜索过滤）
GET /api/intents?search=退款&category=订单&status=active

# 获取意图详情
GET /api/intents/:id

# 获取意图时间线
GET /api/timeline/:intentId
```

### 反馈接口

```bash
# 提交反馈
POST /api/feedbacks
{
  "hit_record_id": "hr-1",
  "type": "wrong_answer",
  "reason": "回复不准确",
  "reported_by": "user-1"
}

# 升级反馈优先级
PUT /api/feedbacks/:id/upgrade

# 合并重复反馈
POST /api/merge-feedbacks
{
  "targetId": "fb-1",
  "sourceIds": ["fb-2", "fb-3"]
}
```

### 版本接口

```bash
# 创建新版本
POST /api/reply-versions
{
  "intent_id": "intent-1",
  "content": "新的回复内容",
  "created_by": "user-3"
}

# 回滚版本
POST /api/rollback-version
{
  "intent_id": "intent-1",
  "version_id": "rv-1",
  "revised_by": "user-3"
}
```

### 修订接口

```bash
# 记录修订操作
POST /api/revisions
{
  "intent_id": "intent-1",
  "reply_version_id": "rv-2",
  "action": "update",
  "previous_content": "旧内容",
  "new_content": "新内容",
  "revised_by": "user-3",
  "remark": "优化回复内容"
}
```

### 导出接口

```bash
# 导出反馈记录（CSV）
GET /api/export?type=feedbacks

# 导出命中记录（CSV）
GET /api/export?type=hits
```

## 接口调用示例

### 使用 curl

```bash
# 查看服务状态
curl http://localhost:3001/api/status

# 获取统计数据
curl http://localhost:3001/api/stats

# 获取意图列表
curl "http://localhost:3001/api/intents?search=退款"

# 提交反馈
curl -X POST http://localhost:3001/api/feedbacks \
  -H "Content-Type: application/json" \
  -d '{"hit_record_id":"hr-1","type":"wrong_answer","reason":"测试反馈","reported_by":"user-1"}'
```

### 使用 axios

```javascript
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

// 获取统计
const stats = await axios.get(`${API_BASE}/stats`);

// 获取意图列表
const intents = await axios.get(`${API_BASE}/intents`, {
  params: { search: '退款', category: '订单' }
});

// 提交修订
await axios.post(`${API_BASE}/reply-versions`, {
  intent_id: 'intent-1',
  content: '新回复内容',
  created_by: 'user-3'
});
```

## 失败样例与错误处理

### 1. 缺少必填字段

```bash
# 请求
curl -X POST http://localhost:3001/api/feedbacks \
  -H "Content-Type: application/json" \
  -d '{"type":"wrong_answer"}'

# 响应（400 Bad Request）
{
  "error": "缺少必填字段"
}
```

### 2. 无效的导出类型

```bash
# 请求
curl http://localhost:3001/api/export?type=invalid

# 响应（400 Bad Request）
{
  "error": "无效的导出类型"
}
```

### 3. 查询不存在的意图

```bash
# 请求
curl http://localhost:3001/api/intents/not-exist

# 响应（404 Not Found）
{
  "error": "意图不存在"
}
```

### 4. 数据库错误

```bash
# 响应（500 Internal Server Error）
{
  "error": "SQLITE_ERROR: no such table: intents"
}
```

## 前端功能说明

### 1. 仪表盘统计
- 命中率：显示坐席采纳率，环形进度图展示
- 待修订条目：显示需要处理的反馈数量
- 责任人：按坐席分组显示待处理反馈

### 2. 搜索过滤
- 支持按意图名称、描述搜索
- 支持按分类筛选（订单、配送、售后、促销、账户）
- 导出功能：支持导出 CSV 格式的反馈和命中记录

### 3. 详情模态框
- 时间线标签页：展示完整的事件流（版本创建、命中、反馈、修订）
- 回复版本标签页：查看历史版本，支持回滚操作
- 反馈列表标签页：查看反馈记录，支持升级优先级

### 4. 复核面板
- 输入新的回复内容
- 填写修订备注
- 自动创建新版本和修订记录

## 数据库设计

### intents（意图表）
- id: 主键
- name: 意图名称
- description: 描述
- category: 分类
- status: 状态
- created_at/updated_at: 时间戳

### reply_versions（回复版本表）
- id: 主键
- intent_id: 关联意图
- content: 回复内容
- version: 版本号
- created_by: 创建人
- is_current: 是否当前版本

### hit_records（命中记录表）
- id: 主键
- intent_id: 关联意图
- reply_version_id: 关联回复版本
- session_id: 会话 ID
- user_query: 用户查询
- agent_id: 坐席 ID
- adopted: 是否采纳
- follow_up: 是否追问
- hit_score: 命中等分

### feedbacks（反馈表）
- id: 主键
- hit_record_id: 关联命中记录
- type: 反馈类型
- reason: 反馈原因
- reported_by: 报告人
- status: 状态
- priority: 优先级
- merged_from: 合并来源

### revisions（修订记录表）
- id: 主键
- intent_id: 关联意图
- reply_version_id: 关联回复版本
- action: 操作类型
- previous_content: 旧内容
- new_content: 新内容
- revised_by: 修订人
- remark: 备注

## 技术栈

### 后端
- Node.js
- Express.js
- SQLite3
- json2csv（CSV 导出）
- uuid（ID 生成）

### 前端
- React 18
- Ant Design 5
- Axios

## 注意事项

1. 数据库文件位于 `backend/data/knowledge_base.db`，首次启动会自动创建
2. 造数脚本会覆盖现有数据，生产环境慎用
3. 前端默认代理到 `http://localhost:3001`，如需修改请编辑 `frontend/package.json` 的 proxy 字段
4. 所有时间戳使用 SQLite 的 CURRENT_TIMESTAMP，为 UTC 时间

## 开发说明

### 后端开发
```bash
cd backend
npm run dev    # 热重载开发模式
```

### 前端开发
```bash
cd frontend
npm start      # 热重载开发模式
```

### 添加新接口
1. 在 `backend/src/server.js` 添加路由
2. 使用 `db.all()` / `db.get()` / `db.run()` 操作数据库
3. 前端对应添加 API 调用

## License

MIT
