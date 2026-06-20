# 工厂管线异常归因 · FastAPI 后端

安全员老唐和运营主管共用的"工厂管线异常归因"系统。

- 数据持久化：SQLite（`pipeline_anomaly.db`），服务重启后历史备注、状态全部可读回
- 状态映射统一：接口返回的 `status_for_export` 与 `attributions/queue-export` 导出的异常队列 `状态` 字段完全一致
- 备件型号替换不会立刻按"正常"放过，会停留在**待确认**并单独列出 `待确认理由` 和 `受影响记录`
- 月底复核按**已确认 / 待补件 / 退回**分组

## 文件结构

| 文件 | 说明 |
|---|---|
| `models.py` | 数据模型 + 状态枚举 + `STATUS_EXPORT_MAPPING` 统一映射表 |
| `database.py` | SQLite 表结构 + 四个 Repo（备件/报警/备注/归因） |
| `service.py` | 业务服务：归因主流程、月底复核、一致性校验、型号替换待确认 |
| `seed_data.py` | 服务启动时注入样例备件/报警/备注（幂等，重启不重复写） |
| `app.py` | FastAPI 入口 |
| `api_test.py` | 按老唐接班路径跑一遍接口级端到端验证 |
| `verify.py` | 不启动服务的纯类方法验证脚本（已存在，可继续使用） |

## 启动

```bash
cd /Users/maca/pro/solo/workspaces/zy73064

# 1. 安装依赖
pip3 install -r requirements.txt

# 2. 启动服务
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

启动后：

- 服务根路径：<http://127.0.0.1:8000/>
- 交互文档（Swagger UI）：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/health>
- 一致性校验：<http://127.0.0.1:8000/consistency>

## 老唐接班流程（按顺序调接口）

```bash
export BASE=http://127.0.0.1:8000

# 1. 查看已预置的备件/报警/备注（启动时已 seed）
curl -s $BASE/parts
curl -s $BASE/alarms
curl -s $BASE/notes

# 2. 也可以自己再 POST 一条备件 / 报警 / 备注
curl -s -X POST $BASE/parts -H 'content-type: application/json' -d '{
  "part_no": "SP-USER-0001",
  "part_name": "法兰",
  "part_model": "DN50-PN16",
  "expected_model": "DN50-PN16",
  "quantity": 3,
  "pipeline_id": "PL-B01"
}'

# 3. 跑归因主流程（正常记录会产出 正常 状态；型号替换/关联不匹配会停在 待确认）
curl -s -X POST $BASE/attributions/run -H 'content-type: application/json' -d '{
  "part_no": "SP-API-0001",
  "operator": "老唐",
  "attribution_reason": "工艺调整"
}'

curl -s -X POST $BASE/attributions/run -H 'content-type: application/json' -d '{
  "part_no": "SP-API-0002",
  "operator": "老唐"
}'

# 4. 月底复核：把 3 条样例归因分流到 已确认 / 待补件 / 退回
#    （先拿到上面 POST 返回的 attr_no，再调 confirm）

# 5. 查询归因明细 —— 字段含 status + status_for_export（与导出一致）
curl -s $BASE/attributions/details

# 6. 导出异常队列 —— "状态"列与明细里的 status_for_export 相同
curl -s $BASE/attributions/queue-export

# 7. 型号替换待确认清单（单独列出待确认理由+受影响记录）
curl -s $BASE/attributions/model-replace-pending

# 8. 月底复核分组
curl -s $BASE/attributions/monthly-review

# 9. 一致性校验（接口状态 ↔ 导出队列状态；主表 ↔ 明细 ↔ 队列）
curl -s $BASE/consistency
```

## 状态一致性说明

所有状态从同一个枚举 `AttributionStatus` 映射：

| 内部状态 | `status` / 接口明细 | `status_for_export` / 队列导出"状态" |
|---|---|---|
| `PENDING_CONFIRM` | 待确认 | 待确认 |
| `CONFIRMED` | 已确认 | 已确认 |
| `PENDING_PART` | 待补件 | 待补件 |
| `RETURNED` | 退回 | 退回 |
| `NORMAL` | 正常 | 正常 |

接口 `GET /consistency` 会自动校验：

- 明细里的 `status_for_export` 是否与映射表一致
- 异常队列导出的"状态"列是否与映射表一致
- 归因主表 ↔ 归因明细 ↔ 导出队列三方计数与状态一致

## 接口端到端验证

服务启动后，另开一个终端执行：

```bash
cd /Users/maca/pro/solo/workspaces/zy73064
python3 api_test.py
```

脚本会按"备件清单 → 报警 → 备注 → 归因主流程 → 月底分流 → 查明细 → 导出队列 → 月底复核分组 → 一致性校验"完整跑一遍，并断言：

- 正常备件归因后状态 = 正常
- 型号替换归因后状态 = 待确认，并带有 `pending_reason` 和 `affected_records`，且出现在 `model-replace-pending` 接口
- 月底复核后，"已确认/待补件/退回"三组数量都 ≥ 1
- `attributions/details` 每条的 `status_for_export` 与 `queue-export` 对应记录的"状态"完全相等
- 重启服务后再调一次 `notes` 和 `monthly-review`，数据不丢失

## 重启持久化验证

1. 跑一遍 `python3 api_test.py`
2. `Ctrl + C` 停掉 uvicorn
3. 再次 `uvicorn app:app --host 127.0.0.1 --port 8000`
4. 打开 <http://127.0.0.1:8000/notes> 仍然能看到老唐写过的人工备注
5. 打开 <http://127.0.0.1:8000/attributions/monthly-review> 仍然能看到三组归因记录
