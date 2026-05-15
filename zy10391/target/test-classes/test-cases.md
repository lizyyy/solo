# 多源身份校验 API 测试用例

## 1. 正常请求 - 无冲突场景

### 请求
```json
POST /api/verification
Content-Type: application/json

{
  "requestId": "REQ-NO-CONFLICT-001",
  "businessType": "用户注册",
  "description": "新用户注册身份校验",
  "createdBy": "system",
  "identityDataList": [
    {
      "sourceCode": "GOV",
      "idType": "ID_CARD",
      "idValue": "110101199001011234",
      "name": "张三",
      "gender": "男",
      "birthDate": "1990-01-01",
      "address": "北京市朝阳区xxx街道",
      "phoneNumber": "13800138000",
      "email": "zhangsan@example.com"
    },
    {
      "sourceCode": "BANK",
      "idType": "ID_CARD",
      "idValue": "110101199001011234",
      "name": "张三",
      "gender": "男",
      "birthDate": "1990-01-01",
      "address": "北京市朝阳区xxx街道",
      "phoneNumber": "13800138000",
      "email": "zhangsan@example.com"
    }
  ]
}
```

### 预期结果
- 状态码: 200
- 校验状态: CONFIRMED (已确认)
- 冲突数量: 0
- 信任评分: 高

---

## 2. 正常请求 - 有冲突场景

### 请求
```json
POST /api/verification
Content-Type: application/json

{
  "requestId": "REQ-WITH-CONFLICT-001",
  "businessType": "贷款申请",
  "description": "贷款申请身份校验",
  "createdBy": "operator01",
  "identityDataList": [
    {
      "sourceCode": "GOV",
      "idType": "ID_CARD",
      "idValue": "110101199001015678",
      "name": "李四",
      "gender": "男",
      "birthDate": "1990-02-02",
      "address": "上海市浦东新区xxx路",
      "phoneNumber": "13900139000",
      "email": "lisi@example.com"
    },
    {
      "sourceCode": "THIRD_PARTY",
      "idType": "ID_CARD",
      "idValue": "110101199002025678",
      "name": "李四",
      "gender": "女",
      "birthDate": "1990-03-03",
      "address": "上海市徐汇区xxx路",
      "phoneNumber": "13900139001",
      "email": "lisi2@example.com"
    }
  ]
}
```

### 预期结果
- 状态码: 200
- 校验状态: PENDING_CONFIRM (待人工确认)
- 冲突数量: > 0 (gender, birthDate, address, phoneNumber, email 等字段冲突)
- 信任评分: 中低

---

## 3. 异常请求 - 参数缺失

### 请求
```json
POST /api/verification
Content-Type: application/json

{
  "businessType": "异常测试",
  "identityDataList": []
}
```

### 预期结果
- 状态码: 400
- 提示: "参数校验失败"
- requestId 必填
- identityDataList 不能为空

---

## 4. 异常请求 - 查询不存在的任务

### 请求
```
GET /api/verification/99999
```

### 预期结果
- 状态码: 500
- 提示: "校验任务不存在"

---

## 5. 重复提交请求

### 第一次请求
```json
POST /api/verification
Content-Type: application/json

{
  "requestId": "REQ-DUPLICATE-001",
  "businessType": "重复请求测试",
  "description": "测试幂等性",
  "createdBy": "tester",
  "identityDataList": [
    {
      "sourceCode": "GOV",
      "idType": "ID_CARD",
      "idValue": "110101199001011234",
      "name": "王五",
      "gender": "男"
    }
  ]
}
```

### 第二次请求 (相同requestId)
```json
POST /api/verification
Content-Type: application/json

{
  "requestId": "REQ-DUPLICATE-001",
  "businessType": "重复请求测试",
  "description": "测试幂等性 - 第二次提交",
  "createdBy": "tester",
  "identityDataList": [
    {
      "sourceCode": "GOV",
      "idType": "ID_CARD",
      "idValue": "110101199001011234",
      "name": "王五",
      "gender": "男"
    }
  ]
}
```

### 预期结果
- 第一次请求: 状态码 200，创建新任务
- 第二次请求: 状态码 409，返回已有结果，提示"重复请求，已返回已有结果"
- 数据库中只创建一条记录

---

## 6. 人工处理冲突 - 推进校验

### 前置条件
先执行测试用例2创建有冲突的任务

### 请求
```json
POST /api/verification/2/advance
Content-Type: application/json

{
  "operatorId": "OPERATOR-001",
  "operatorName": "张审核员",
  "comments": "已与用户电话核实，采用GOV数据源信息",
  "resolutions": [
    {
      "conflictFieldId": 1,
      "finalValue": "男"
    },
    {
      "conflictFieldId": 2,
      "finalValue": "1990-02-02"
    },
    {
      "conflictFieldId": 3,
      "finalValue": "上海市浦东新区xxx路"
    }
  ]
}
```

### 预期结果
- 状态码: 200
- 校验状态更新
- 冲突字段标记为已解决
- 生成确认记录

---

## 7. 撤销校验任务

### 请求
```
POST /api/verification/2/revoke?reason=用户主动申请撤销
```

### 预期结果
- 状态码: 200
- 状态更新为 REVOKED
- 描述中追加撤销原因

---

## 8. 导出Excel

### 请求
```
GET /api/export/1/excel
```

### 预期结果
- 返回 Excel 文件下载
- 包含: 任务概览、身份数据、冲突字段、合并建议、确认记录 5个sheet

---

## 9. 查看历史记录

### 请求
```
GET /api/verification/2/history
```

### 预期结果
- 状态码: 200
- 返回所有人工确认操作的历史记录
