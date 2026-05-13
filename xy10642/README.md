# 宠物疫苗批次提醒管理系统

## 本地启动

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

服务启动后访问：http://localhost:3000

## 主要API

### GET /api/vaccines
获取疫苗批次列表

**参数：**
- `search` (可选): 搜索关键词
- `petBreed` (可选): 宠物品种过滤
- `batchNo` (可选): 疫苗批次过滤

### POST /api/vaccines/validate
校验疫苗批次

**请求体：**
```json
{
  "batchNo": "疫苗批次号",
  "petBreed": "宠物品种"
}
```

### PUT /api/vaccines/:id
更新疫苗记录

**请求体：**
```json
{
  "petBreed": "宠物品种",
  "vaccineBatch": "疫苗批次",
  "intervalDays": 接种间隔天数,
  "abnormalReaction": "异常反应",
  "appointmentReminder": "预约提醒",
  "followUpResult": "回访结果",
  "handler": "责任人"
}
```

### POST /api/vaccines/:id/abnormal
推进异常反应处理

**请求体：**
```json
{
  "status": "处理状态",
  "handler": "责任人"
}
```

### POST /api/vaccines/:id/reminder
保存预约提醒

**请求体：**
```json
{
  "reminderDate": "提醒日期",
  "handler": "责任人"
}
```

### GET /api/report
导出报告

**参数：**
- `handler` (可选): 责任人筛选
- `startTime` (可选): 开始时间
- `endTime` (可选): 结束时间

### GET /api/statistics
获取统计数据

## 测试数据

系统预置以下样例数据：
- 宠物品种：金毛、泰迪、布偶猫、英短猫
- 疫苗批次：VAC2024001、VAC2024002、VAC2024003
- 接种间隔：21天、28天、14天
- 异常反应：发热、呕吐、无反应、局部红肿
- 回访结果：良好、需复诊、恢复中、未联系

## 会失败的操作

尝试更新不存在的疫苗记录：

```bash
curl -X PUT http://localhost:3000/api/vaccines/non-existent-id \
  -H "Content-Type: application/json" \
  -d '{"petBreed": "金毛"}'
```

预期结果：返回 404 错误，提示"疫苗记录不存在"
