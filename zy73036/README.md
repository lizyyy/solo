# 流浪动物救助异常提醒

> 给宠物训练师 **阿岑** 的一整套工具：
> - 自动对齐运营主管交来的「体重曲线」（字段名前后不一也能扛）
> - 抓住「新旧记录对不上 / 单位混写 / 字段缺失」
> - 点异常能一键回到 **体重曲线 + 本次计算口径**
> - 人工确认时写清 **为什么卡住 / 下一步找谁补**
> - 改判后历史里能看到 **旧材料 / 新备注 / 改判原因**
> - 导出的异常队列 **口径和屏幕完全一致**

---

## 目录结构

```
.
├── rescue_anomaly.py              # 主入口（CLI，Python 3.8+ 即可，零第三方依赖跑通 CSV/JSON）
├── config/
│   ├── field_mapping.json         # 字段名适配表（体重/重量/Weight/weight → 统一 weight_kg）
│   └── system_config.json         # 单位换算表、阈值、责任角色、导出配置
├── core/                          # 核心模块
│   ├── models.py                  # 数据模型：WeightRecord / AnomalyRecord / HistoryChange / WeightCurveSnapshot
│   ├── field_mapper.py            # 字段名映射 + 来源追踪
│   ├── unit_normalizer.py         # 单位归一化 + 混写识别 + 卡住提示
│   ├── weight_curve.py            # 导入 + 曲线构建（每只宠物一条，带回溯）
│   ├── anomaly_engine.py          # 异常检测 / 确认单位 / 改判 / 历史留存
│   ├── data_loader.py             # 读 CSV / JSON / XLSX（可选 openpyxl）
│   └── exporter.py                # CSV/XLSX/JSON 导出 + 筛选口径元信息
├── data_incoming/                 # 运营主管交来的材料（示例）
│   ├── 运营主管_历史体重记录_202605.csv
│   ├── 主人补充材料_橘座_P001_202606.csv
│   ├── 运营_新批次体重_字段不同.xlsx.csv
│   └── _说明_这是运营主管交来的材料包.txt
└── output/                        # 产物目录（运行后自动生成）
```

---

## 阿岑的快速上手（按顺序跑）

> 环境：macOS / Linux 自带 Python3 即可。Windows 装了 Python3 也行。
> 想导出 XLSX 可选装：`pip3 install openpyxl`（没装也没关系，会自动降级为 CSV）

### 第 1 步：加载材料 + 自动跑异常检测

```bash
cd /Users/maca/pro/solo/workspaces/zy73036
python3 rescue_anomaly.py load
```

你会看到：
- 每一份材料加载成功几条
- **异常总数 / 按类型分布 / 按处理状态分布**
- 输出目录里的文件清单（体重曲线.json、异常队列.json、记录明细.csv）

### 第 2 步：查看异常队列（屏幕上筛）

```bash
# 看全部
python3 rescue_anomaly.py queue

# 只看「单位混写」类的，责任人是「运营主管」
python3 rescue_anomaly.py queue --type "单位混写" --responsible "运营主管"

# 只看「数据冲突待核」状态，交给「宠物训练师」（就是阿岑你）
python3 rescue_anomaly.py queue --status "数据冲突待核" --responsible "宠物训练师"

# 只看 P001 橘座的异常
python3 rescue_anomaly.py queue --pet-id P001

# 同时导出 Excel（装了 openpyxl 的话）
python3 rescue_anomaly.py queue -f xlsx
```

每一条异常都会显示：
- **卡住原因**（红字）
- **下一步怎么做 / 找谁补**（绿字）
- **曲线跳转索引**（`pet=P001#points[i,j]` 能直接定位到哪两个点）
- **本次计算口径**（为什么判定为异常）
- **来源文件 / 行号**（保住来源）
- **处理状态**（保住处理状态）

### 第 3 步：点异常 → 回到曲线 + 计算口径

```bash
# anomaly_id 不用写全，写前 8 位就行
python3 rescue_anomaly.py detail <异常ID前8位>
```

这里能看到：
1. 异常详情（卡住原因 / 下一步 / 责任人）
2. **整条体重曲线**，关联点会标红 ◄──
3. **计算口径**（体重骤变阈值 30%、日期冲突判定公式）
4. **变更历史**（改判过才会有）

### 第 4 步：人工处理

#### 4.1 确认单位（单位混写/缺失）— 找运营主管核完之后跑

```bash
python3 rescue_anomaly.py confirm-unit <异常ID> kg \
    --operator 阿岑 \
    --remark "已和运营主管核对原始单据，确认单位是kg"
```

系统会：
- 按确认后的单位重新计算体重（换算成 kg）
- 写入 **变更历史**（旧值 → 新值、改判原因、旧备注、新备注）
- 更新异常状态为「已解决」

#### 4.2 改判结论（新旧记录冲突）— 阿岑到现场复核之后跑

```bash
# 例：橘座 4/30 主人回忆 4.5 实际确认是 5.4kg（主人记错）
python3 rescue_anomaly.py revise <异常ID> "主人回忆值不准，现场复核值5.4kg为准" \
    --reason "主人记忆偏差，现场复核与救助站历史一致" \
    --new-weight-kg 5.4 \
    --operator 阿岑 \
    --remark "2026-06-09 现场用同型号电子秤再次称重"
```

系统会：
- 记录 **旧材料 / 新备注 / 改判原因** 到变更历史
- 覆盖涉及记录的体重值（如有 --new-weight-kg）
- 异常状态变「已改判」

### 第 5 步：导出（屏幕口径 = 文件口径）

```bash
# 把当前屏幕上的筛选结果（和 queue 命令一模一样）导出
python3 rescue_anomaly.py export \
    --status "数据冲突待核" \
    --responsible "宠物训练师" \
    -f csv

# 全量导出
python3 rescue_anomaly.py export
```

> **口径一致性承诺**：
> - 屏幕上 `queue --xxx` 筛出来 N 条，`export --xxx` 导出来也是 N 条，顺序一致。
> - 导出来的 `.csv.filters.json`（或 xlsx 的「筛选口径」sheet）会把当时的筛选条件写下来，别另起一套。

### 第 6 步：随时看曲线

```bash
# 看所有宠物的曲线
python3 rescue_anomaly.py curve

# 看 P004 毛豆的曲线（看看那个骤降 6.0kg 的点在哪里）
python3 rescue_anomaly.py curve --pet-id P004
```

### 快速一眼总览

```bash
python3 rescue_anomaly.py summary
```

---

## 接住的那些坑（一一对应你提的需求）

| 你的需求 | 系统怎么接 |
|---|---|
| 字段名前后不一（体重/重量/Weight/weight/BodyWeight 等） | `config/field_mapping.json` + `FieldMapper` 做归一化，每一条保留 **原始字段名 + 原始值** |
| 单位混写 | `UnitNormalizer` 自动识别 kg/g/斤/lb/公斤/千克/克/磅 等，冲突/缺失一律 **卡成「需确认单位」** |
| 人工确认提示写清为什么卡住 + 找谁 | 每条异常固定字段：`block_reason`（为什么卡）、`next_step`（怎么做）、`responsible_role`（角色）、`responsible_contact`（联系方） |
| 点异常回到体重曲线 + 这次计算口径 | `detail` 命令把同 pet 的曲线打出来，关联点标红；每条异常保存 `weight_curve_ref` + `calc_formula` |
| 补录后结论变化 → 历史里看旧材料 + 新备注 + 改判原因 | `HistoryChange` 把 old_values / new_values / revision_reason / old_remark / new_remark / previous_conclusion / new_conclusion / source_materials_ref 全存 |
| 导出别另起一套口径 | `anomaly_queue_to_dicts(filters)` 是唯一数据源，`queue` 和 `export` 共用；另写 `.filters.json` 留痕 |
| 保住来源 + 处理状态 | 每条 `WeightRecord` 带 source_file / source_row / data_source / processing_status |
| README 知道先跑哪条再看什么 | 上面的 **阿岑的快速上手** 1~6 步 |

---

## 配置说明

- 要加新的字段别名？改 [config/field_mapping.json](config/field_mapping.json)
- 要改阈值（体重骤变 30% → 20%？）、单位换算、责任角色？改 [config/system_config.json](config/system_config.json)

---

## 输出产物一览（output/ 目录）

| 文件 | 说明 |
|---|---|
| 异常队列.json / 异常队列.csv / 异常队列.xlsx | **主产物**：当前所有异常 |
| 异常队列筛选.csv / .xlsx | 你在 `queue` 或 `export` 里加了筛选条件后的结果 |
| 体重曲线.json | 每只宠物的曲线点 + 趋势 + 计算说明 |
| 体重记录明细.csv | 所有原始入站记录（带回溯字段） |
| 变更历史.csv / 变更历史.json | 每次「确认单位 / 改判」的留痕 |
| *.filters.json | 对应导出文件当时的筛选口径（给审计用） |
