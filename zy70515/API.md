# 审计证据水印API 文档

## 服务启动
```bash
npm start
```
服务地址: http://localhost:3000
API基础路径: http://localhost:3000/api

## 核心数据模型

### 1. 证据包 (Evidence Package)
- id: UUID
- caseId: 案件编号
- evidenceType: 证据类型
- fileName: 文件名
- fileHash: 文件哈希
- status: 状态 (created → watermarked → authorized → downloaded/revoked)
- description: 描述
- metadata: 元数据

### 2. 下载人 (Downloader)
- id: UUID
- employeeId: 员工编号
- name: 姓名
- department: 部门
- email: 邮箱

### 3. 水印 (Watermark)
- id: UUID
- packageId: 证据包ID
- downloaderId: 下载人ID
- watermarkText: 水印文本 (格式: 自定义文本 | AUDIT-<16位哈希>)
- generatedAt: 生成时间

### 4. 授权 (Authorization)
- id: UUID
- packageId: 证据包ID
- downloaderId: 下载人ID
- scope: 权限范围
- grantedAt: 授权时间
- expiresAt: 过期时间
- grantedBy: 授权人
- revoked: 是否已撤销

### 5. 追踪摘要 (Tracking Summary)
- id: UUID
- packageId: 证据包ID
- downloaderId: 下载人ID
- downloadedAt: 下载时间
- ipAddress: IP地址

### 6. 失败记录 (Failure Record)
- id: UUID
- operation: 操作类型
- originalInput: 原始输入
- processingBasis: 处理依据/错误原因
- finalConclusion: 最终结论
- timestamp: 时间戳

## API接口列表

### 健康检查
```bash
GET /health
```

### 证据包管理

#### 创建证据包
```bash
POST /api/packages
Content-Type: application/json

{
  "caseId": "CASE-2024-001",
  "evidenceType": "financial_report",
  "fileName": "audit_report.pdf",
  "fileHash": "abc123def456",
  "description": "年度审计报告",
  "metadata": {}
}
```

#### 查询单个证据包
```bash
GET /api/packages/{id}
```

#### 列出所有证据包
```bash
GET /api/packages?status=created&caseId=CASE-001
```

#### 状态推进
```bash
PATCH /api/packages/{id}/status
Content-Type: application/json

{
  "status": "watermarked",
  "reason": "水印已生成"
}
```

**状态流转规则:**
- created → watermarked
- watermarked → authorized
- authorized → downloaded | revoked
- downloaded → revoked

#### 人工修正
```bash
PATCH /api/packages/{id}/correct
Content-Type: application/json

{
  "corrections": {
    "description": "修订后的描述",
    "caseId": "CASE-2024-001-REV"
  },
  "correctedBy": "admin"
}
```

#### 查看审计日志
```bash
GET /api/packages/{id}/audit-log
```

### 下载人管理

#### 创建或查询下载人
```bash
POST /api/downloaders
Content-Type: application/json

{
  "employeeId": "EMP001",
  "name": "张三",
  "department": "内审部",
  "email": "zhangsan@company.com"
}
```
**幂等性**: 相同employeeId不会重复创建

### 水印管理

#### 创建水印
```bash
POST /api/watermarks
Content-Type: application/json

{
  "packageId": "uuid",
  "downloaderId": "uuid",
  "customText": "机密-仅供内部使用"
}
```
**幂等性**: 同一packageId+downloaderId不会重复创建

#### 查看证据包水印
```bash
GET /api/packages/{id}/watermarks
```

### 授权管理

#### 创建授权
```bash
POST /api/authorizations
Content-Type: application/json

{
  "packageId": "uuid",
  "downloaderId": "uuid",
  "scope": "download",
  "expiresAt": "2024-12-31T23:59:59Z",
  "grantedBy": "admin"
}
```
**幂等性**: 未撤销的相同授权不会重复创建

#### 检查授权
```bash
GET /api/authorizations/check?packageId=xxx&downloaderId=xxx
```

#### 撤销授权
```bash
POST /api/authorizations/{id}/revoke
Content-Type: application/json

{
  "reason": "权限过期",
  "revokedBy": "admin"
}
```

### 下载追踪

#### 记录下载
```bash
POST /api/downloads
Content-Type: application/json

{
  "packageId": "uuid",
  "downloaderId": "uuid",
  "ipAddress": "192.168.1.100"
}
```
**校验**: 需要有效授权才能记录

#### 查看下载记录
```bash
GET /api/packages/{id}/tracking
```

### 异常管理

#### 查看失败记录
```bash
GET /api/failures?operation=create_package
```

### 数据导出

#### 导出追踪数据
```bash
GET /api/export?packageId=xxx
```
导出内容包括: 证据包信息、水印列表、授权历史、下载历史、撤销记录、审计日志

## 使用示例流程

```bash
# 1. 创建证据包
curl -X POST /api/packages -d '{"caseId":"CASE-001",...}'

# 2. 创建下载人
curl -X POST /api/downloaders -d '{"employeeId":"EMP001",...}'

# 3. 生成水印
curl -X POST /api/watermarks -d '{"packageId":"...","downloaderId":"..."}'

# 4. 授予下载授权
curl -X POST /api/authorizations -d '{"packageId":"...","downloaderId":"..."}'

# 5. 记录下载
curl -X POST /api/downloads -d '{"packageId":"...","downloaderId":"...","ipAddress":"..."}'

# 6. 导出完整追踪数据
curl /api/export?packageId=...
```

## 运行测试
```bash
bash test.sh
```
