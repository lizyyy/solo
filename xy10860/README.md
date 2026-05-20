# 发布审批系统 (Release Approval System)

一个面向技术团队的全栈发布审批管理系统，解决生产发布审批散落在聊天记录中的问题，自动化流水线可通过 API 获取放行状态。

## 技术栈

### 后端
- **FastAPI** - 现代化 Python Web 框架
- **SQLAlchemy** - ORM 数据库操作
- **SQLite** - 本地持久化存储
- **Pydantic** - 数据验证

### 前端
- **React 18** - 用户界面框架
- **TypeScript** - 类型安全
- **Ant Design** - UI 组件库
- **Axios** - HTTP 客户端

## 核心功能

### 数据模型
1. **发布单 (Release Order)** - 包含标题、描述、版本、环境、状态、创建人等
2. **环境 (Environment)** - dev/test/staging/prod 四环境
3. **审批人 (Approval)** - 审批人记录、审批状态、备注
4. **检查项 (Check Item)** - 发布前检查清单，支持待检查/通过/失败/跳过
5. **放行令牌 (Release Token)** - 一次性令牌，支持有效期控制
6. **回滚记录 (Rollback Record)** - 回滚原因、操作人、回滚版本
7. **时间线 (Timeline)** - 完整操作审计日志

### 业务规则
1. **状态机流转** - 草稿 → 待审批 → 已批准 → 部署中 → 已部署 → (已回滚)
2. **检查项汇总** - 所有检查项通过才能进入下一状态
3. **令牌校验** - 只有已批准状态才能签发令牌，令牌使用后立即失效
4. **超时撤回** - 支持发布超时自动撤回机制
5. **回滚留痕** - 所有回滚操作记录完整审计日志

### API 接口
- **创建发布单** - POST /api/release-orders
- **查询发布单** - GET /api/release-orders (支持筛选)
- **状态推进** - POST /api/release-orders/{id}/status
- **审批操作** - POST /api/approvals/{id}/approve/reject
- **令牌管理** - 签发/校验/使用
- **回滚操作** - POST /api/release-orders/{id}/rollback
- **批量导入** - POST /api/release-orders/batch-import
- **导出报表** - GET /api/release-orders/export/excel

## 快速开始

### 后端启动

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务 (端口 8000)
uvicorn app.main:app --reload
```

访问 API 文档: http://localhost:8000/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器 (端口 3000)
npm run dev
```

访问前端: http://localhost:3000

## API 接口示例

### 1. 创建发布单

```bash
curl -X POST http://localhost:8000/api/release-orders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "用户服务 v2.1.0 生产发布",
    "description": "包含用户中心API更新和性能优化",
    "version": "v2.1.0",
    "environment": "prod",
    "created_by": "张三",
    "check_items": [
      {"name": "单元测试通过率", "description": "确保 > 90%"},
      {"name": "压力测试结果", "description": "QPS 达标"}
    ],
    "approvers": ["李四", "王五"]
  }'
```

### 2. 查询发布单列表

```bash
# 全部
curl http://localhost:8000/api/release-orders

# 按环境筛选
curl "http://localhost:8000/api/release-orders?environment=prod"

# 按状态筛选
curl "http://localhost:8000/api/release-orders?status=pending_approval"

# 搜索
curl "http://localhost:8000/api/release-orders?search=v2.1.0"
```

### 3. 获取单个发布单详情

```bash
curl http://localhost:8000/api/release-orders/1
```

### 4. 状态推进 (示例: 草稿 → 待审批)

```bash
curl -X POST http://localhost:8000/api/release-orders/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "pending_approval",
    "operator": "张三",
    "comment": "准备提交审批"
  }'
```

### 5. 通过审批

```bash
curl -X POST "http://localhost:8000/api/approvals/1/approve?operator=李四&comment=同意发布"
```

### 6. 签发放行令牌

```bash
curl -X POST http://localhost:8000/api/release-orders/1/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "issued_by": "王五",
    "expires_hours": 2
  }'
```

**响应示例:**
```json
{
  "id": 1,
  "release_order_id": 1,
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "issued_by": "王五",
  "issued_at": "2024-01-15T10:30:00",
  "expires_at": "2024-01-15T12:30:00",
  "used": false,
  "is_valid": true
}
```

### 7. 流水线验证令牌 (CI/CD 集成)

```bash
curl -X POST "http://localhost:8000/api/release-orders/1/tokens/validate?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**响应示例:**
```json
{
  "valid": true,
  "error": null
}
```

### 8. 使用令牌触发发布

```bash
curl -X POST "http://localhost:8000/api/release-orders/1/tokens/use?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890&operator=CI-CD"
```

### 9. 回滚发布

```bash
curl -X POST http://localhost:8000/api/release-orders/1/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "发现性能问题，CPU使用率异常",
    "rolled_back_by": "运维团队",
    "previous_version": "v2.0.9"
  }'
```

### 10. 批量导入

```bash
curl -X POST http://localhost:8000/api/release-orders/batch-import \
  -H "Content-Type: application/json" \
  -d '[
    {
      "title": "订单服务 v1.5.0",
      "version": "v1.5.0",
      "environment": "prod",
      "created_by": "赵六"
    },
    {
      "title": "支付网关 v3.2.1",
      "version": "v3.2.1",
      "environment": "prod",
      "created_by": "钱七"
    }
  ]'
```

### 11. 导出 Excel 报表

```bash
curl -O -J "http://localhost:8000/api/release-orders/export/excel?environment=prod"
```

## 故意失败的路径示例

### 场景 1: 非法状态转换 (从已部署 → 待审批)

```bash
curl -X POST http://localhost:8000/api/release-orders/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "pending_approval",
    "operator": "测试用户"
  }'
```

**预期错误响应:**
```json
{
  "detail": "无法从 deployed 转换到 pending_approval"
}
```

### 场景 2: 使用已过期令牌

```bash
# 假设令牌已过期
curl -X POST "http://localhost:8000/api/release-orders/1/tokens/validate?token=过期令牌"
```

**预期错误响应:**
```json
{
  "valid": false,
  "error": "令牌已过期"
}
```

### 场景 3: 在非批准状态签发令牌

```bash
curl -X POST http://localhost:8000/api/release-orders/1/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "issued_by": "测试",
    "expires_hours": 2
  }'
```

**预期错误响应:**
```json
{
  "detail": "只有已批准的发布单才能创建令牌"
}
```

### 场景 4: 回滚未部署的发布单

```bash
curl -X POST http://localhost:8000/api/release-orders/1/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "测试回滚",
    "rolled_back_by": "测试"
  }'
```

**预期错误响应:**
```json
{
  "detail": "只能回滚已部署或正在部署的发布单"
}
```

## 状态流转图

```
草稿 (draft)
   ↓
待审批 (pending_approval) ←→ 可回退到草稿
   ↓
已批准 (approved)
   ↓
部署中 (deploying)
   ↓
已部署 (deployed)
   ↓
已回滚 (rolled_back)  (终态)

超时 (timeout) ← 可从已批准超时
   ↓
可回退到草稿
```

## CI/CD 集成建议

在流水线中添加审批检查步骤：

```yaml
# GitHub Actions 示例
steps:
  - name: 检查发布审批状态
    run: |
      RESPONSE=$(curl -s "http://approval-api/api/release-orders/${RELEASE_ID}")
      STATUS=$(echo $RESPONSE | jq -r '.status')
      
      if [ "$STATUS" != "approved" ]; then
        echo "❌ 发布单未批准，当前状态: $STATUS"
        exit 1
      fi
      
      echo "✅ 发布单已批准"

  - name: 验证放行令牌
    run: |
      RESPONSE=$(curl -s -X POST "http://approval-api/api/release-orders/${RELEASE_ID}/tokens/validate?token=${RELEASE_TOKEN}")
      VALID=$(echo $RESPONSE | jq -r '.valid')
      
      if [ "$VALID" != "true" ]; then
        echo "❌ 令牌无效"
        exit 1
      fi
      
      echo "✅ 令牌验证通过"

  - name: 执行发布
    run: ./deploy.sh

  - name: 标记令牌已使用
    run: |
      curl -X POST "http://approval-api/api/release-orders/${RELEASE_ID}/tokens/use?token=${RELEASE_TOKEN}&operator=GitHub-Actions"
```

## 项目结构

```
release-approval-system/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI 应用入口
│   │   ├── models.py        # SQLAlchemy 数据模型
│   │   ├── schemas.py       # Pydantic 序列化模式
│   │   ├── services.py      # 业务逻辑
│   │   └── database.py      # 数据库配置
│   ├── requirements.txt
│   └── release_approval.db  # SQLite 数据库 (自动创建)
└── frontend/
    ├── src/
    │   ├── types.ts         # TypeScript 类型定义
    │   ├── api.ts           # API 客户端
    │   ├── App.tsx          # 主应用
    │   ├── main.tsx         # 入口文件
    │   └── pages/           # 页面组件
    │       ├── ReleaseOrderList.tsx
    │       ├── ReleaseOrderDetail.tsx
    │       ├── CreateReleaseOrder.tsx
    │       └── BatchImport.tsx
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

## 安全建议

1. **生产环境** - 替换 SQLite 为 PostgreSQL/MySQL
2. **认证** - 添加 JWT/OAuth2 认证中间件
3. **HTTPS** - 启用 TLS 加密
4. **权限** - 实现基于角色的访问控制 (RBAC)
5. **审计** - 保留所有操作日志 (已内置 Timeline 功能)
