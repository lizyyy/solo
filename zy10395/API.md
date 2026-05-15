# 边缘节点配置签收API - 接口文档

## 项目概述
边缘节点配置签收API系统，提供配置下发、签收确认、生效校验、失败补发、版本对账等核心功能。

## 技术栈
- Java 8+ (兼容 Java 8, 9, 10, 11)
- Spring Boot 2.7.18
- MyBatis Plus 3.5.3.1
- H2 Database (内存数据库)
- Apache POI 5.2.3

## 快速启动

### 方式一：一键启动（推荐）
```bash
./start.sh
```
脚本会自动：
- 检查 Java 环境
- 自动下载 Maven（如需要）
- 编译项目
- 启动 Spring Boot 服务

### 方式二：使用 Maven
```bash
./mvnw clean spring-boot:run
# 或
mvn clean spring-boot:run
```

服务启动后访问: http://localhost:8080

H2控制台: http://localhost:8080/h2-console
- JDBC URL: jdbc:h2:mem:edge_config
- Username: sa
- Password: (空)

## API 测试脚本
项目启动后，运行测试脚本验证所有接口：
```bash
./test-api.sh
```

## 预置测试数据
- 边缘节点: NODE1 ~ NODE5
- 配置版本: V20240101001

---

## API接口列表

### 1. 创建配置下发
**POST** `/api/v1/delivery/create`

请求体:
```json
{
  "nodeCode": "NODE1",
  "versionNo": "V20240101001",
  "idempotentKey": "unique-key-001"
}
```

响应:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "deliveryNo": "DLVxxx",
    "nodeCode": "NODE1",
    "versionNo": "V20240101001",
    "status": 1,
    "deliveryTime": "2024-01-01T12:00:00"
  },
  "timestamp": 1234567890000
}
```

错误码:
- 10002: 节点不存在
- 10003: 配置版本不存在
- 10005: 该节点配置已下发
- 10007: 请求已处理(幂等)

---

### 2. 签收配置
**POST** `/api/v1/delivery/ack`

请求体:
```json
{
  "deliveryNo": "DLVxxx",
  "ackResult": 1,
  "ackBy": "edge-agent-001",
  "failureCode": "E001",
  "failureMsg": "网络超时",
  "failureDetail": "连接超时30s",
  "idempotentKey": "ack-unique-key-001"
}
```

签收结果(ackResult):
- 1: 成功
- 2: 失败

响应:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "receiptNo": "RCPxxx",
    "deliveryNo": "DLVxxx",
    "ackResult": 1,
    "ackTime": "2024-01-01T12:00:00"
  },
  "timestamp": 1234567890000
}
```

错误码:
- 10004: 下发记录不存在
- 10008: 当前状态不允许签收

---

### 3. 生效校验
**POST** `/api/v1/delivery/effective-check`

请求体:
```json
{
  "deliveryNo": "DLVxxx",
  "checkResult": 1,
  "checkDetail": "校验通过，配置已生效",
  "checkBy": "monitor-system",
  "failureCode": "E002",
  "failureMsg": "校验失败",
  "failureDetail": "配置格式错误"
}
```

校验结果(checkResult):
- 1: 成功
- 2: 失败
- 3: 校验中

响应:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "deliveryNo": "DLVxxx",
    "checkResult": 1,
    "checkTime": "2024-01-01T12:00:00"
  },
  "timestamp": 1234567890000
}
```

错误码:
- 10004: 下发记录不存在
- 10009: 当前状态不允许校验

---

### 4. 查询下发记录列表
**GET** `/api/v1/delivery/list`

查询参数:
- nodeCode: 节点编码(可选)
- versionNo: 版本号(可选)
- status: 状态(可选)
- startTime: 开始时间(可选)
- endTime: 结束时间(可选)
- pageNum: 页码，默认1
- pageSize: 每页条数，默认20

状态说明:
- 1: 待签收
- 2: 已签收
- 3: 生效中
- 4: 已生效
- 5: 签收失败
- 6: 生效失败

响应:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "records": [...],
    "total": 100,
    "size": 20,
    "current": 1
  },
  "timestamp": 1234567890000
}
```

---

### 5. 查询下发详情
**GET** `/api/v1/delivery/{deliveryNo}`

响应:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "deliveryNo": "DLVxxx",
    "nodeCode": "NODE1",
    "versionNo": "V20240101001",
    "status": 4,
    "deliveryTime": "2024-01-01T12:00:00",
    "ackTime": "2024-01-01T12:01:00",
    "effectiveTime": "2024-01-01T12:05:00"
  },
  "timestamp": 1234567890000
}
```

---

### 6. 查询签收历史
**GET** `/api/v1/delivery/{deliveryNo}/receipts`

响应:
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "receiptNo": "RCPxxx",
      "deliveryNo": "DLVxxx",
      "ackResult": 1,
      "ackTime": "2024-01-01T12:00:00",
      "ackBy": "edge-agent",
      "clientIp": "192.168.1.100"
    }
  ],
  "timestamp": 1234567890000
}
```

---

### 7. 查询失败历史
**GET** `/api/v1/delivery/{deliveryNo}/failures`

响应:
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "deliveryNo": "DLVxxx",
      "failureType": 1,
      "failureCode": "E001",
      "failureMsg": "网络超时",
      "failureDetail": "连接超时30s",
      "failureTime": "2024-01-01T12:00:00"
    }
  ],
  "timestamp": 1234567890000
}
```

失败类型(failureType):
- 1: 签收失败
- 2: 生效失败

---

### 8. 版本对账
**GET** `/api/v1/delivery/reconciliation/{versionNo}`

响应:
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "nodeCode": "NODE1",
      "versionNo": "V20240101001",
      "expectedStatus": 4,
      "actualStatus": 4,
      "isMatch": true,
      "remark": "匹配"
    }
  ],
  "timestamp": 1234567890000
}
```

---

## 导出接口

### 导出下发记录
**GET** `/api/v1/export/delivery?nodeCode=NODE1&versionNo=V20240101001`

### 导签收记录
**GET** `/api/v1/export/receipt/{deliveryNo}`

### 导出失败记录
**GET** `/api/v1/export/failure/{deliveryNo}`

### 导生效校验记录
**GET** `/api/v1/export/check/{deliveryNo}`

---

## 统一错误码

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 10001 | 参数错误 |
| 10002 | 节点不存在 |
| 10003 | 配置版本不存在 |
| 10004 | 下发记录不存在 |
| 10005 | 该节点配置已下发 |
| 10006 | 状态流转不合法 |
| 10007 | 请求已处理(幂等) |
| 10008 | 当前状态不允许签收 |
| 10009 | 当前状态不允许校验 |
| 10010 | 重试次数已耗尽 |
| 99999 | 系统内部错误 |

---

## 幂等性说明

1. **创建下发**:
   - 数据库唯一约束: nodeCode + versionNo，防止同一节点同一版本重复下发
   - 请求参数 idempotentKey: 用于防止同一请求重复提交

2. **签收接口**:
   - 请求参数 idempotentKey: 用于防止同一签收请求重复处理
   - 重复请求会直接返回已存在的签收记录

3. **建议**:
   - idempotentKey建议使用 UUID 或业务唯一标识
   - 有效期内(默认内存缓存)相同key的请求只会处理一次

---

## 状态流转图

```
待签收(1) --签收成功--> 已签收(2) --校验成功--> 已生效(4)
    |                     |                     |
    |签收失败             |校验失败             |校验中
    v                     v                     v
签收失败(5)           生效失败(6)           生效中(3)
    |                     |
    |重试补发             |重试校验
    v                     v
待签收(1)             已签收(2)
```

---

## 测试示例

### 完整流程测试

1. **创建下发**
```bash
curl -X POST http://localhost:8080/api/v1/delivery/create \
  -H "Content-Type: application/json" \
  -d '{"nodeCode":"NODE1","versionNo":"V20240101001"}'
```

2. **签收配置**
```bash
curl -X POST http://localhost:8080/api/v1/delivery/ack \
  -H "Content-Type: application/json" \
  -d '{"deliveryNo":"DLVxxx","ackResult":1,"ackBy":"test-agent"}'
```

3. **生效校验**
```bash
curl -X POST http://localhost:8080/api/v1/delivery/effective-check \
  -H "Content-Type: application/json" \
  -d '{"deliveryNo":"DLVxxx","checkResult":1,"checkBy":"test-monitor"}'
```

4. **查询对账**
```bash
curl http://localhost:8080/api/v1/delivery/reconciliation/V20240101001
```
