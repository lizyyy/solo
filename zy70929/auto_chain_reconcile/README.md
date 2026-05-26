# 汽修连锁核销一致性 API

本项目把店长最头疼的「套餐 / 到店项目 / 配件库存」核销不一致问题抽出来，提供一个可本地复跑的 API。

## 功能
- 上传套餐 CSV、工单 JSON、配件库存 CSV，一次性核销。
- 按规则把结果分成 `normal` / `pending` / `failed` 三段返回。
- 失败项保留原始字段，并给出建议处理方式。
- 同一 `batch_key` 再次提交不会重复生效（幂等）。
- 覆盖规则：
  - **跨店核销**：套餐 `allowed_store` 不匹配当前门店 → failed。
  - **项目替换**：工单项目与套餐项目不在同一替代组 → pending（需店长确认）。
  - **库存扣减**：按批次 `inbound_date` 先进先出扣减，不足 → failed。
- 配件批次可追溯：`/api/v1/trace/part/{part_code}` 返回每个批次的入库日期、供应商、剩余数量及被哪些工单消耗。

## 安装与启动
```bash
cd auto_chain_reconcile
python3 -m pip install -e .
export PYTHONPATH=src
python3 -m uvicorn auto_chain_reconcile.main:app --reload
```

## 接口
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/reconcile/multipart` | 以表单文件上传（推荐） |
| POST | `/api/v1/reconcile/json` | 以 JSON 直接提交 |
| GET  | `/api/v1/trace/part/{part_code}` | 追溯配件批次来源 |
| GET  | `/api/v1/trace/order/{order_id}` | 查询单工单结果 |

## 本地复跑（一条命令）
```bash
bash examples/run_demo.sh
```

脚本会：启动服务 → 上传 `examples/` 下的示例数据 → 打印三段结果 → 追溯 `OIL_0W20` 历史批次 → 再次用同一批次号提交验证幂等。

## 示例数据要点
- `WO1001` 正常命中套餐与库存（normal）。
- `WO1002` 套餐是 `OIL_5W30`，工单开 `OIL_0W20`，命中替代组（pending）。
- `WO1003` 套餐限 `ST02`，但当前门店是 `ST01`（跨店，failed）。
- `WO1004` 工单一次消耗 999 桶机油（库存不足，failed）。

## 数据落盘
SQLite 文件：`auto_chain_reconcile/data/reconcile.db`。核心表：`reconcile_batch`、`package`、`work_order`、`inventory_batch`、`reconcile_result`。
