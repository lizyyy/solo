# 银行网点尾箱调拨复核工具

## 快速启动

```bash
cd bank_tailbox
python3 app.py
# 浏览器打开 http://localhost:5000
```

## 放样例数据

1. 打开页面 → 点击「导入数据」
2. 选 CSV 文件，选来源类型（银行回单/业务台账/截图说明/补充材料）
3. 选重复策略：
   - **跳过**：遇到相同记录直接忽略，不覆盖
   - **更新**：新值覆盖旧值，自动记录变更
   - **标记冲突**：两边数据不一致时标红，等人工判断
4. 点导入

样例 CSV 已在 `sample_data/` 目录：
- `bank_receipt_sample.csv` — 银行回单（5条）
- `ledger_sample.csv` — 业务台账（4条，和回单有金额/经办人差异，会触发冲突）
- `supplement_sample.csv` — 补充材料（3条，含1条与回单金额不一致）

CSV 列头要求：
```
transfer_date,from_branch,to_branch,amount,currency,operator,transfer_type,voucher_no,approval_email_ref
```

## 重跑（清空重来）

```bash
rm -f data/tailbox.db
python3 models.py   # 重新建库
python3 app.py      # 再启动
```

## 差异报告在哪看

- **页面**：首页 → 「批次比对」→ 选两个批次 → 比对
- **页面**：首页 → 「冲突处理」→ 查看未解决冲突
- **导出**：
  - 「全量导出」→ 下载 `尾箱调拨全量报告.csv`
  - 「冲突导出」→ 下载 `冲突差异报告.csv`
  - 批次详情页 → 「导出本批次CSV」

## 冲突处理逻辑

当审批邮件里的说法和导入数据不一致时：
- 系统不会自动拍板，而是把**邮件侧值**和**导入侧值**及各自来源摆出来
- 每个冲突给出建议动作（如"核实银行回单"、"查审批邮件"）
- 人工选择：采纳导入值 / 采纳邮件值 / 人工复核
- 所有判断都记录操作人、时间和依据，别人接手不用再问

## 补材料

导入时勾选「这是补充材料」，选择要补充的批次。新数据会关联到原批次，且标注来源和补充关系。

## 项目结构

```
bank_tailbox/
├── app.py              # Flask 主程序
├── models.py           # 数据库模型和初始化
├── importer.py         # 导入逻辑（去重/更新/冲突检测）
├── conflict.py         # 冲突证据链和处理
├── exporter.py         # 导出报告和差异比对
├── templates/          # 前端页面
├── sample_data/        # 样例 CSV
└── data/               # SQLite 数据库（运行后生成）
```
