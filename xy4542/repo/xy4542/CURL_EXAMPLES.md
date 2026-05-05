# CURL 接口示例

> 本文档展示如何使用 curl 命令调用现金中心清分核对系统的所有 API 接口。

## 基础信息

- 服务地址: `http://localhost:8000`
- API 文档: `http://localhost:8000/docs`
- 营业日期示例: `2026-05-05`

---

## 一、系统检查

### 1.1 检查系统状态

```bash
curl -s "http://localhost:8000/" | python3 -m json.tool
```

### 1.2 健康检查

```bash
curl -s "http://localhost:8000/health" | python3 -m json.tool
```

---

## 二、数据导入接口

### 2.1 导入柜员缴款 CSV

```bash
curl -s -X POST "http://localhost:8000/import/teller-payment" \
  -F "file=@./data/teller_payments.csv" \
  -F "business_date=2026-05-05" \
  -F "operator=张主管" | python3 -m json.tool
```

### 2.2 导入清分机冠字号日志 CSV

```bash
curl -s -X POST "http://localhost:8000/import/sorting-log" \
  -F "file=@./data/sorting_logs.csv" \
  -F "business_date=2026-05-05" \
  -F "operator=刘管理员" | python3 -m json.tool
```

### 2.3 导入扎把标签 JSON

```bash
curl -s -X POST "http://localhost:8000/import/bundle-tag" \
  -F "file=@./data/bundle_tags.json" \
  -F "business_date=2026-05-05" \
  -F "operator=陈管理员" | python3 -m json.tool
```

### 2.4 导入 ATM 加钞计划 CSV

```bash
curl -s -X POST "http://localhost:8000/import/atm-plan" \
  -F "file=@./data/atm_plans.csv" \
  -F "business_date=2026-05-05" \
  -F "operator=ATM管理员" | python3 -m json.tool
```

### 2.5 导入差错备注 CSV

```bash
curl -s -X POST "http://localhost:8000/import/error-remark" \
  -F "file=@./data/error_remarks.csv" \
  -F "business_date=2026-05-05" \
  -F "operator=李主管" | python3 -m json.tool
```

---

## 三、风险检查与重算

### 3.1 执行风险重算

```bash
curl -s -X POST "http://localhost:8000/action/recalculate" \
  -F "business_date=2026-05-05" \
  -F "operator=系统管理员" | python3 -m json.tool
```

---

## 四、查询接口

### 4.1 查询统计信息

```bash
curl -s "http://localhost:8000/query/stats?business_date=2026-05-05" | python3 -m json.tool
```

### 4.2 查询风险预警列表

```bash
# 查询所有风险
curl -s "http://localhost:8000/query/risks?business_date=2026-05-05" | python3 -m json.tool

# 查询待复核的风险
curl -s "http://localhost:8000/query/risks?business_date=2026-05-05&is_reviewed=false" | python3 -m json.tool

# 查询已复核的风险
curl -s "http://localhost:8000/query/risks?business_date=2026-05-05&is_reviewed=true" | python3 -m json.tool

# 按严重程度查询（high/medium/low）
curl -s "http://localhost:8000/query/risks?business_date=2026-05-05&severity=high" | python3 -m json.tool
```

### 4.3 查询扎把列表

```bash
# 查询所有扎把
curl -s "http://localhost:8000/query/bundles?business_date=2026-05-05" | python3 -m json.tool

# 按柜员号查询
curl -s "http://localhost:8000/query/bundles?business_date=2026-05-05&teller_no=001" | python3 -m json.tool

# 按扎把编号模糊查询
curl -s "http://localhost:8000/query/bundles?business_date=2026-05-05&bundle_no=BD2026" | python3 -m json.tool

# 按来源查询（teller/atm）
curl -s "http://localhost:8000/query/bundles?business_date=2026-05-05&source=teller" | python3 -m json.tool

# 按状态查询（pending/verified/rejected）
curl -s "http://localhost:8000/query/bundles?business_date=2026-05-05&status=pending" | python3 -m json.tool
```

### 4.4 查询扎把详情

```bash
curl -s "http://localhost:8000/query/bundles/BD20260505001?business_date=2026-05-05" | python3 -m json.tool
```

### 4.5 查询柜员缴款汇总

```bash
curl -s "http://localhost:8000/query/tellers?business_date=2026-05-05" | python3 -m json.tool
```

### 4.6 查询 ATM 加钞计划

```bash
# 查询所有计划
curl -s "http://localhost:8000/query/atm-plans?business_date=2026-05-05" | python3 -m json.tool

# 按 ATM 编号查询
curl -s "http://localhost:8000/query/atm-plans?business_date=2026-05-05&atm_no=ATM001" | python3 -m json.tool
```

### 4.7 查询审计日志

```bash
# 查询所有日志
curl -s "http://localhost:8000/query/audit-logs?business_date=2026-05-05" | python3 -m json.tool

# 按操作类型查询
curl -s "http://localhost:8000/query/audit-logs?business_date=2026-05-05&operation_type=import_teller_payments" | python3 -m json.tool
```

---

## 五、复核操作

### 5.1 复核单个风险预警

```bash
# 确认风险
curl -s -X POST "http://localhost:8000/action/review/1" \
  -F "reviewer=张主管" \
  -F "decision=confirm" \
  -F "remark=经核实，确实存在重复入库情况，已通知相关柜员" | python3 -m json.tool

# 忽略风险
curl -s -X POST "http://localhost:8000/action/review/2" \
  -F "reviewer=李主管" \
  -F "decision=dismiss" \
  -F "remark=系统误报，实际为不同日期的数据" | python3 -m json.tool
```

### 5.2 批量复核风险预警

```bash
curl -s -X POST "http://localhost:8000/action/review/batch" \
  -F "alert_ids=1,2,3" \
  -F "reviewer=王主管" \
  -F "decision=dismiss" \
  -F "remark=批量复核，均为系统误报" | python3 -m json.tool
```

### 5.3 复核扎把状态

```bash
# 标记为已通过
curl -s -X POST "http://localhost:8000/action/verify-bundle/BD20260505001" \
  -F "business_date=2026-05-05" \
  -F "status=verified" \
  -F "reviewer=张主管" | python3 -m json.tool

# 标记为已驳回
curl -s -X POST "http://localhost:8000/action/verify-bundle/BD20260505002" \
  -F "business_date=2026-05-05" \
  -F "status=rejected" \
  -F "reviewer=李主管" | python3 -m json.tool
```

---

## 六、导出接口

### 6.1 导出 Markdown 交接单

```bash
# 获取交接单内容（JSON格式）
curl -s "http://localhost:8000/action/export/handover?business_date=2026-05-05" | python3 -m json.tool

# 直接下载文件
curl -s -OJ "http://localhost:8000/action/export/handover?business_date=2026-05-05&download=true"
```

### 6.2 导出 JSON 审计明细

```bash
# 获取审计明细内容（JSON格式）
curl -s "http://localhost:8000/action/export/audit?business_date=2026-05-05" | python3 -m json.tool

# 直接下载文件
curl -s -OJ "http://localhost:8000/action/export/audit?business_date=2026-05-05&download=true"
```

### 6.3 查询已导出文件列表

```bash
# 查询所有导出文件
curl -s "http://localhost:8000/action/export/list" | python3 -m json.tool

# 按营业日期过滤
curl -s "http://localhost:8000/action/export/list?business_date=2026-05-05" | python3 -m json.tool
```

### 6.4 下载导出文件

```bash
# 下载指定文件（替换 <filename> 为实际文件名）
curl -s -OJ "http://localhost:8000/action/export/download/<filename>"

# 示例
curl -s -OJ "http://localhost:8000/action/export/download/handover_2026-05-05_20260505180000.md"
```

---

## 七、完整业务流程示例

以下是一个完整的下班前清分核对业务流程：

```bash
#!/bin/bash

BASE_URL="http://localhost:8000"
BUSINESS_DATE="2026-05-05"
DATA_DIR="./data"

echo "=== 步骤1: 导入所有数据 ==="

# 导入柜员缴款
curl -s -X POST "${BASE_URL}/import/teller-payment" \
  -F "file=@${DATA_DIR}/teller_payments.csv" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=张主管"

# 导入清分机日志
curl -s -X POST "${BASE_URL}/import/sorting-log" \
  -F "file=@${DATA_DIR}/sorting_logs.csv" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=刘管理员"

# 导入扎把标签
curl -s -X POST "${BASE_URL}/import/bundle-tag" \
  -F "file=@${DATA_DIR}/bundle_tags.json" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=陈管理员"

# 导入ATM计划
curl -s -X POST "${BASE_URL}/import/atm-plan" \
  -F "file=@${DATA_DIR}/atm_plans.csv" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=ATM管理员"

# 导入差错备注
curl -s -X POST "${BASE_URL}/import/error-remark" \
  -F "file=@${DATA_DIR}/error_remarks.csv" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=李主管"

echo ""
echo "=== 步骤2: 执行风险检查 ==="
curl -s -X POST "${BASE_URL}/action/recalculate" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=系统管理员"

echo ""
echo "=== 步骤3: 查看风险预警 ==="
curl -s "${BASE_URL}/query/risks?business_date=${BUSINESS_DATE}&is_reviewed=false"

echo ""
echo "=== 步骤4: 复核风险（假设风险ID为1、2、3） ==="
# 确认风险1
curl -s -X POST "${BASE_URL}/action/review/1" \
  -F "reviewer=张主管" \
  -F "decision=confirm" \
  -F "remark=确认存在问题，已处理"

# 忽略风险2
curl -s -X POST "${BASE_URL}/action/review/2" \
  -F "reviewer=李主管" \
  -F "decision=dismiss" \
  -F "remark=系统误报"

echo ""
echo "=== 步骤5: 查看统计信息 ==="
curl -s "${BASE_URL}/query/stats?business_date=${BUSINESS_DATE}"

echo ""
echo "=== 步骤6: 导出交接单和审计明细 ==="
# 导出交接单
curl -s -OJ "${BASE_URL}/action/export/handover?business_date=${BUSINESS_DATE}&download=true"

# 导出审计明细
curl -s -OJ "${BASE_URL}/action/export/audit?business_date=${BUSINESS_DATE}&download=true"

echo ""
echo "=== 业务流程完成 ==="
echo "生成的文件："
ls -la handover_*.md audit_*.json 2>/dev/null || echo "无生成文件"
```

---

## 八、风险类型说明

系统能够识别以下风险类型：

| 风险编码 | 风险类型 | 严重程度 | 说明 |
|---------|---------|---------|------|
| R001 | 重复入库 | high | 同一扎把编号出现多次 |
| R002 | 柜员金额不平 | high | 柜员缴款记录金额与实际扎把金额不一致 |
| R003 | 冠字号断档 | medium | 同一扎把内的冠字号不连续 |
| R004 | ATM计划不匹配 | medium | ATM加钞计划金额与实际扎把金额不一致 |
| R005 | 扎把金额不一致 | high | 扎把主记录与标签记录金额不一致 |

---

## 九、常见问题

### Q1: 导入中文CSV时乱码怎么办？

确保CSV文件使用UTF-8编码保存。如果是Excel导出的CSV，可能需要转码：

```bash
# 使用 iconv 转码
iconv -f GBK -t UTF-8 input.csv > output.csv
```

### Q2: 如何查看完整的API文档？

启动服务后访问：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Q3: 数据库文件在哪里？

SQLite数据库文件位于项目根目录：`cash_center.db`

### Q4: 导出的文件在哪里？

导出的文件位于 `exports/` 目录下。
