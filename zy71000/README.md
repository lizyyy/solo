# 手术器械批号隔离 API

手术室护士长月底复盘工具 - 解决器械包批号和消毒记录追踪系统

## 功能特性

- ✅ **原始材料接收**：器械包批号、消毒炉次、手术间、领用护士、隔离原因
- 🧫 **消毒记录录入**：炉次、批号、消毒器、起止时间、结果、温压力等
- 🚦 **智能校验**：迟交检测、跨房间检测、重复提交检测、临时换包标记
- 🔬 **消毒炉次校验**：存在性校验、合格性校验、批号匹配校验（直接参与判定）
- 📋 **隔离单管理**：自动生成、状态追踪、判定历史记录
- ⚠️ **重复放行拦截**：已放行单据禁止重复操作
- 🔍 **批号追踪**：同批号跨手术间使用追踪
- 📊 **消毒炉次追踪**：按炉次关联所有隔离单和消毒记录
- 📤 **报告导出**：CSV格式隔离报告导出（含消毒验证信息）
- 🧪 **人工复核**：支持放行、驳回、补证三种操作，消毒校验未通过时警告

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/api/health

### 3. 造测试数据

```bash
python seed_data.py
```

## API 接口示例

### 提交原始材料

```bash
curl -X POST "http://localhost:8000/api/raw-materials/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "BATCH-2024-001",
    "sterilization_cycle": "CYCLE-A001",
    "operating_room": "手术室1",
    "receiving_nurse": "张护士",
    "isolation_reason": "临时换包，纸单补录",
    "submission_time": "2024-05-20T15:30:00",
    "surgery_time": "2024-05-20T14:00:00",
    "supplementary_info": "术中发现包装破损"
  }'
```

### 获取隔离单列表

```bash
curl "http://localhost:8000/api/isolation-orders/?status=pending"
```

### 人工复核 - 放行

```bash
curl -X POST "http://localhost:8000/api/decisions/" \
  -H "Content-Type: application/json" \
  -d '{
    "isolation_order_id": 1,
    "decision_type": "approve",
    "conclusion": "同意放行，补充证据充分",
    "reason": "消毒记录完整，批号可追溯",
    "operator": "李护士长",
    "supplementary_evidence": "消毒炉次记录查询正常"
  }'
```

### 人工复核 - 驳回

```bash
curl -X POST "http://localhost:8000/api/decisions/" \
  -H "Content-Type: application/json" \
  -d '{
    "isolation_order_id": 1,
    "decision_type": "reject",
    "conclusion": "驳回，需补充材料",
    "reason": "缺少消毒记录佐证",
    "operator": "李护士长"
  }'
```

### 人工复核 - 补证

```bash
curl -X POST "http://localhost:8000/api/decisions/" \
  -H "Content-Type: application/json" \
  -d '{
    "isolation_order_id": 1,
    "decision_type": "supplement",
    "conclusion": "补充材料",
    "reason": "等待领用护士补充说明",
    "operator": "李护士长",
    "supplementary_evidence": "需要补充换包审批单照片"
  }'
```

### 批号追踪

```bash
curl "http://localhost:8000/api/batch-trace/BATCH-2024-001"
```

### 消毒炉次追踪

```bash
curl "http://localhost:8000/api/sterilization-trace/CYCLE-A001"
```

### 导出隔离报告

```bash
curl "http://localhost:8000/api/export/report" -o isolation_report.csv
```

## 失败路径示例

### 重复提交同一材料（只会返回已存在的有效记录

```bash
curl -X POST "http://localhost:8000/api/raw-materials/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "BATCH-2024-001",
    "sterilization_cycle": "CYCLE-A001",
    "operating_room": "手术室2",
    "receiving_nurse": "王护士",
    "isolation_reason": "再次提交",
    "submission_time": "2024-05-21T10:00:00",
    "surgery_time": "2024-05-20T14:00:00"
  }'
```

**预期响应**：
```json
{
  "status": "duplicate",
  "message": "同一份材料已存在隔离单，同一批号+炉次只保留一条有效记录",
  "existing_order": {
    "order_no": "ISO-20240520-XXXXXX",
    "status": "pending",
    "final_conclusion": null,
    "latest_decision": "..."
  }
}
```

### 重复放行拦截

```bash
# 先放行一次
curl -X POST "http://localhost:8000/api/decisions/" \
  -H "Content-Type: application/json" \
  -d '{
    "isolation_order_id": 1,
    "decision_type": "approve",
    "conclusion": "同意放行",
    "reason": "材料齐全",
    "operator": "李护士长"
  }'

# 再次尝试放行（会失败）
curl -X POST "http://localhost:8000/api/decisions/" \
  -H "Content-Type: application/json" \
  -d '{
    "isolation_order_id": 1,
    "decision_type": "approve",
    "conclusion": "再次放行",
    "reason": "重复操作",
    "operator": "李护士长"
  }'
```

**预期响应**：
```json
{
  "detail": "重复放行拦截：该隔离单已放行，无需重复操作"
}
```

## 轻量自检

运行自检脚本，自动验证核心功能：

```bash
python self_check.py
```

自检内容：
1. 服务启动检查
2. 提交原始材料（正常路径）
3. 重复提交检测
4. 迟交检测
5. 跨房间使用检测
6. 放行/驳回/补证操作
7. 重复放行拦截
8. 报告导出

## 数据模型

- **InstrumentPackage**: 器械包（批号、消毒炉次）
- **IsolationOrder**: 隔离单（核心业务对象）
- **DecisionRecord**: 判定记录（每次复核历史）
- **UsageRecord**: 使用记录（跨房间追踪）
- **SterilizationRecord**: 消毒记录

## 判定说明

| 标记 | 触发条件 |
|------|----------|
| is_late_submission | 提交时间 > 手术时间 |
| cross_room_usage | 同批号在多个手术间使用 |
| temp_package_change | 隔离原因包含"临时换包"或"换包" |

| 状态流转

| 操作 | 目标状态 |
|------|----------|
| 新建 | pending |
| approve（放行） | released |
| reject（驳回） | rejected |
| supplement（补证） | pending |
