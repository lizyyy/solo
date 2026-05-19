# 门店品控管理系统 API 文档

## 基础信息

- Base URL: `http://localhost:8080/api/v1`
- Content-Type: `application/json`

## 通用响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

- `code`: 0 表示成功，其他表示错误
- `message`: 响应消息
- `data`: 响应数据

---

## 菜品留样接口

### 创建留样记录

**POST** `/samples`

请求体:
```json
{
  "store_id": "ST001",
  "dish_name": "红烧肉",
  "dish_batch": "BATCH20240519001",
  "sample_weight": 0.25,
  "sample_time": "2024-05-19 12:00:00",
  "keeper": "张三",
  "keeper_phone": "13800138001",
  "storage_location": "冷藏柜A1",
  "idempotent_key": "unique_key_123"
}
```

### 查询单条留样记录

**GET** `/samples/:sample_no`

### 查询留样列表

**GET** `/samples?store_id=ST001&page=1&page_size=20`

### 销毁留样

**POST** `/samples/destroy`

请求体:
```json
{
  "sample_no": "SMPST00120240519123456",
  "operator": "管理员",
  "reason": "留样已过期"
}
```

---

## 温度记录接口

### 创建温度记录

**POST** `/temperature`

请求体:
```json
{
  "store_id": "ST001",
  "fridge_id": "FRIDGE001",
  "fridge_name": "冷藏柜A",
  "temperature": 4.5,
  "check_time": "2024-05-19 08:00:00",
  "checker": "李四",
  "checker_phone": "13800138002",
  "idempotent_key": "unique_key_456"
}
```

### 查询单条温度记录

**GET** `/temperature/:record_no`

### 查询温度记录列表

**GET** `/temperature?store_id=ST001&page=1&page_size=20`

### 检查温度间隔和异常

**GET** `/temperature/check-gap?store_id=ST001&fridge_id=FRIDGE001&start_time=2024-05-18 00:00:00&end_time=2024-05-19 23:59:59`

---

## 废弃记录接口

### 创建废弃记录

**POST** `/waste`

请求体:
```json
{
  "store_id": "ST001",
  "dish_name": "红烧肉",
  "dish_batch": "BATCH20240519001",
  "waste_type": "过期",
  "waste_weight": 2.5,
  "waste_time": "2024-05-19 18:00:00",
  "waste_reason": "菜品已过期",
  "operator": "王五",
  "operator_phone": "13800138003",
  "witness": "赵六",
  "idempotent_key": "unique_key_789"
}
```

### 查询单条废弃记录

**GET** `/waste/:waste_no`

### 查询废弃记录列表

**GET** `/waste?store_id=ST001&page=1&page_size=20`

---

## 报表接口

### 获取日报表

**GET** `/reports/daily?store_id=ST001&date=2024-05-19`

### 导出日报表CSV

**GET** `/reports/daily/export?store_id=ST001&date=2024-05-19`

### 获取批次汇总

**GET** `/reports/batch/:dish_batch`

---

## 提醒接口

### 获取待处理提醒

**GET** `/reminders?store_id=ST001`

### 确认提醒

**POST** `/reminders/acknowledge`

请求体:
```json
{
  "reminder_no": "REMxxxx",
  "operator": "管理员"
}
```

---

## 规则引擎接口

### 检查过期留样

**POST** `/rules/check-expired`

### 获取规则执行日志

**GET** `/rules/logs?record_type=sample&record_ref_no=SMPxxxx`

---

## 健康检查

**GET** `/health`

---

## 敏感字段处理

系统会自动对以下敏感字段进行脱敏处理：
- 手机号（如：138****8001）
- 身份证号
- 邮箱

脱敏在服务端完成，导出文件和日志中同样会进行脱敏处理。

---

## 幂等性说明

为防止重复提交，所有创建接口支持 `idempotent_key` 参数：
- 客户端生成唯一键（建议使用 UUID 或业务唯一标识组合）
- 相同 `idempotent_key` 的重复请求不会创建新记录，直接返回已有记录
- 如不传 `idempotent_key`，系统会根据关键业务字段自动生成

---

## 业务规则

### 留样规则
- 留样默认保留时间：48小时
- 过期自动隔离并记录执行日志
- 销毁留样需记录操作人和原因

### 温度规则
- 正常温度范围：0-8°C
- 超出范围自动标记为异常
- 检测间隔：建议每60分钟检测一次
- 间隔超时会触发规则告警

### 批次追踪
- 同一批次可跨门店汇总
- 支持查询批次留样、废弃、温度全链路记录
