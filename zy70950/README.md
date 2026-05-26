# 体检中心对账服务 (Reconciliation Service)

一个偏后端的 HTTP 服务，把「导入 → 自动比对 → 人工复核 → 重新计算 → 报告下载」串起来，
用于把客户现场加项（CSV）、体检套餐（JSON）、单位协议（JSON）三方核对，并能解释
每一条差异的来源（券叠加 / 退项冲正 / 单位限额 等）。

## 运行

```bash
pip install -r requirements.txt
python -m recon.main
```

默认监听 `http://127.0.0.1:8000`，Swagger 在 `/docs`。

## 主要流程

1. `POST /sessions` 创建对账会话
2. `POST /sessions/{id}/import/additions` 导入加项 CSV
3. `POST /sessions/{id}/import/packages`   导入套餐 JSON
4. `POST /sessions/{id}/import/agreements` 导入单位协议 JSON
5. `POST /sessions/{id}/match`            自动比对，生成每条明细的差异说明
6. `POST /sessions/{id}/review`           人工复核（放行 / 退回 / 补材料）
7. `POST /sessions/{id}/recalc`           复核改动后重新计算、同步汇总
8. `GET  /sessions/{id}/summary`          汇总
9. `GET  /sessions/{id}/details`          单条明细 → 最终报告的全链路
10. `GET /sessions/{id}/report.csv`       下载对账报告

## 设计要点

- 每一条加项明细在内部保有 `trace_id`，从导入 → 比对 → 复核 → 报告 全程可追溯；
- 差异解释以 `reason_codes` + `human_readable` 同时输出，便于财务同事向业务方说明；
- 复核产生的 `adjustment_amount` 会在重新计算后同步到 detail / summary / report；
- 券叠加、退项冲正、单位限额都能作为差异来源被解释。
