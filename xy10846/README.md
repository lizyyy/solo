# 文档切片策略台

知识库问答效果优化管理平台 - 切片长度、标题继承、表格处理统一管理。

## 项目架构

```
doc-slicing-strategy-console/
├── server/
│   ├── index.js              # 服务器入口
│   ├── database/
│   │   ├── connection.js     # 数据库连接
│   │   └── init.js           # 数据库初始化
│   ├── middleware/
│   │   └── requestLogger.js  # 请求日志中间件
│   └── routes/
│       ├── documents.js      # 文档管理接口
│       ├── rules.js          # 切片规则接口
│       ├── previews.js       # 切片预览接口
│       ├── versions.js       # 版本发布回滚接口
│       └── export.js         # 导出和日志接口
├── public/
│   ├── index.html            # 前端控制台
│   └── app.js                # 前端逻辑
├── data/                     # SQLite数据目录
├── package.json
└── README.md
```

## 数据模型

- **documents**: 原始文档（标题、内容、状态、责任节点）
- **slice_rules**: 切片规则（切片长度、标题继承、表格保留、版本、效果备注）
- **heading_hierarchies**: 标题层级结构
- **table_fragments**: 表格片段处理
- **slice_previews**: 切片预览结果
- **published_versions**: 发布版本（含配置快照，支持回滚）
- **request_logs**: 请求日志（记录每次请求的输入、结果、责任节点）

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

## API 接口示例

### 文档管理

#### 创建文档
```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -H "X-Responsibility-Node: knowledge-team" \
  -d '{
    "title": "产品使用手册",
    "content": "# 第一章\n\n## 1.1 功能介绍\n\n这是产品的主要功能...\n\n## 1.2 操作步骤\n\n第一步：点击开始...",
    "file_type": "markdown",
    "responsibility_node": "knowledge-team"
  }'
```

#### 查询文档列表
```bash
curl "http://localhost:3000/api/documents?status=draft&search=产品"
```

#### 更新文档状态
```bash
curl -X PUT http://localhost:3000/api/documents/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "processing"}'
```

### 切片规则管理

#### 创建规则
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -H "X-Responsibility-Node: algorithm-team" \
  -d '{
    "name": "标准切片规则",
    "description": "知识库文档标准切片策略",
    "max_chunk_length": 500,
    "min_chunk_length": 100,
    "overlap_size": 50,
    "heading_hierarchy_level": 3,
    "inherit_headers": 1,
    "preserve_tables": 1,
    "effect_remark": "问答准确率提升15%"
  }'
```

#### 查询规则列表
```bash
curl "http://localhost:3000/api/rules?status=testing"
```

#### 更新规则状态
```bash
curl -X PUT http://localhost:3000/api/rules/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

### 切片预览

#### 生成切片预览
```bash
curl -X POST http://localhost:3000/api/previews/generate \
  -H "Content-Type: application/json" \
  -H "X-Responsibility-Node: qa-team" \
  -d '{
    "document_id": 1,
    "rule_id": 1
  }'
```

#### 查看切片预览
```bash
curl "http://localhost:3000/api/previews?document_id=1&rule_id=1"
```

### 版本发布与回滚

#### 发布新版本
```bash
curl -X POST http://localhost:3000/api/versions/publish \
  -H "Content-Type: application/json" \
  -H "X-Responsibility-Node: release-team" \
  -d '{
    "rule_id": 1,
    "version_tag": "v1.0.0",
    "description": "首个稳定版本",
    "published_by": "admin"
  }'
```

#### 回滚版本
```bash
curl -X POST http://localhost:3000/api/versions/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "version_id": 1
  }'
```

### 导出和日志

#### 导出切片
```bash
curl "http://localhost:3000/api/export/slices/1/1?format=json"
```

#### 查看请求日志
```bash
curl "http://localhost:3000/api/export/logs?status=error&limit=50"
```

## 故意失败的路径示例

### 1. 创建文档缺少必填字段
```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试文档"
    # 缺少 content 字段
  }'
```
预期返回: 400 Bad Request, `{"error": "标题和内容不能为空", "code": "MISSING_REQUIRED_FIELDS"}`

### 2. 查询不存在的文档
```bash
curl http://localhost:3000/api/documents/99999
```
预期返回: 404 Not Found, `{"error": "文档不存在", "code": "DOCUMENT_NOT_FOUND"}`

### 3. 发布重复版本标签
```bash
# 先发布一次
curl -X POST http://localhost:3000/api/versions/publish \
  -H "Content-Type: application/json" \
  -d '{"rule_id": 1, "version_tag": "v1.0.0"}'

# 再用同一标签发布一次（会失败）
curl -X POST http://localhost:3000/api/versions/publish \
  -H "Content-Type: application/json" \
  -d '{"rule_id": 1, "version_tag": "v1.0.0"}'
```
预期返回: 400 Bad Request, `{"error": "版本标签已存在", "code": "VERSION_TAG_EXISTS"}`

### 4. 更新规则使用无效状态
```bash
curl -X PUT http://localhost:3000/api/rules/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid_status"}'
```
预期返回: 400 Bad Request, `{"error": "无效的状态值", "code": "INVALID_STATUS"}`

### 5. 生成预览使用不存在的ID
```bash
curl -X POST http://localhost:3000/api/previews/generate \
  -H "Content-Type: application/json" \
  -d '{"document_id": 99999, "rule_id": 99999}'
```
预期返回: 404 Not Found

## 前端功能

1. **文档管理**: 创建、查看、搜索、状态更新、删除
2. **切片规则**: 规则配置（长度、重叠、标题继承、表格保留）、效果备注、状态流转
3. **切片预览**: 选择文档和规则，实时生成切片，查看切片详情
4. **版本发布**: 发布新版本快照，历史版本回滚
5. **请求日志**: 查看所有API调用记录，包含责任节点、输入输出、耗时

## 状态流转

### 文档状态
- draft (草稿) → processing (处理中) → completed (已完成) → archived (已归档)

### 规则状态
- draft (草稿) → testing (测试中) → approved (已批准) → published (已发布) → deprecated (已废弃)
