# 塔吊维保工单回放

FastAPI + SQLite 持久化的塔吊维保工单回放工具。工单提交去重、备注补录、截图版本、采样断档、人工改判和导出都通过 API 落库，刷新不丢。

## 启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8765
```

打开 `http://127.0.0.1:8765/`。

## 去重规则

相同 **工单号** + 相同 **停机窗口起始** + 相同 **备件批次**（排序拼接）的复核材料算同一条样本。重复提交只追加提交历史和时间线，汇总数量不翻倍。同一塔吊同一窗口但备件批次不同的材料会拆成不同样本。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/workorders` | 工单列表（`?status=confirmed&keyword=` 筛选） |
| GET | `/api/summary` | 汇总统计（已确认/待补件/退回/异常 + duplicated） |
| GET | `/api/abnormal` | 所有采样断档记录 |
| POST | `/api/workorders/submit` | 提交复核材料（去重、自动建时间线） |
| POST | `/api/workorders/{id}/parts/{pid}/remarks` | 追加备注版本 |
| POST | `/api/workorders/{id}/parts/{pid}/screenshots` | 追加截图版本 |
| POST | `/api/workorders/{id}/samplings` | 新增采样记录（断档自动标记） |
| PATCH | `/api/workorders/{id}/status` | 状态变更（待补件→已确认/退回） |
| POST | `/api/workorders/{id}/override` | 人工改判 |
| GET | `/api/workorders/{id}/history` | 时间线 + 版本历史 + 提交次数 |
| GET | `/api/export` | 导出完整 JSON 文件下载 |

## 页面指引

- **放材料**：顶部「+ 提交复核材料」按钮，填写工单号、塔吊、备件清单（含批次号）、采样记录、备注和截图
- **看异常**：左侧「⚠ 采样断档」Tab，断档记录独立于正常结果
- **看历史**：右侧「历史时间线」卡片，每次提交/补录/截图/状态/改判都有节点
- **重新导出**：顶部「重新导出」按钮，下载包含汇总、异常、去重说明、完整时间线和截图版本的 JSON
