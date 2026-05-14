# API 配额借用仲裁台 - 快速开始指南

## 项目概述
这是一个完整的API配额借用管理服务，基于Spring Boot + H2数据库实现，支持借用审批、额度锁定、到期归还、超额拦截、明细对账等核心功能。

## 启动服务

### 前置条件
- JDK 17+
- Maven 3.8+

### 启动步骤
```bash
# 进入项目目录
cd /Users/lzy/pro/solo/workspaces/zy10320

# 编译项目
mvn clean compile

# 启动服务
mvn spring-boot:run
```

服务启动后访问:
- 应用地址: http://localhost:8080
- H2数据库控制台: http://localhost:8080/h2-console
  - JDBC URL: jdbc:h2:mem:quota_db
  - 用户名: sa
  - 密码: (空)

## 一、初始化数据（系统启动时自动创建）

### 已预置的客户配额
| 客户ID | 客户名称 | 总额度 | 可用额度 |
|--------|----------|--------|----------|
| CUST001 | 科技有限公司 | 50,000 | 50,000 |
| CUST002 | 数据服务公司 | 100,000 | 100,000 |
| CUST003 | 电商平台 | 200,000 | 200,000 |

### 已预置的共享池
| 池编码 | 池名称 | 总容量 | 单笔最大限额 |
|--------|--------|--------|--------------|
| POOL001 | API通用配额池 | 100,000 | 10,000 |
| POOL002 | 大客户专属配额池 | 500,000 | 50,000 |

## 二、完整业务流程示例（使用curl）

### 1. 查看客户配额
```bash
curl -X GET http://localhost:8080/api/quota/customer/CUST001
```

### 2. 查看共享池
```bash
curl -X GET http://localhost:8080/api/quota/pool/POOL001
```

### 3. 创建借用申请
```bash
curl -X POST http://localhost:8080/api/quota/application \
  -H "Content-Type: application/json" \
  -d '{
    "applicationNo": "APP202401001",
    "customerId": "CUST001",
    "poolCode": "POOL001",
    "requestAmount": 5000,
    "borrowDays": 30,
    "borrowReason": "双十一活动临时扩容",
    "applicant": "张三"
  }'
```

### 4. 提交审批
```bash
# 先找到申请的ID，然后提交（假设返回id=1）
curl -X POST http://localhost:8080/api/quota/application/1/submit
```

### 5. 审批通过
```bash
curl -X POST http://localhost:8080/api/quota/application/approve \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": 1,
    "result": "APPROVE",
    "opinion": "同意，活动结束后及时归还",
    "approver": "李四",
    "approvedAmount": 5000
  }'
```

### 6. 激活额度（锁定转借用）
```bash
curl -X POST http://localhost:8080/api/quota/application/1/activate
```

### 7. 查看归还计划
```bash
curl -X GET http://localhost:8080/api/quota/application/1/return-plans
```

### 8. 归还额度（假设归还计划ID=1）
```bash
curl -X POST http://localhost:8080/api/quota/return \
  -H "Content-Type: application/json" \
  -d '{
    "planId": 1,
    "returnAmount": 5000,
    "remarks": "活动结束全部归还",
    "operator": "张三"
  }'
```

## 三、如何触发异常场景

### 1. 重复提交申请（避免脏数据）
```bash
# 使用相同的applicationNo再次提交
curl -X POST http://localhost:8080/api/quota/application \
  -H "Content-Type: application/json" \
  -d '{
    "applicationNo": "APP202401001",  # 已存在的编号
    "customerId": "CUST001",
    "poolCode": "POOL001",
    "requestAmount": 3000,
    "borrowDays": 30
  }'
# 预期返回: DUPLICATE_APPLICATION - 申请编号已存在
```

### 2. 超额借用（超过单笔限额）
```bash
curl -X POST http://localhost:8080/api/quota/application \
  -H "Content-Type: application/json" \
  -d '{
    "applicationNo": "APP202401002",
    "customerId": "CUST001",
    "poolCode": "POOL001",
    "requestAmount": 20000,  # POOL001单笔最大10000
    "borrowDays": 30
  }'
# 预期返回: EXCEED_MAX_BORROW - 申请金额超过单笔最大限额
```

### 3. 状态流转错误（非草稿状态提交）
```bash
# 提交一个已审批的申请
curl -X POST http://localhost:8080/api/quota/application/1/submit
# 预期返回: INVALID_STATUS - 只有草稿状态可以提交审批
```

### 4. 归还金额超过应还金额
```bash
curl -X POST http://localhost:8080/api/quota/return \
  -H "Content-Type: application/json" \
  -d '{
    "planId": 1,
    "returnAmount": 99999,  # 超过应还金额
    "operator": "张三"
  }'
# 预期返回: EXCEED_REMAINING - 归还金额超过剩余应还金额
```

### 5. 重复归还已完成的计划
```bash
# 归还一个已完成的计划
curl -X POST http://localhost:8080/api/quota/return \
  -H "Content-Type: application/json" \
  -d '{
    "planId": 1,
    "returnAmount": 100,
    "operator": "张三"
  }'
# 预期返回: PLAN_COMPLETED - 该计划已完成归还
```

### 6. 审批金额为0或负数（超额拦截增强）
```bash
# 创建新申请后提交审批，尝试批准负数金额
curl -X POST http://localhost:8080/api/quota/application/approve \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": 1,
    "result": "APPROVE",
    "approver": "李四",
    "approvedAmount": -500
  }'
# 预期返回: INVALID_APPROVED_AMOUNT - 审批金额必须大于0
```

### 7. 审批金额超过申请金额（超额拦截增强）
```bash
# 假设申请金额为5000，审批为6000
curl -X POST http://localhost:8080/api/quota/application/approve \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": 1,
    "result": "APPROVE",
    "approver": "李四",
    "approvedAmount": 6000
  }'
# 预期返回: EXCEED_REQUEST_AMOUNT - 审批金额不能超过申请金额: 5000
```

### 8. 审批金额超过共享池单笔限额（超额拦截增强）
```bash
# 假设申请金额为50000，但POOL001单笔限额为10000
curl -X POST http://localhost:8080/api/quota/application/approve \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": 1,
    "result": "APPROVE",
    "approver": "李四",
    "approvedAmount": 50000
  }'
# 预期返回: EXCEED_MAX_BORROW - 审批金额超过单笔最大限额: 10000
```

## 四、如何验证修复效果

### 1. 验证数据持久化（文件数据库）
```bash
# 1. 启动服务，创建一条申请记录并完成审批
# 2. 停止服务 (Ctrl+C)
# 3. 检查数据文件存在
ls -la data/

# 4. 重新启动服务
./start.sh

# 5. 验证历史数据仍然存在
curl -X GET http://localhost:8080/api/quota/application/1
# 应能看到之前创建的申请记录，状态未丢失
```

### 2. 验证超额拦截（审批校验）
```bash
# 创建申请
curl -X POST http://localhost:8080/api/quota/application \
  -H "Content-Type: application/json" \
  -d '{
    "applicationNo": "TEST_001",
    "customerId": "CUST001",
    "poolCode": "POOL001",
    "requestAmount": 5000,
    "borrowDays": 30
  }'

# 提交审批（找到返回的id）
curl -X POST http://localhost:8080/api/quota/application/2/submit

# 尝试审批为50000（超过申请额和单笔限额） - 应被拦截
curl -X POST http://localhost:8080/api/quota/application/approve \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": 2,
    "result": "APPROVE",
    "approver": "李四",
    "approvedAmount": 50000
  }'
# 预期返回错误，而不是成功通过
```

## 五、如何查看处理记录

### 1. 查看申请详情
```bash
curl -X GET http://localhost:8080/api/quota/application/APP202401001
```

### 2. 查看客户的所有申请
```bash
curl -X GET http://localhost:8080/api/quota/application/customer/CUST001
```

### 3. 查看审批意见历史
```bash
curl -X GET http://localhost:8080/api/quota/application/1/approvals
```

### 4. 查看扣减明细（额度变动记录）
```bash
curl -X GET http://localhost:8080/api/quota/application/1/deductions
```

### 5. 查看客户最新配额情况
```bash
curl -X GET http://localhost:8080/api/quota/customer/CUST001
```

### 6. 查看共享池最新情况
```bash
curl -X GET http://localhost:8080/api/quota/pool/POOL001
```

## 五、创建新的测试数据

### 1. 创建新客户
```bash
curl -X POST http://localhost:8080/api/quota/customer \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST004",
    "customerName": "新客户公司",
    "totalQuota": 80000,
    "usedQuota": 0,
    "availableQuota": 80000,
    "lockedQuota": 0,
    "borrowedQuota": 0,
    "isActive": true
  }'
```

### 2. 创建新共享池
```bash
curl -X POST http://localhost:8080/api/quota/pool \
  -H "Content-Type: application/json" \
  -d '{
    "poolCode": "POOL003",
    "poolName": "新业务专属池",
    "totalCapacity": 200000,
    "allocatedAmount": 0,
    "availableAmount": 200000,
    "maxBorrowPerApplication": 20000,
    "isActive": true,
    "description": "新业务线专用配额池"
  }'
```

## 六、核心业务规则总结

| 规则类型 | 说明 |
|----------|------|
| 借用审批 | 申请 -> 提交审批 -> 审批通过 -> 锁定额度 -> 激活使用 |
| 额度锁定 | 审批通过后立即锁定共享池和客户额度，防止超额 |
| 到期归还 | 系统自动计算归还日期，支持部分归还和全额归还 |
| 超额拦截 | 单笔限额、池可用额度双重校验 |
| 明细对账 | 每笔操作都生成扣减明细，可追溯 |
| 幂等控制 | 申请编号唯一，防止重复提交 |

## 七、数据对象关系

```
SharedPool (共享池)
    └── BorrowApplication (借用申请)
            ├── ApprovalOpinion (审批意见)
            ├── ReturnPlan (归还计划)
            └── DeductionDetail (扣减明细)

CustomerQuota (客户配额)
    └── BorrowApplication (借用申请)
```
