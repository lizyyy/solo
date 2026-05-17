# 知识库服务文章发布回滚 API

## 项目概述

知识库服务文章发布回滚API，支持按日期、状态、负责人或业务对象筛选回滚记录，保持导出口径一致。

## 核心功能

### 数据模型
- **文章 (Article)**: 包含标题、内容、状态、业务对象、版本号等
- **版本 (ArticleVersion)**: 保存文章的历史版本记录
- **回滚记录 (RollbackRecord)**: 记录每次回滚操作的详细信息

### 状态定义

**文章状态**
- `draft` - 草稿
- `published` - 已发布
- `rolling_back` - 回滚中
- `restored` - 已恢复

**回滚状态**
- `success` - 成功
- `conflict` - 冲突
- `rejected` - 驳回
- `completed` - 已完成
- `failed` - 失败

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动

### 运行测试
```bash
npm test
```

## API 文档

### 文章管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/articles` | 创建文章 |
| GET | `/api/articles/:id` | 获取文章详情 |
| PUT | `/api/articles/:id` | 更新文章 |
| POST | `/api/articles/:id/publish` | 发布文章 |
| GET | `/api/articles/:id/versions` | 获取文章版本历史 |

### 回滚管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/rollbacks` | 查询回滚记录列表 |
| GET | `/api/rollbacks/:id` | 获取回滚记录详情 |
| GET | `/api/articles/:articleId/rollbacks` | 获取文章回滚历史 |
| POST | `/api/rollbacks` | 请求回滚 |
| PUT | `/api/rollbacks/:id/status` | 更新回滚状态 |
| GET | `/api/rollbacks/export/csv` | 导出回滚记录CSV |

### 筛选参数

查询回滚记录列表时支持以下筛选参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| `startDate` | ISO日期 | 开始日期 |
| `endDate` | ISO日期 | 结束日期 |
| `status` | string | 回滚状态 |
| `requestedBy` | string | 申请人 |
| `businessObject` | string | 业务对象 |
| `articleId` | string | 文章ID |
| `page` | number | 页码 (默认1) |
| `pageSize` | number | 每页大小 (默认10) |

## 使用示例

### 1. 创建文章
```bash
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试文档",
    "content": "这是测试内容",
    "businessObject": "测试文档",
    "createdBy": "测试用户"
  }'
```

### 2. 查询回滚记录列表
```bash
# 查询所有记录
curl http://localhost:3000/api/rollbacks

# 按状态筛选
curl "http://localhost:3000/api/rollbacks?status=conflict"

# 按业务对象筛选
curl "http://localhost:3000/api/rollbacks?businessObject=技术文档"

# 按日期范围筛选
curl "http://localhost:3000/api/rollbacks?startDate=2024-01-01&endDate=2024-12-31"

# 分页查询
curl "http://localhost:3000/api/rollbacks?page=1&pageSize=10"
```

### 3. 导出回滚记录
```bash
curl -o rollbacks.csv "http://localhost:3000/api/rollbacks/export/csv?status=completed"
```

## 样例数据

系统启动时自动初始化以下样例数据：

1. **产品使用手册** - 完整流转记录（已发布 -> 回滚 -> 已恢复）
2. **API接口文档** - 冲突记录
3. **用户指南** - 驳回记录
4. **导入坏行测试记录** - 数据导入异常记录

## 边界处理

- 回滚后搜索索引仍命中新版本
- 接口不静默覆盖原记录，版本号始终递增
- 只有已发布的文章才能回滚
- 只能回滚到历史版本（版本号 < 当前版本）

## 项目结构

```
.
├── src/
│   ├── types/           # 类型定义
│   ├── store/           # 数据存储
│   ├── services/        # 业务逻辑
│   ├── controllers/     # API控制器
│   ├── data/            # 样例数据
│   ├── tests/           # 测试用例
│   └── index.ts         # 入口文件
├── package.json
├── tsconfig.json
└── jest.config.js
```
