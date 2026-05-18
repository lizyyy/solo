# 风控名单服务 - 灰名单到期复核 API

## 项目概述

这是一个完整的灰名单到期复核管理系统，支持批量导入旧记录、单条人工复核、状态流转、到期自动拦截等功能。

## 技术栈

- Spring Boot 3.2.0
- Spring Data JPA
- MySQL
- Apache POI (Excel导入导出)
- Lombok

## 核心功能

### 1. 状态定义

| 状态 | 描述 |
|------|------|
| IN_GRAYLIST | 灰名单中 |
| REVIEW_PENDING | 复核待办 |
| REMOVED | 已解除 |
| UNDER_OBSERVATION | 继续观察 |

### 2. 复核结论

| 结论 | 描述 |
|------|------|
| REMOVE_FROM_LIST | 解除灰名单 |
| CONTINUE_OBSERVATION | 继续观察 |
| NEED_MORE_INFO | 需补充材料 |
| TRANSFER_TO_MANUAL | 转人工处理 |

## API接口

### 1. 批量导入灰名单

**接口：** `POST /api/graylist/import`

**参数：**
- `file`: Excel文件（必填）
- `importUser`: 导入人（可选，默认system）

**Excel格式：**
| 客户ID | 客户名称 | 名单原因 | 到期时间 | 状态 |
|--------|----------|----------|----------|------|
| CUST001 | 测试客户 | 交易异常 | 2024-12-31 00:00:00 | IN_GRAYLIST |

**响应示例：**
```json
{
  "code": 200,
  "message": "导入完成",
  "data": {
    "batchNo": "IMP1717200000000",
    "fileName": "graylist.xlsx",
    "totalCount": 100,
    "successCount": 95,
    "conflictCount": 3,
    "invalidCount": 2,
    "details": [
      {
        "rowNumber": 2,
        "customerId": "CUST001",
        "customerName": "测试客户",
        "resultType": "CONFLICT",
        "resultDescription": "记录冲突",
        "errorMessage": "该客户已有有效灰名单记录"
      }
    ]
  }
}
```

### 2. 单条复核

**接口：** `POST /api/graylist/review`

**请求体：**
```json
{
  "recordId": 1,
  "newStatus": "REMOVED",
  "conclusion": "REMOVE_FROM_LIST",
  "reviewRemark": "经核实，为正常交易，解除灰名单",
  "reviewer": "张三"
}
```

### 3. 查询详情

**接口：** `GET /api/graylist/{id}`

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "customerId": "CUST001",
    "customerName": "测试客户",
    "listReason": "交易异常",
    "expireTime": "2024-12-31T00:00:00",
    "status": "IN_GRAYLIST",
    "reviewRemark": null,
    "reviewer": null,
    "reviewTime": null,
    "batchNo": "IMP1717200000000",
    "isExpiredNotReviewed": false,
    "nextStepHint": null
  }
}
```

### 4. 列表查询

**接口：** `GET /api/graylist/list`

**参数：**
- `customerId`: 客户ID（可选）
- `customerName`: 客户名称（可选）
- `status`: 状态（可选）
- `page`: 页码（默认0）
- `size`: 每页大小（默认10）

### 5. 历史记录

**接口：** `GET /api/graylist/{id}/history`

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "recordId": 1,
      "previousStatus": "IN_GRAYLIST",
      "newStatus": "REVIEW_PENDING",
      "conclusion": null,
      "reviewRemark": "进入复核流程",
      "reviewer": "张三",
      "reviewTime": "2024-06-01T10:00:00"
    }
  ]
}
```

### 6. 客户状态检查

**接口：** `GET /api/graylist/check/{customerId}`

**到期未复核拦截响应：**
```json
{
  "code": 400,
  "message": "该客户灰名单已到期未复核，已自动拦截",
  "errorType": "EXPIRED_NOT_REVIEWED",
  "nextStep": "请补充：1.逾期复核说明 2.风险重新评估报告 3.审批人确认后，方可解除限制"
}
```

### 7. 导出Excel

**接口：** `GET /api/graylist/export`

**参数：**
- `customerId`: 客户ID（可选）
- `customerName`: 客户名称（可选）
- `status`: 状态（可选）

### 8. 手动触发到期检查

**接口：** `POST /api/graylist/check-expired`

## 错误处理

| 错误码 | 错误类型 | 说明 |
|--------|----------|------|
| 400 | INVALID_PARAMETER | 参数错误 |
| 400 | VALIDATION_ERROR | 校验失败 |
| 400 | EXPIRED_NOT_REVIEWED | 到期未复核已拦截 |
| 450 | NEED_MANUAL | 需要人工处理 |
| 500 | - | 系统错误 |

## 验收场景

### 场景1：完整流转
1. 创建客户记录，状态为「灰名单中」
2. 复核变更为「复核待办」
3. 复核变更为「已解除」或「继续观察」
4. 验证历史记录包含所有状态变更

### 场景2：冲突记录
1. 先导入一条客户A的记录
2. 再次导入客户A的记录
3. 验证导入结果显示为冲突（conflictCount = 1）

### 场景3：导入坏行
1. 准备包含以下行的Excel：
   - 正常数据（客户ID不为空）
   - 客户ID为空的坏行
   - 重复的客户ID
2. 验证导入结果：
   - successCount = 正常行数
   - invalidCount = 坏行数
   - conflictCount = 重复行数

### 场景4：到期自动拦截
1. 创建一条到期时间为昨天的记录
2. 调用 `/check-expired` 触发检查
3. 调用 `/check/{customerId}` 验证返回拦截响应

## 项目结构

```
src/main/java/com/riskcontrol/graylist/
├── GraylistReviewApplication.java   # 启动类
├── config/
│   └── SchedulingConfig.java         # 定时任务配置
├── controller/
│   └── GraylistController.java       # 控制器
├── dto/
│   ├── ApiResponse.java              # 统一响应
│   ├── GraylistRecordDTO.java        # 记录DTO
│   ├── ImportResultDTO.java          # 导入结果
│   └── ReviewRequestDTO.java         # 复核请求
├── entity/
│   ├── GraylistRecord.java           # 灰名单主表
│   ├── ImportBatch.java              # 导入批次表
│   ├── ImportResultDetail.java       # 导入详情表
│   └── ReviewHistory.java            # 复核历史表
├── enums/
│   ├── GraylistStatus.java           # 状态枚举
│   ├── ImportResultType.java         # 导入结果类型
│   └── ReviewConclusion.java         # 复核结论
├── exception/
│   ├── GlobalExceptionHandler.java   # 全局异常处理
│   └── NeedManualReviewException.java# 人工处理异常
├── repository/
│   ├── GraylistRecordRepository.java
│   ├── ImportBatchRepository.java
│   ├── ImportResultDetailRepository.java
│   └── ReviewHistoryRepository.java
└── service/
    ├── GraylistExportService.java    # 导出服务
    ├── GraylistImportService.java    # 导入服务
    └── GraylistReviewService.java    # 复核服务
```

## 启动说明

1. 配置MySQL连接（application.yml）
2. 创建数据库：`CREATE DATABASE risk_control;`
3. 启动应用：`mvn spring-boot:run`
4. 运行测试：`mvn test`
