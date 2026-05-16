# 隐私导出同意API系统

基于Spring Boot实现的个人数据导出同意管理系统，提供完整的同意版本校验、导出范围管理、审批流程、打包任务和交付记录功能。

## 技术栈

- Spring Boot 3.2.0
- Spring Data JPA
- H2 Database (嵌入式)
- Lombok
- Java 17

## 核心功能

### 1. 数据模型

- **ConsentVersion (同意版本)**: 管理不同版本的隐私政策同意书，支持生效日期和版本控制
- **ExportRequest (导出请求)**: 主记录实体，包含用户信息、状态流转、原始输入和处理结论
- **ExportScopeItem (导出范围项)**: 定义具体可导出的字段和类别
- **ApprovalNode (审批节点)**: 多级审批流程的节点记录，包含处理结果和审计信息
- **PackagingTask (打包任务)**: 记录数据打包的详细信息，支持幂等处理
- **DeliveryRecord (交付记录)**: 记录数据交付的过程和确认信息

### 2. 状态机设计

完整的状态流转：
```
DRAFT (草稿)
  ↓
PENDING_CONSENT_VALIDATION (待同意校验)
  ↓
CONSENT_VALIDATED (同意已校验) ──┐
  ↓                                │
PENDING_LEGAL_APPROVAL (待法务审批)│
  ↓                                │
PENDING_SCOPE_VALIDATION (待范围校验)
  ↓
SCOPE_VALIDATED (范围已校验)
  ↓
READY_FOR_PACKAGING (待打包)
  ↓
PACKAGING_IN_PROGRESS (打包中)
  ↓
PACKAGING_COMPLETED (打包完成)
  ↓
READY_FOR_DELIVERY (待交付)
  ↓
DELIVERY_IN_PROGRESS (交付中)
  ↓
DELIVERED (已交付)
  ↓
COMPLETED (完成)
```

异常状态：
- CONSENT_VALIDATION_FAILED (同意校验失败)
- LEGAL_REJECTED (法务拒绝)
- SCOPE_VALIDATION_FAILED (范围校验失败)
- PACKAGING_FAILED (打包失败)
- DELIVERY_FAILED (交付失败)
- CANCELLED (已取消)
- NEEDS_MANUAL_CORRECTION (需人工修正)

### 3. 导出范围类别

- PROFILE_DATA: 个人基本资料
- CONTACT_DATA: 联系方式
- TRANSACTION_DATA: 交易记录
- BEHAVIOR_DATA: 行为数据
- COMMUNICATION_DATA: 通讯记录
- DOCUMENT_DATA: 文档资料
- PAYMENT_DATA: 支付信息
- LOCATION_DATA: 位置信息
- DEVICE_DATA: 设备信息
- THIRD_PARTY_DATA: 第三方共享数据

## API接口

### 同意版本管理

```
GET    /api/v1/consent-versions              # 查询所有同意版本
GET    /api/v1/consent-versions/active       # 查询所有有效版本
GET    /api/v1/consent-versions/{versionCode}# 查询指定版本
POST   /api/v1/consent-versions              # 创建同意版本
```

### 导出请求管理

```
POST   /api/v1/export-requests                          # 创建导出请求
GET    /api/v1/export-requests/{requestNo}              # 查询请求详情
GET    /api/v1/export-requests/user/{userId}            # 查询用户的所有请求
GET    /api/v1/export-requests/status/{status}          # 按状态查询请求
POST   /api/v1/export-requests/{requestNo}/transition   # 状态流转
POST   /api/v1/export-requests/{requestNo}/manual-correction  # 人工修正
```

### 子资源查询

```
GET    /api/v1/export-requests/{requestNo}/approval-nodes    # 查询审批节点
GET    /api/v1/export-requests/{requestNo}/scope-items       # 查询导出范围
GET    /api/v1/export-requests/{requestNo}/packaging-task    # 查询打包任务
GET    /api/v1/export-requests/{requestNo}/delivery-record   # 查询交付记录
```

## 快速开始

### 1. 构建项目

```bash
mvn clean package
```

### 2. 运行应用

```bash
mvn spring-boot:run
```

### 3. 访问H2控制台

- URL: http://localhost:8080/h2-console
- JDBC URL: jdbc:h2:file:./data/privacy_export_db
- 用户名: sa
- 密码: (空)

## 测试脚本

项目提供了完整的测试脚本：

```bash
# 正常流程测试
chmod +x src/test/resources/sample-api-test.sh
./src/test/resources/sample-api-test.sh

# 异常场景测试
chmod +x src/test/resources/exception-scenario-test.sh
./src/test/resources/exception-scenario-test.sh
```

## 核心特性

### 1. 状态边界控制
- 严格的状态机校验，防止非法状态转换
- 终端状态不可修改，确保数据完整性
- 每个状态转换都记录操作人和时间

### 2. 导出字段可读性
- 每个导出字段都有明确的类别和描述
- 支持字段级别开关控制（isIncluded）
- 范围校验确保只导出用户同意的字段

### 3. 失败追溯
- **originalInput**: 保存原始请求输入
- **processingConclusion**: 记录每一步的处理结论
- **approvalNodes**: 每个审批节点都保存独立的处理结果
- 支持从主记录一路追溯到具体的失败原因

### 4. 人工修正机制
- 当流程遇到问题时，可以进入 NEEDS_MANUAL_CORRECTION 状态
- 支持修正同意版本、导出范围等关键信息
- 修正后流程可从 DRAFT 状态重新开始
- 完整记录修正人和修正原因

### 5. 同意版本校验
- 版本有效性校验（是否激活、是否在有效期内）
- 支持多版本并行管理
- 旧版本到期后自动失效

### 6. 打包幂等性
- 每个导出请求只创建一个打包任务
- 支持重试机制
- 记录打包过程的详细日志

### 7. 审批流程
- 5级审批节点：同意校验、法务审批、范围校验、打包审核、交付确认
- 每个节点独立记录审批意见和处理结果
- 支持人工审批和系统自动审批

## 响应格式

```json
{
  "code": "0",
  "message": "success",
  "data": {...},
  "timestamp": "2024-05-16T10:30:00"
}
```

错误响应：
```json
{
  "code": "E001",
  "message": "无效的状态转换: DRAFT -> CONSENT_VALIDATED",
  "data": null,
  "timestamp": "2024-05-16T10:30:00"
}
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| E001 | 无效的状态转换 |
| E002 | 同意版本已过期 |
| E003 | 同意版本不存在 |
| E004 | 导出请求不存在 |
| E005 | 无效的导出范围类别 |
| E006 | 导出范围校验失败 |
| E007 | 打包任务已存在 |
| E008 | 交付记录已存在 |
| E009 | 审批节点不存在 |
| E010 | 需要人工修正 |
| E011 | 请求已完成 |
| E012 | 请求编号重复 |
| E013 | 参数校验失败 |
| E999 | 系统内部错误 |

## 合规说明

本系统设计符合《个人信息保护法》第45条关于个人信息复制、转移的规定，确保：
1. 用户知情权（同意版本管理）
2. 范围可控性（导出范围校验）
3. 过程可追溯（完整的审批和处理记录）
4. 异常可干预（人工修正机制）
