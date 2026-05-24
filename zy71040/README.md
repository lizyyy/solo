# 光伏逆变器质保 API

光伏电站换逆变器时，故障码、备件序列号和厂家质保单留证管理服务。

## 技术栈

- Go 1.21+
- SQLite
- Gorilla Mux

## 快速启动

### 1. 安装依赖

```bash
go mod tidy
```

### 2. 启动服务

```bash
go run main.go
```

服务默认运行在 `http://localhost:8099`

### 3. 造测试数据

```bash
go run scripts/seed.go
```

## 核心功能

### 质保规则
- 故障码白名单校验：E001/E002/E003 在质保范围内
- 非质保故障码（E998/E999）直接判定质保失败
- 备件序列号唯一性校验（去重）
- 备件可用性校验

### 换机状态机

```
draft(草稿) → verified(已核对) → reviewed(已复核) → accepted(已验收)
       ↓              ↓              ↓
warranty_failed    rejected       rejected
```

**状态流转说明：**
- `draft` → `verified`: 明细核对通过，质保规则校验完成
- `draft` → `warranty_failed`: 故障码不在质保范围，直接判定失败
- `draft` → `rejected`: 核对不通过
- `verified` → `reviewed`: 人工复核通过
- `verified` → `rejected`: 复核驳回
- `reviewed` → `accepted`: 验收通过，生成质保报告
- `reviewed` → `rejected`: 验收驳回
- `rejected` → `draft`: 驳回后可重新提交
- `warranty_failed` / `accepted`: 终态，不可变更

### 序列号去重
- 备件登记时自动检测重复序列号
- 重复序列号禁止入库

### 验收留痕
- 每次状态变更记录操作人、时间、备注
- 证据链支持更新，仅更新不产生新业务记录
- 已验收记录禁止修改

## API 接口

### 健康检查 & 自检

```bash
# 健康检查
curl http://localhost:8080/health

# 轻量自检
curl http://localhost:8080/self-check
```

### 材料登记

```bash
# 登记逆变器
curl -X POST http://localhost:8080/api/v1/inverters \
  -H "Content-Type: application/json" \
  -d '{
    "sn": "INV20240004",
    "model": "SUN-40K",
    "manufacturer": "Sungrow",
    "production_date": "2024-03-01",
    "installation_date": "2024-03-10",
    "station": "阳光电站D区",
    "warranty_period_months": 24
  }'

# 登记故障码
curl -X POST http://localhost:8080/api/v1/fault-codes \
  -H "Content-Type: application/json" \
  -d '{
    "code": "E004",
    "description": "温度过高保护",
    "is_warranty_covered": true,
    "severity": "medium"
  }'

# 登记备件（序列号去重校验）
curl -X POST http://localhost:8080/api/v1/spare-parts \
  -H "Content-Type: application/json" \
  -d '{
    "sn": "SP202405004",
    "type": "散热片",
    "model": "HS-120",
    "manufacturer": "Delta",
    "production_date": "2024-03-15",
    "status": "available"
  }'

# 登记厂家工单
curl -X POST http://localhost:8080/api/v1/factory-orders \
  -H "Content-Type: application/json" \
  -d '{
    "id": "FO202405002",
    "inverter_sn": "INV20240002",
    "fault_code": "E002",
    "spare_part_sn": "SP202405002",
    "issue_date": "2024-05-02",
    "description": "直流过压故障更换申请",
    "status": "approved"
  }'
```

### 明细核对 & 处理流转

```bash
# 创建更换记录
curl -X POST http://localhost:8080/api/v1/replacements \
  -H "Content-Type: application/json" \
  -d '{
    "id": "REP202405001",
    "inverter_sn": "INV20240001",
    "fault_code": "E001",
    "spare_part_sn": "SP202405001",
    "factory_order_id": "FO202405001",
    "old_inverter_photo_url": "http://example.com/old.jpg",
    "fault_photo_url": "http://example.com/fault.jpg",
    "warranty_certificate_url": "http://example.com/cert.pdf",
    "replacement_date": "2024-05-01",
    "technician": "张工",
    "remark": "IGBT损坏"
  }'

# 明细核对（质保规则校验）
curl -X POST http://localhost:8080/api/v1/replacements/REP202405001/verify \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李工",
    "remark": "核对无误"
  }'

# 人工复核
curl -X POST http://localhost:8080/api/v1/replacements/REP202405001/review \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王主管",
    "remark": "复核通过",
    "approved": true
  }'

# 验收通过
curl -X POST http://localhost:8080/api/v1/replacements/REP202405001/accept \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "赵经理",
    "remark": "验收合格",
    "approved": true
  }'
```

### 失败路径示例（故障码不在质保范围）

```bash
# 创建更换记录，使用非质保故障码
curl -X POST http://localhost:8080/api/v1/replacements \
  -H "Content-Type: application/json" \
  -d '{
    "id": "REP202405002",
    "inverter_sn": "INV20240002",
    "fault_code": "E999",
    "spare_part_sn": "SP202405002",
    "replacement_date": "2024-05-02",
    "technician": "张工",
    "remark": "雷击损坏"
  }'

# 明细核对 - 会失败，状态变为 warranty_failed
curl -X POST http://localhost:8080/api/v1/replacements/REP202405002/verify \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李工",
    "remark": "核对"
  }'
```

### 重复补材料（仅更新证据链，不产生新业务记录）

```bash
# 更新证据链
curl -X PUT http://localhost:8080/api/v1/replacements/REP202405001/evidence \
  -H "Content-Type: application/json" \
  -d '{
    "evidence_type": "warranty_certificate",
    "evidence_value": "http://example.com/cert-v2.pdf",
    "file_url": "http://example.com/cert-v2.pdf",
    "operator": "张工"
  }'
```

### 单条追溯 & 汇总下载

```bash
# 单条追溯
curl http://localhost:8080/api/v1/trace/REP202405001

# 汇总报告
curl http://localhost:8080/api/v1/warranty-reports/summary

# 导出质保报告
curl -OJ http://localhost:8080/api/v1/warranty-reports/{report_id}/export

# 查看质保报告列表
curl http://localhost:8080/api/v1/warranty-reports
```

### 列表查询

```bash
# 逆变器列表
curl http://localhost:8080/api/v1/inverters

# 故障码列表
curl http://localhost:8080/api/v1/fault-codes

# 备件列表
curl http://localhost:8080/api/v1/spare-parts

# 厂家工单列表
curl http://localhost:8080/api/v1/factory-orders

# 更换记录列表
curl http://localhost:8080/api/v1/replacements
```

## 轻量自检

访问 `http://localhost:8080/self-check` 可查看：
- 数据库连接状态
- 各表数据统计
- 重复序列号检测
- 未验收记录提醒
- 健康评分

## 响应格式说明

所有接口统一响应格式：

```json
{
  "success": true,
  "message": "操作成功",
  "data": { ... }
}
```

失败响应：

```json
{
  "success": false,
  "error": "错误信息"
}
```

## 数据库表结构

- `inverters` - 逆变器信息
- `fault_codes` - 故障码配置
- `spare_parts` - 备件信息
- `factory_orders` - 厂家工单
- `replacements` - 更换记录
- `replacement_status_logs` - 状态流转日志
- `warranty_reports` - 质保报告
- `evidence_chain` - 证据链
