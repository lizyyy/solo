# 质检主管可追踪后端服务

一个给质检主管使用的后端服务，聚焦「可追踪」和「可解释」：
- 把 **质检 CSV**、**录音摘要 JSON**、**申诉单** 接进来形成可追踪的记录
- 支持 **新增批次 / 标记处理 / 退回修改 / 二次复核 / 放行 / 驳回 / 撤销扣分 / 成绩回写**，每次都把 **原因 / 处理人 / 时间** 写入事件日志
- 重启后可按 **坐席工号 / 扣分项 / 复核人** 查询历史
- **导出明细数量 = 查询结果数量**
- 复核人可从 `trace` 接口一路追到来源（批次名、导入行号、每次变更的处理人+原因）

## 启动

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

打开 http://127.0.0.1:8000/docs 查看接口文档。

## 核心流程

1. **新建批次**：`POST /api/v1/batches`
2. **导入数据**：
   - 质检 CSV：`POST /api/v1/batches/{id}/import/csv`
   - 录音摘要 JSON：`POST /api/v1/batches/{id}/import/json`
   - 申诉单 CSV：`POST /api/v1/batches/{id}/import/appeal`
3. **处理记录**：
   - 标记处理：`POST /api/v1/items/{id}/mark-processing`
   - 退回修改：`POST /api/v1/items/{id}/return`
   - 二次复核：`POST /api/v1/items/{id}/second-review`
   - 放行：`POST /api/v1/items/{id}/approve`
   - 驳回：`POST /api/v1/items/{id}/reject`
   - 撤销扣分：`POST /api/v1/items/{id}/cancel-deduction`
   - 成绩回写：`POST /api/v1/items/{id}/score-writeback`
4. **查询历史**：
   - 条件查询：`POST /api/v1/items/query`（支持 `agent_id / deduction_item / reviewed_by / status / batch_id / keyword`）
   - 单条来源追踪：`GET /api/v1/items/{id}/trace`（包含事件日志 + 申诉单，复核人可看到完整链路）
5. **导出**：
   - 批量导出：`POST /api/v1/exports/items/csv`（body = 查询条件，导出数量 === 查询结果数量）
   - 单条追踪导出：`GET /api/v1/exports/items/{id}/trace/csv`

## CSV/JSON 字段约定

质检 CSV 支持列：`agent_id, agent_name, category, deduction_item, deduction_score, original_score, final_score, call_date, call_id, recording_summary, note`。

录音摘要 JSON 支持两种格式：
- 数组：`[{...}, {...}]`
- 对象：`{"items": [...]}` 或 `{"records": [...]}`

申诉单 CSV 要求列：`item_id, appellant, content, evidence...`（除前 3 列外的列会被合并到 `evidence` JSON）。

## 可解释性

每条记录的 `/trace` 返回完整事件序列（按 `seq` 排序），质检主管可以据此向别人说明：
- 这条记录来自哪个批次、第几行（来源）
- 每一步是谁处理的、基于什么原因做了什么决定
- 为什么被 **放行 / 退回 / 要求补材料**
