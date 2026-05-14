# OpenAPI 差异审查器

一个本地可运行的 API 审查项目，用于检测 OpenAPI 规范的破坏性变更，支持审批流程和报告生成。

## 功能特性

- 📋 OpenAPI 规范版本管理
- 🔍 自动检测破坏性变更
- ✅ 审批流程与时间线
- 📊 统计卡片与详情展示
- 📄 兼容报告生成
- 📝 审批意见复盘

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python init_db.py
```

### 3. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:8080` 启动。

### 4. 访问页面

- 首页: http://localhost:8080/
- 审查详情页: http://localhost:8080/review/1
- API 统计: http://localhost:8080/api/stats

## 常用接口

### 上传旧版规范

```bash
POST /api/specs
Content-Type: application/json

{
  "version": "1.0.0",
  "spec": { ... }  // OpenAPI 规范 JSON
}
```

### 上传新版规范并检测差异

```bash
POST /api/reviews
Content-Type: application/json

{
  "old_spec_id": 1,
  "new_version": "2.0.0",
  "new_spec": { ... }  // 新版 OpenAPI 规范
}
```

### 获取审查详情

```bash
GET /api/reviews/{review_id}
```

### 提交审批意见

```bash
POST /api/reviews/{review_id}/approve
Content-Type: application/json

{
  "approved": true,
  "reason": "变更经过充分评估，无兼容性风险",
  "approver": "张三"
}
```

### 生成兼容报告

```bash
GET /api/reviews/{review_id}/report
```

## 会被规则挡住的操作示例

### 场景：删除必填字段

当你尝试删除一个 API 路径中的必填请求参数时，系统会自动检测到这是一个**破坏性变更**，并阻止默认通过，需要人工审批介入。

**示例请求：**

```bash
POST /api/reviews
Content-Type: application/json

{
  "old_spec_id": 1,
  "new_version": "2.0.0",
  "new_spec": {
    "openapi": "3.0.0",
    "paths": {
      "/users": {
        "get": {
          "parameters": [
            // 旧版有 'page' 和 'limit' 两个必填参数
            // 新版删除了 'page' 参数 → 破坏性变更
            { "name": "limit", "required": true, ... }
          ]
        }
      }
    }
  }
}
```

**系统响应：**
- 自动标记为 `BLOCKED` 状态
- 显示破坏性变更详情
- 需要审批人手动确认是否继续

## 影响接口失败后的修正路径

### 典型流程

1. **检测失败**：系统检测到破坏性变更，审查状态标记为 `BLOCKED`
2. **审批介入**：审批人查看变更详情，给出否决意见
3. **修改方案**：开发者根据审批意见修改规范
4. **重新提交**：上传修正后的规范
5. **复盘记录**：所有审批理由和修改历史保留在时间线中，可追溯

### 审批意见复盘

每条审批记录包含：
- 审批人信息
- 审批时间
- 审批结果（通过/驳回）
- 详细理由
- 关联的变更项

## 破坏性变更检测规则

### 请求相关
- 删除路径
- 删除操作（GET/POST/PUT/DELETE）
- 删除必填参数
- 参数从可选变为必填
- 修改参数类型

### 响应相关
- 删除响应字段
- 字段从可选变为必填
- 修改字段类型
- 添加必填响应字段

### 安全相关
- 新增安全要求
- 修改安全作用域

## 项目结构

```
.
├── app.py                 # Flask 应用入口
├── init_db.py             # 数据库初始化脚本
├── models.py              # 数据模型
├── diff_detector.py       # OpenAPI 差异检测核心逻辑
├── requirements.txt       # 依赖清单
├── static/
│   ├── css/
│   └── js/
├── templates/
│   ├── index.html         # 列表页
│   ├── detail.html        # 详情页
│   └── stats.html         # 统计页
└── README.md
```
