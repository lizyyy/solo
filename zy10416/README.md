# 浏览器兼容豁免 API

用于管理前端浏览器兼容豁免申请的REST API服务。

## 功能特性

- 豁免申请创建、查询、状态流转
- 浏览器矩阵校验
- 豁免到期自动检查
- 失败用例归档
- 安全敏感路径拦截
- 人工修正
- 异常记录
- 数据导出
- 本地SQLite持久化

## 快速开始

### 1. 安装依赖

```bash
go mod download
```

### 2. 启动服务

```bash
go run main.go
```

或指定参数：

```bash
go run main.go -port 8080 -db ./exemptions.db -init-sample true
```

服务启动后会自动初始化样例数据。

### 3. 验证服务

```bash
curl http://localhost:8080/health
```

预期输出：
```json
{"service":"browser-compat-exemption-api","status":"ok"}
```

## API 接口

### 1. 创建豁免申请

```bash
curl -X POST http://localhost:8080/api/exemptions \
  -H "Content-Type: application/json" \
  -d '{
    "page_path": "/product/detail",
    "browser_matrix": {
      "browser": "IE",
      "version": "11",
      "os": "Windows 7"
    },
    "failed_cases": [
      {
        "test_case": "TC-COMPAT-001",
        "description": "CSS Grid布局不支持"
      }
    ],
    "applicant": "张三",
    "applicant_email": "zhangsan@example.com",
    "reason": "IE11用户占比仅0.5%，暂不兼容",
    "duration_days": 30
  }'
```

### 2. 查询豁免列表

```bash
# 查询所有
curl http://localhost:8080/api/exemptions

# 按浏览器筛选
curl "http://localhost:8080/api/exemptions?browser=IE"

# 按状态筛选
curl "http://localhost:8080/api/exemptions?status=pending"

# 按页面路径筛选
curl "http://localhost:8080/api/exemptions?page_path=/home"

# 分页查询
curl "http://localhost:8080/api/exemptions?page=1&page_size=10"
```

### 3. 获取单个豁免详情

```bash
# 注意替换 {id} 为实际豁免ID
curl http://localhost:8080/api/exemptions/1
```

### 4. 更新豁免状态

```bash
# 提交审核
curl -X PUT http://localhost:8080/api/exemptions/2/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "reviewing",
    "reviewer": "李四"
  }'

# 审核通过
curl -X PUT http://localhost:8080/api/exemptions/2/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "reviewer": "李四",
    "review_comment": "同意豁免，请在下季度前完成兼容改造"
  }'

# 审核拒绝
curl -X PUT http://localhost:8080/api/exemptions/2/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "reviewer": "李四",
    "review_comment": "该页面必须支持IE11"
  }'
```

状态流转规则：
- `pending` → `reviewing` / `approved` / `rejected`
- `reviewing` → `approved` / `rejected`
- `approved` → `expired` (自动)

### 5. 人工修正豁免

```bash
curl -X PUT http://localhost:8080/api/exemptions/1/correct \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "延长豁免期限",
    "duration_days": 60
  }'
```

### 6. 记录异常

```bash
curl -X POST http://localhost:8080/api/exemptions/1/exception \
  -H "Content-Type: application/json" \
  -d '{
    "exception_note": "人工处理异常，特殊情况豁免"
  }'
```

### 7. 导出所有豁免

```bash
curl http://localhost:8080/api/export
```

### 8. 被规则拦住的路径示例（安全敏感路径）

**以下路径会被拒绝创建豁免：**

```bash
# /login 开头的路径
curl -X POST http://localhost:8080/api/exemptions \
  -H "Content-Type: application/json" \
  -d '{
    "page_path": "/login",
    "browser_matrix": {
      "browser": "Chrome",
      "version": "80",
      "os": "Windows 10"
    },
    "applicant": "张三",
    "applicant_email": "zhangsan@example.com",
    "reason": "测试",
    "duration_days": 30
  }'

# /payment 开头的路径
curl -X POST http://localhost:8080/api/exemptions \
  -H "Content-Type: application/json" \
  -d '{
    "page_path": "/payment/checkout",
    "browser_matrix": {
      "browser": "Chrome",
      "version": "80",
      "os": "Windows 10"
    },
    "applicant": "张三",
    "applicant_email": "zhangsan@example.com",
    "reason": "测试",
    "duration_days": 30
  }'

# /admin 开头的路径
curl -X POST http://localhost:8080/api/exemptions \
  -H "Content-Type: application/json" \
  -d '{
    "page_path": "/admin/dashboard",
    "browser_matrix": {
      "browser": "Chrome",
      "version": "80",
      "os": "Windows 10"
    },
    "applicant": "张三",
    "applicant_email": "zhangsan@example.com",
    "reason": "测试",
    "duration_days": 30
  }'
```

预期输出（被拦截）：
```json
{
  "blocked": true,
  "reason": "页面路径 /login 属于安全敏感路径，不允许豁免"
}
```

## 数据模型

### BrowserMatrix（浏览器矩阵）

| 字段 | 类型 | 说明 |
|------|------|------|
| browser | string | 浏览器名称（Chrome/Firefox/Safari/Edge/IE/Opera） |
| version | string | 浏览器版本 |
| os | string | 操作系统 |

### Exemption（豁免申请）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint | 主键ID |
| page_path | string | 页面路径（唯一索引） |
| browser_matrix | BrowserMatrix | 浏览器矩阵（唯一索引） |
| failed_cases | []FailedCase | 失败用例列表 |
| applicant | string | 申请人 |
| applicant_email | string | 申请人邮箱 |
| reason | string | 豁免理由 |
| duration_days | int | 豁免天数（1-365） |
| expire_at | datetime | 到期时间 |
| status | string | 状态（pending/reviewing/approved/rejected/expired） |
| reviewer | string | 审核人 |
| review_comment | string | 审核意见 |
| reviewed_at | datetime | 审核时间 |
| compatibility_conclusion | string | 兼容结论（pass/fail/exempted） |
| raw_input | string | 原始请求输入（用于异常追溯） |
| exception_note | string | 异常记录 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### FailedCase（失败用例）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint | 主键ID |
| exemption_id | uint | 关联豁免ID |
| test_case | string | 测试用例编号 |
| description | string | 失败描述 |
| screenshot | string | 截图URL（可选） |
| created_at | datetime | 创建时间 |

## 核心规则

1. **浏览器矩阵校验**：仅支持 Chrome/Firefox/Safari/Edge/IE/Opera
2. **路径拦截**：/login、/payment、/admin 开头的安全敏感路径不允许豁免
3. **重复检查**：同一页面路径+浏览器矩阵组合只能有一个豁免
4. **状态流转**：严格的状态机控制
5. **到期检查**：已批准的豁免到期后自动标记为 expired
6. **异常保留**：异常路径会保留原始输入和处理结论

## 项目结构

```
.
├── main.go              # 程序入口
├── go.mod              # Go模块定义
├── models/
│   └── models.go       # 数据模型和请求/响应结构
├── storage/
│   └── sqlite.go       # SQLite存储层
├── service/
│   └── service.go      # 业务逻辑和核心规则
├── handler/
│   └── handler.go      # HTTP处理器
└── README.md
```

## 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| -port | 8080 | HTTP服务端口 |
| -db | ./exemptions.db | SQLite数据库文件路径 |
| -init-sample | true | 是否初始化样例数据 |
