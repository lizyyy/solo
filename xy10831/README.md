# 请求重放脱敏台

一个用于线上请求重放的全栈Web应用，支持敏感数据脱敏、环境隔离、审批流程和响应对比。

## 核心功能

### 1. 字段脱敏 (Masking)
- **手机号脱敏**: 138****5678
- **邮箱脱敏**: t***@example.com
- **完全脱敏**: ***
- **部分脱敏**: 11***34
- **正则替换**: 自定义规则

### 2. 环境隔离 (Environment Isolation)
- 支持多环境配置（开发、测试、预发、生产）
- 生产环境标记和特殊权限控制
- 每个环境独立Headers配置

### 3. 重放审批 (Approval Workflow)
- 敏感环境重放需要审批
- 审批记录完整追踪
- 审批超时自动失效

### 4. 响应对比 (Response Comparison)
- 状态码一致性校验
- 响应文本相似度计算
- 差异高亮显示

### 5. 操作审计 (Audit Log)
- 所有操作完整记录
- 可追溯的用户行为
- 操作时间和详情

## 技术栈

### 后端
- **Flask**: Web框架
- **SQLAlchemy**: ORM数据库
- **SQLite**: 本地数据库
- **requests**: HTTP请求客户端

### 前端
- **原生HTML/CSS/JS**: 无需构建工具
- **响应式设计**: 自适应布局
- **模块化设计**: API和UI分离

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py      # Flask应用初始化
│   │   ├── models.py        # 数据模型
│   │   ├── services.py      # 业务逻辑
│   │   └── routes.py        # API路由
│   ├── tests/
│   │   ├── test_services.py # 服务单元测试
│   │   └── test_api.py      # API集成测试
│   ├── run.py               # 启动入口
│   └── requirements.txt     # Python依赖
└── frontend/
    ├── index.html           # 主页面
    ├── css/
    │   └── style.css        # 样式文件
    └── js/
        ├── api.js           # API封装
        └── app.js           # 前端逻辑
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
python run.py
```

服务将在 http://localhost:5000 启动

### 3. 打开前端

在浏览器中打开:
```
frontend/index.html
```

### 4. 初始化演示数据

在前端控制台点击 **"初始化演示数据"** 按钮，或直接调用API:

```bash
curl -X POST http://localhost:5000/api/init-demo
```

## 自检和测试

### 运行单元测试 (服务逻辑)

```bash
cd backend
python tests/test_services.py
```

测试内容:
- 各种脱敏类型验证
- 嵌套字段脱敏
- 相似度计算

### 运行API集成测试

```bash
# 先启动后端服务
python run.py &

# 运行测试
python tests/test_api.py
```

测试内容:
- 健康检查
- 请求创建/查询
- 规则CRUD
- 环境配置
- 脱敏预览
- 重放执行
- 审计日志

## API接口说明

### 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET/POST | /api/requests | 请求列表/创建 |
| GET | /api/requests/{id} | 请求详情 |
| GET/POST | /api/rules | 脱敏规则列表/创建 |
| PUT/DELETE | /api/rules/{id} | 规则更新/删除 |
| GET/POST | /api/environments | 环境列表/创建 |
| GET/POST | /api/authorizations | 审批列表/申请 |
| POST | /api/authorizations/{id}/approve | 批准 |
| POST | /api/authorizations/{id}/reject | 拒绝 |
| GET/POST | /api/replays | 重放列表/执行 |
| GET | /api/replays/{id} | 重放详情 |
| GET/POST | /api/comparisons | 对比列表/创建 |
| GET | /api/audit | 审计日志 |
| POST | /api/mask/preview | 脱敏预览 |
| POST | /api/init-demo | 初始化演示数据 |

### API调用示例

```bash
# 创建请求
curl -X POST http://localhost:5000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "method": "POST",
    "url": "/api/test",
    "headers": {"Content-Type": "application/json"},
    "body": {"phone": "13812345678", "amount": 100},
    "source": "manual"
  }'

# 脱敏预览
curl -X POST http://localhost:5000/api/mask/preview \
  -H "Content-Type: application/json" \
  -d '{"data": {"phone": "13812345678", "secret_key": "sk-123"}}'

# 执行重放
curl -X POST http://localhost:5000/api/replays \
  -H "Content-Type: application/json" \
  -d '{"request_id": "req_demo_001", "environment_id": 1}'
```

## 前端功能说明

### 仪表盘
- 统计概览（请求数、规则数、环境数、重放数）
- 快速操作入口
- 最近重放记录

### 请求管理
- 请求列表展示
- 按状态、关键词搜索
- 创建新请求
- 查看请求详情

### 脱敏规则
- 规则卡片展示
- 支持多种脱敏类型
- 规则启用/禁用
- 删除规则

### 环境配置
- 环境列表
- 生产环境标记
- 是否需要审批标识

### 审批管理
- 审批申请列表
- 状态追踪（待审批、已批准、已拒绝）
- 批准/拒绝操作

### 重放结果
- 重放历史
- 执行状态追踪
- 脱敏前后对比
- 响应详情查看

### 响应对比
- 基线与目标对比
- 相似度可视化
- 差异详情

### 审计日志
- 完整操作记录
- 按操作类型筛选
- 时间戳和用户信息

## 数据模型

### OriginalRequest (原始请求)
- request_id: 请求唯一标识
- method: HTTP方法
- url: 请求路径
- headers: 请求头(JSON)
- body: 请求体(JSON)
- source: 来源
- status: 状态
- created_by: 创建者
- captured_at: 捕获时间

### MaskingRule (脱敏规则)
- name: 规则名称
- description: 描述
- field_path: 字段路径 (如 user.profile.phone)
- mask_type: 脱敏类型
- mask_pattern: 正则模式(可选)
- is_active: 是否启用

### ReplayEnvironment (重放环境)
- name: 环境名称
- base_url: 基础URL
- description: 描述
- is_production: 是否生产环境
- requires_approval: 是否需要审批
- headers: 环境特定Headers
- is_active: 是否启用

### AuthorizationRecord (授权记录)
- request_id: 关联请求ID
- environment_id: 关联环境ID
- requester: 申请人
- approver: 审批人
- status: 状态(pending/approved/rejected)
- reason: 申请原因
- approval_note: 审批备注
- requested_at: 申请时间
- approved_at: 审批时间
- expires_at: 过期时间

### ReplayResult (重放结果)
- request_id: 请求ID
- environment_id: 环境ID
- authorization_id: 授权ID(可选)
- status: 状态(running/success/failed)
- masked_body: 脱敏后请求体
- response_status: 响应状态码
- response_headers: 响应头
- response_body: 响应体
- response_time_ms: 响应耗时
- error_message: 错误信息
- started_at: 开始时间
- completed_at: 完成时间
- executed_by: 执行人

### ResponseComparison (响应对比)
- baseline_result_id: 基线结果ID
- comparison_result_id: 对比结果ID
- status_code_match: 状态码是否一致
- body_similarity: 响应体相似度(0-1)
- differences: 差异详情(JSON)
- comparison_summary: 对比摘要

### AuditLog (审计日志)
- action: 操作类型
- entity_type: 实体类型
- entity_id: 实体ID
- user: 操作用户
- details: 操作详情(JSON)
- ip_address: IP地址
- created_at: 创建时间

## 安全特性

1. **数据脱敏**: 敏感字段自动脱敏，保护隐私
2. **审批流程**: 生产环境重放需要审批
3. **审计追踪**: 所有操作可追溯
4. **环境隔离**: 不同环境配置独立
5. **授权过期**: 授权有过期时间限制

## 扩展建议

1. **用户认证**: 添加JWT或OAuth认证
2. **权限管理**: 细粒度权限控制
3. **批量重放**: 支持批量请求重放
4. **定时重放**: 支持定时任务
5. **Webhook**: 重放完成回调通知
6. **导出报告**: 支持导出重放报告
7. **压力测试**: 支持并发重放
8. **告警通知**: 异常结果告警

## 常见问题

### Q: 数据存储在哪里？
A: 默认使用SQLite本地数据库，文件名为 `replay_platform.db`。

### Q: 如何切换到MySQL/PostgreSQL？
A: 修改 `app/__init__.py` 中的 SQLALCHEMY_DATABASE_URI 配置即可。

### Q: 脱敏规则支持嵌套字段吗？
A: 支持，使用点号分隔的路径格式，如 `user.profile.phone`。

### Q: 支持自定义脱敏算法吗？
A: 可以在 `services.py` 的 `MaskingEngine.mask_value` 方法中添加新的脱敏类型。

## 许可证

MIT License
