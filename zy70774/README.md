# 变更日志影响抽取风险分级后端API

从 Release Note 中自动抽取影响客户功能和接口，进行风险分级的工具。

## 核心功能

### 1. Markdown 解析
- 解析标题、列表项
- 自动提取版本号
- 识别 HTTP 接口路径和方法

### 2. 模块标签抽取
- 用户、订单、商品、营销、报表、系统、API、性能、安全、兼容性等模块自动识别

### 3. 接口关联
- 自动识别 GET/POST/PUT/DELETE/PATCH 等 HTTP 接口
- 提取接口路径和上下文

### 4. 风险分级
- **CRITICAL (严重)**: 废弃、移除、删除、不兼容变更
- **HIGH (高)**: 中断、重大变更
- **MEDIUM (中)**: 修改、变更
- **LOW (低)**: 更新、修复、新增、优化

### 5. 客户影响分析
- 根据风险等级自动评估客户影响范围
- 建议行动建议

### 6. 人工复核机制
- 高风险变更自动标记需要人工复核
- 支持审核通过流程

## 错误响应码

| 错误码 | 说明 |
|--------|------|
| missing_field | 缺少必填字段 |
| invalid_status | 状态不允许操作 |
| needs_review | 需要人工复核 |
| already_processed | 已经处理过 |
| not_found | 资源不存在 |
| validation_error | 验证错误 |

## API 接口

### 基础路径:
- `POST /api/v1/changelogs` - 导入变更日志
- `POST /api/v1/changelogs/{id}/process` - 处理变更日志
- `GET /api/v1/changelogs` - 筛选查询列表
- `GET /api/v1/changelogs/{id}` - 获取单个详情
- `PUT /api/v1/changelogs/{id}` - 更新变更日志
- `POST /api/v1/changelogs/{id}/approve` - 人工审核通过
- `GET /api/v1/export` - 导出变更日志清单
- `GET /api/v1/stats` - 获取统计信息
- `GET /health` - 健康检查

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行服务

```bash
python main.py
```

服务启动后访问: http://localhost:8000

API 文档: http://localhost:8000/docs

### 3. 运行自检脚本

```bash
python test_self_check.py
```

## 使用示例

### 导入变更日志

```bash
curl -X POST "http://localhost:8000/api/v1/changelogs" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "v2.0.0 重大更新",
    "content": "# v2.0.0 更新内容..."
  }'
```

### 处理变更日志

```bash
curl -X POST "http://localhost:8000/api/v1/changelogs/1/process"
```

### 筛选查询

```bash
# 查询高风险变更
curl "http://localhost:8000/api/v1/changelogs?risk_level=critical"

# 查询需要人工复核的
curl "http://localhost:8000/api/v1/changelogs?needs_human_review=true"
```

### 导出清单

```bash
curl "http://localhost:8000/api/v1/export?risk_level=critical"
```

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── database.py          # 数据库模型和配置
├── processor.py          # 核心业务逻辑处理
├── test_self_check.py    # 自检脚本
├── requirements.txt      # 依赖列表
└── changelog_impact.db  # SQLite 数据库文件（运行时生成）
```

## 数据模型

### ChangeLog (变更日志)
- id, title, content, version, release_date
- status (pending/processing/processed/needs_review/error)
- risk_level (low/medium/high/critical)
- needs_human_review, review_notes

### ModuleTag (模块标签)
- tag_name, confidence, source

### Interface (接口)
- interface_name, method, path, description

### CustomerImpact (客户影响)
- customer_segment, impact_description, affected_features
- action_required, action_description

### RiskWordMatch (风险词匹配)
- word, risk_level, context, position

## 自检脚本验证项

1. ✅ 数据库初始化
2. ✅ Markdown 解析（标题、列表、接口、版本）
3. ✅ 标签抽取（模块识别）
4. ✅ 风险分析（分级、人工复核判定）
5. ✅ 变更日志导入
6. ✅ 变更日志处理（接口关联、标签、风险词、客户影响）
7. ✅ 多日志差异化处理
8. ✅ 筛选查询功能
9. ✅ 导出服务
10. ✅ 错误场景处理（重复处理、不存在日志）
