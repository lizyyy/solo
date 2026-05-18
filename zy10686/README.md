# 企业培训平台课程证书撤销系统

## 功能概述

企业培训平台证书撤销管理系统，支持正常流程、驳回流程、人工复核流程的统一管理。

## 核心特性

### 数据模型
- **证书（Certificate）**: 包含课程、学员、证书编号、发证日期、状态等信息
- **撤销记录（RevocationRecord）**: 包含撤销原因、处理流程、状态、操作人等信息
- **导入记录（ImportRecord）**: 包含批次号、行号、状态、错误信息等

### 状态定义
- **证书状态**: 已发证(issued) / 撤销中(revoking) / 已撤销(revoked) / 恢复申请(restore_requested)
- **处理流程**: 正常流程(normal) / 驳回流程(reject) / 人工复核(manual_review)
- **导入状态**: 待处理(pending) / 成功(success) / 失败(failed) / 冲突(conflict)

### 边界处理
- 证书撤销后外部验证页正确显示状态
- 接口不会静默覆盖原记录，所有操作均留痕
- 批量导入时逐行校验，支持部分成功部分失败

## 项目结构

```
├── src/
│   ├── types.ts                    # 类型定义
│   ├── store.ts                    # 内存数据存储
│   ├── services/
│   │   ├── revocation.service.ts   # 撤销业务逻辑
│   │   └── importExport.service.ts # 导入导出服务
│   ├── controllers/
│   │   └── revocation.controller.ts # 控制器
│   ├── routes.ts                   # 路由定义
│   └── index.ts                    # 入口文件
├── package.json
├── tsconfig.json
└── sample-import.csv               # 示例导入文件
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 生产环境运行

```bash
npm start
```

## API 接口文档

### 1. 撤销证书

```
POST /api/certificate/revoke
Content-Type: application/json

{
  "certificateNo": "CERT-2024-001",
  "reason": "考试作弊",
  "operatorId": "OP-001",
  "operatorName": "管理员",
  "flow": "normal"  // normal | reject | manual_review
}
```

### 2. 人工复核

```
POST /api/certificate/review
Content-Type: application/json

{
  "revocationId": "xxx",
  "approved": true,
  "reviewComment": "情况属实，同意撤销",
  "operatorId": "OP-001",
  "operatorName": "管理员"
}
```

### 3. 驳回撤销

```
POST /api/certificate/reject
Content-Type: application/json

{
  "revocationId": "xxx",
  "rejectReason": "撤销申请理由不充分",
  "operatorId": "OP-001",
  "operatorName": "管理员"
}
```

### 4. 恢复证书

```
POST /api/certificate/restore
Content-Type: application/json

{
  "certificateId": "xxx",
  "reason": "撤销为误操作",
  "operatorId": "OP-001",
  "operatorName": "管理员"
}
```

### 5. 查询撤销记录列表

```
GET /api/certificate/revocations?page=1&pageSize=10&status=revoked&flow=normal&keyword=张三
```

### 6. 查询撤销记录详情

```
GET /api/certificate/revocations/:id
```

### 7. 查询证书列表

```
GET /api/certificate/certificates?page=1&pageSize=10&status=issued&keyword=张三
```

### 8. 查询证书详情

```
GET /api/certificate/certificates/:id
```

### 9. 查询证书操作历史

```
GET /api/certificate/certificates/:certificateId/history
```

### 10. 外部证书验证

```
GET /api/certificate/verify/:certificateNo
```

### 11. 批量导入撤销

```
POST /api/certificate/import
Content-Type: application/json

{
  "filePath": "./sample-import.csv",
  "operatorId": "OP-001",
  "operatorName": "管理员"
}
```

### 12. 导出撤销记录

```
GET /api/certificate/export/revocations?status=revoked&flow=normal
```

### 13. 导出证书列表

```
GET /api/certificate/export/certificates?status=revoked
```

### 14. 查询导入记录

```
GET /api/certificate/import-records?batchNo=BATCH-xxx
```

## 样例数据说明

系统初始化时自动包含以下样例数据：

### 证书数据
1. CERT-2024-001 - 张三 - 企业安全培训 - 已发证
2. CERT-2024-002 - 李四 - 企业安全培训 - 已撤销
3. CERT-2024-003 - 王五 - 数据隐私保护 - 撤销中
4. CERT-2024-004 - 赵六 - 数据隐私保护 - 恢复申请
5. CERT-2024-005 - 钱七 - 领导力培训 - 已发证

### 撤销记录
- 包含正常流程、人工复核、驳回流程的样例记录

### 导入记录
- 包含成功、冲突、失败三种状态的样例导入记录

## 验收场景说明

### 1. 完整流转
- 导入证书撤销 → 审核 → 导出，列表、详情、历史互相对应

### 2. 冲突记录
- 导入已撤销的证书，系统标记为冲突状态

### 3. 导入坏行
- 导入不存在的证书编号，系统标记为失败状态并记录错误信息
