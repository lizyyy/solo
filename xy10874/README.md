# 插件市场审核 API 系统

一个面向平台团队的插件上架审核系统，核心规则全部在后端实现，确保审核口径统一。

## 技术栈

- **后端**: Node.js + Express + SQLite3
- **前端**: React + React Router + Ant Design + Vite
- **核心库**: uuid, json2csv, axios, dayjs

## 功能特性

### 数据模型
- **插件包**: 基础信息、版本、平台兼容、状态
- **权限声明**: 权限名称、级别、风险等级
- **截图材料**: 图片URL、有效性校验
- **兼容版本**: 平台版本、测试结果
- **审核意见**: 审核状态、原因、建议
- **上架记录**: 上架时间、回滚状态、操作人

### 核心规则
- **材料校验**: 截图数量、图片有效性
- **权限风险**: 高危权限需要人工审核
- **审核状态机**: DRAFT → SUBMITTED → AUTO_AUDITING → PENDING_REVIEW/AUTO_PASSED → APPROVED → RELEASED → ROLLED_BACK
- **版本兼容**: 语义化版本校验、稳定版本适配
- **上架回滚**: 操作留痕、原因记录

### 控制台功能
- **总览 Dashboard**: 统计数据、各状态分布、最近插件
- **插件列表**: 筛选、分页、导出CSV
- **插件详情**: 
  - 基本信息
  - 权限声明管理
  - 截图材料管理
  - 审核记录时间线
  - 上架记录
- **手动补偿入口**: 审核通过、拒绝、上架、回滚

## 本地运行

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 2. 启动服务

```bash
# 方式1: 同时启动前后端（推荐）
npm run dev

# 方式2: 单独启动后端
npm run server

# 方式3: 单独启动前端
cd frontend && npm run dev
```

### 3. 访问地址
- **前端控制台**: http://localhost:3000
- **后端API**: http://localhost:3001
- **健康检查**: http://localhost:3001/api/health

## API 接口示例

### 1. 创建插件

```bash
curl -X POST http://localhost:3001/api/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "代码格式化插件",
    "version": "1.0.0",
    "author": "张三",
    "description": "自动格式化代码，支持多种语言",
    "min_platform_version": "3.0.0",
    "max_platform_version": "3.2.0"
  }'
```

**响应**:
```json
{
  "id": "uuid-of-plugin",
  "message": "插件创建成功"
}
```

### 2. 获取插件列表

```bash
curl http://localhost:3001/api/plugins?status=DRAFT&page=1&limit=20
```

### 3. 获取插件详情

```bash
curl http://localhost:3001/api/plugins/{plugin-id}
```

### 4. 添加权限声明

```bash
curl -X POST http://localhost:3001/api/plugins/{plugin-id}/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "permission_name": "file.write",
    "permission_level": "write",
    "description": "写入用户文件系统",
    "risk_level": "HIGH"
  }'
```

### 5. 添加截图材料

```bash
curl -X POST http://localhost:3001/api/plugins/{plugin-id}/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/screenshot1.png",
    "description": "主界面截图",
    "is_valid": 1
  }'
```

### 6. 验证规则

```bash
curl -X POST http://localhost:3001/api/plugins/{plugin-id}/validate
```

**响应示例**:
```json
{
  "valid": false,
  "requiresManualReview": true,
  "errors": [
    { "rule": "min_screenshots", "message": "至少需要2张截图" }
  ],
  "warnings": [
    { "rule": "high_risk_permissions", "message": "包含1个高危权限，需要人工审核" }
  ],
  "details": { ... }
}
```

### 7. 提交审核

```bash
curl -X POST http://localhost:3001/api/plugins/{plugin-id}/submit \
  -H "Content-Type: application/json" \
  -d '{ "auditor": "admin" }'
```

### 8. 审核通过

```bash
curl -X POST http://localhost:3001/api/plugins/{plugin-id}/approve \
  -H "Content-Type: application/json" \
  -d '{ "auditor": "admin", "suggestions": "非常棒的插件！" }'
```

### 9. 拒绝审核

```bash
curl -X POST http://localhost:3001/api/plugins/{plugin-id}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "auditor": "admin",
    "reason": "截图不清晰，缺少关键功能演示",
    "suggestions": "请重新上传清晰的截图"
  }'
```

### 10. 上架

```bash
curl -X POST http://localhost:3001/api/plugins/{plugin-id}/release \
  -H "Content-Type: application/json" \
  -d '{ "operator": "admin" }'
```

### 11. 回滚

```bash
curl -X POST http://localhost:3001/api/plugins/{plugin-id}/rollback \
  -H "Content-Type: application/json" \
  -d '{ "operator": "admin", "reason": "发现严重bug" }'
```

### 12. 导出CSV

```bash
curl http://localhost:3001/api/plugins/export/csv -o plugins.csv
```

### 13. Dashboard 统计

```bash
curl http://localhost:3001/api/dashboard/stats
```

## 故意失败的路径示例

以下场景会触发后端规则校验失败：

### 场景1: 截图数量不足

```bash
# 1. 创建插件
# 2. 只添加1张截图（规则要求至少2张）
# 3. 提交审核
# 4. 自动审核会失败，状态变为 REJECTED，原因: "至少需要2张截图"
```

### 场景2: 无效的平台版本

```bash
# 创建插件时使用错误的版本号格式
curl -X POST http://localhost:3001/api/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试插件",
    "version": "1.0",  # 不符合语义化版本（应该是1.0.0）
    "author": "测试",
    "min_platform_version": "abc"  # 无效的版本
  }'
```

### 场景3: 状态转换不合法

```bash
# 尝试直接上架一个 DRAFT 状态的插件（必须先审核通过才能上架）
curl -X POST http://localhost:3001/api/plugins/{draft-plugin-id}/release

# 响应: 400 Bad Request
# { "error": "不允许从 DRAFT 转换到 RELEASED" }
```

### 场景4: 回滚未上架的插件

```bash
# 尝试回滚一个还没有上架的插件
curl -X POST http://localhost:3001/api/plugins/{not-released-plugin-id}/rollback

# 响应: 400 Bad Request
# { "error": "只有已上架的插件才能回滚" }
```

### 场景5: 高危权限触发人工审核

```bash
# 1. 创建插件
# 2. 添加2张有效截图
# 3. 添加一个HIGH风险的权限
# 4. 提交审核
# 5. 自动审核会将状态置为 PENDING_REVIEW，必须手动审核
```

## 审核状态流转图

```
DRAFT → SUBMITTED → AUTO_AUDITING
                              ↓
                ┌───────────────────────┐
                │   验证结果             │
                ├──────────┬────────────┤
                │ 失败     │ 成功+高风险│
                ↓          ↓            ↓
              REJECTED  PENDING_REVIEW  AUTO_PASSED
                  │           │             │
                  └───────────┼─────────────┘
                              ↓
                           APPROVED
                              ↓
                           RELEASED
                              ↓
                         ROLLED_BACK → SUBMITTED
```

## 项目结构

```
.
├── backend/
│   ├── server.js      # 入口文件
│   ├── database.js    # 数据库初始化
│   ├── rules.js       # 核心业务规则
│   └── routes.js      # API路由
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # 主应用
│   │   ├── api.js           # API封装
│   │   ├── index.css        # 样式
│   │   └── pages/
│   │       ├── Dashboard.jsx     # 总览页
│   │       ├── PluginList.jsx    # 列表页
│   │       └── PluginDetail.jsx  # 详情页
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── data/               # SQLite数据库文件（自动生成）
├── package.json
└── README.md
```

## 注意事项

1. **规则全部在后端**: 前端只做展示和操作入口，所有验证逻辑都在后端
2. **状态机保护**: 不允许跨状态操作，确保审核流程规范
3. **操作留痕**: 所有审核和上架操作都会记录操作人、时间、原因
4. **数据持久化**: 使用SQLite数据库，数据存储在 data/audit.db
5. **自动审核**: 提交后会自动执行规则校验，根据结果进入不同状态
