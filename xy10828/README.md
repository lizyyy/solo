# CRM 线索去重接口

一个解决销售线索重复问题的全栈Web/API应用。支持多渠道线索导入、智能去重匹配、人工复核、合并决策和数据导出。

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── server.js        # 服务入口
│   │   ├── database.js      # 数据库层
│   │   ├── routes/
│   │   │   └── leads.js     # 线索API路由
│   │   ├── services/
│   │   │   └── dedupeService.js  # 去重核心逻辑
│   │   └── scripts/
│   │       ├── seed.js      # 初始化数据
│   │       └── test-samples.js   # 测试样例脚本
│   └── package.json
└── frontend/                # 前端管理界面
    └── index.html
```

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: 原生 HTML/CSS/JavaScript (无需构建)
- **核心功能**:
  - 基于手机号/邮箱的相似度匹配
  - 幂等性请求处理
  - 字段冲突自动检测和人工选择
  - 合并审批流程
  - 完整操作日志记录
  - CSV数据导出

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后：
- 后端API地址: http://localhost:3001
- 前端管理界面: http://localhost:3001
- 健康检查: http://localhost:3001/api/health

### 3. 初始化样例数据（可选）

在新终端窗口执行：

```bash
cd backend
npm run seed
```

这将创建5条示例线索数据。

### 4. 运行测试样例

在新终端窗口执行：

```bash
cd backend
npm run test-samples
```

这将自动测试以下场景：
- ✅ 成功导入新线索（无重复）
- ✅ 发现重复线索，进入待复核状态
- ✅ 重复提交幂等性验证
- ✅ 参数校验失败（缺少手机号/邮箱）
- ✅ 获取线索详情和处理日志
- ✅ 获取统计数据

## API 接口文档

### 创建线索

```
POST /api/leads
Content-Type: application/json
x-request-id: 可选，用于幂等性控制

{
  "name": "张三",
  "phone": "13800138001",
  "email": "zhangsan@example.com",
  "company": "科技公司",
  "source": "crm",       // crm | website | event
  "source_id": "crm_001"
}
```

响应示例（无重复）：
```json
{
  "success": true,
  "requestId": "xxx",
  "isDuplicateRequest": false,
  "lead": { ... },
  "hasDuplicates": false,
  "status": "accepted"
}
```

响应示例（发现重复）：
```json
{
  "success": true,
  "requestId": "xxx",
  "isDuplicateRequest": false,
  "lead": { ... },
  "hasDuplicates": true,
  "duplicateCount": 1,
  "status": "needs_review"
}
```

### 查询线索列表

```
GET /api/leads?status=needs_review&source=crm&page=1&limit=20
```

### 获取统计数据

```
GET /api/leads/stats
```

### 获取线索详情

```
GET /api/leads/{leadId}
```

返回数据包含：
- 线索基本信息
- 重复候选列表及相似度
- 合并建议及字段冲突
- 完整处理日志

### 批准合并

```
POST /api/leads/{leadId}/approve-merge
Content-Type: application/json

{
  "suggestionId": "合并建议ID",
  "resolvedFields": [
    { "field": "name", "value": "选定值" }
  ],
  "operator": "admin"
}
```

### 确认非重复

```
POST /api/leads/{leadId}/reject-duplicate
Content-Type: application/json

{
  "operator": "admin"
}
```

### 导出线索CSV

```
GET /api/leads/export/csv?status=accepted
```

### 导出处理日志

```
GET /api/leads/export/logs
```

## 核心规则

### 1. 相似匹配规则

系统根据以下维度计算相似度（分数）：
- **手机号完全匹配**: +50分
- **邮箱完全匹配**: +40分
- **姓名完全匹配**: +20分
- **公司完全匹配**: +15分

匹配分数 >= 30分时，判定为重复线索。

### 2. 冲突字段选择

当发现重复时，系统会自动检测字段冲突：
- 冲突字段包括：姓名、手机号、邮箱、公司、来源
- 系统建议保留较新线索的字段值
- 人工复核时可选择保留任意一方的值

### 3. 合并审批流程

```
新线索导入
    ↓
自动去重检测
    ├─ 无重复 → 自动通过 (status: accepted)
    └─ 发现重复 → 待人工复核 (status: needs_review)
        ├─ 确认非重复 → 通过 (status: accepted)
        └─ 批准合并 → 保留主线索，合并线索标记为merged
```

### 4. 重复导入幂等性

通过 `x-request-id` 请求头实现幂等性：
- 相同 request-id 的重复请求返回首次处理结果
- 避免网络重试导致的数据重复

### 5. 处理日志

所有关键操作都会记录日志，包括：
- 导入时间和来源
- 去重检测结果
- 人工复核操作
- 合并操作详情
- 操作人信息

## 前端功能

### 总览页面

访问 http://localhost:3001 查看：

1. **统计卡片**：显示线索总数、待复核数量、已通过数量、已合并数量
2. **筛选功能**：按状态和来源筛选线索
3. **线索列表**：显示所有线索，支持分页
4. **状态标签**：清晰展示每条线索的处理状态

### 详情页面

点击"查看详情"进入单条记录页面：

1. **基本信息**：展示线索的完整信息
2. **重复候选**：列出相似线索，显示匹配原因和相似度
3. **合并建议**：展示字段冲突，提供下拉选择保留值
4. **复核操作**：
   - 批准合并：保留选定值，合并重复线索
   - 确认非重复：标记为正常线索
5. **处理日志**：完整展示线索的所有操作历史

## 使用场景示例

### 场景1：正常导入（成功）

```bash
curl -X POST http://localhost:3001/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "李四",
    "phone": "13900139999",
    "email": "lisi@newcompany.com",
    "company": "新创科技",
    "source": "website"
  }'
```

结果：系统未发现重复，自动通过，status = accepted

### 场景2：发现重复（待复核）

导入一条与已有线索手机号相同的新线索：

```bash
curl -X POST http://localhost:3001/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三新",
    "phone": "13800138001",
    "email": "zhangsan_new@example.com",
    "company": "新科技公司",
    "source": "event"
  }'
```

结果：系统检测到重复，status = needs_review，需要人工复核

### 场景3：人工修正（前端操作）

1. 打开前端，在列表中找到"需复核"状态的线索
2. 点击"查看详情"
3. 在"重复候选"区查看相似线索
4. 在"合并建议"区选择每个冲突字段的保留值
5. 点击"批准合并"或"确认非重复"

### 场景4：重复提交（幂等性）

使用相同的 request-id 提交两次：

```bash
curl -X POST http://localhost:3001/api/leads \
  -H "Content-Type: application/json" \
  -H "x-request-id: my-unique-id-001" \
  -d '{
    "name": "王五",
    "phone": "13700007777",
    "email": "wangwu@test.com",
    "source": "crm"
  }'
```

第二次相同请求会返回 `isDuplicateRequest: true`，不创建重复数据

## 数据导出

### 导出线索列表

点击导航栏"导出CSV"或直接访问：
```
http://localhost:3001/api/leads/export/csv?status=needs_review
```

### 导出处理日志

点击导航栏"导出日志"或直接访问：
```
http://localhost:3001/api/leads/export/logs
```

## 数据库结构

数据库文件位置: `backend/data/database.db`

### leads 表 - 线索主表
- id: UUID主键
- request_id: 请求ID（用于幂等性，唯一）
- name, phone, email, company: 基本信息
- source: 来源 (crm/website/event)
- source_id: 来源系统ID
- status: 状态 (pending, processing, needs_review, accepted, merged)
- created_at, updated_at: 时间戳

### duplicate_candidates 表 - 重复候选
- id: UUID主键
- lead_id: 线索ID
- duplicate_lead_id: 重复线索ID
- similarity_score: 相似度分数
- match_reason: 匹配原因
- status: 状态

### merge_suggestions 表 - 合并建议
- id: UUID主键
- lead_id, candidate_id: 关联ID
- keep_lead_id: 建议保留的线索ID
- merge_lead_id: 建议合并的线索ID
- field_conflicts: 冲突字段JSON
- resolved_fields: 已解决字段JSON
- status: 状态

### processing_logs 表 - 处理日志
- id: UUID主键
- lead_id: 线索ID
- action: 操作类型
- status: 状态
- details: 详情
- operator: 操作人
- created_at: 创建时间

## 故障排除

### 端口被占用
修改 `backend/src/server.js` 中的 `PORT` 变量

### 数据库文件损坏
删除 `backend/data/database.db`，重启服务会自动重建

### 前端无法连接API
确认后端服务已启动，检查API_BASE配置是否正确

## 开发说明

### 目录说明
- `backend/src/routes/`: API路由定义
- `backend/src/services/`: 核心业务逻辑
- `backend/src/scripts/`: 工具脚本
- `frontend/`: 纯静态页面，无需构建

### 扩展匹配规则
编辑 `backend/src/services/dedupeService.js` 中的 `calculateSimilarity` 函数

### 新增来源类型
在前端 `sourceLabels` 和后端相应位置添加

## 许可证

MIT
