# 游戏匹配胜率校准

校准游戏匹配中的玩家胜率，保留完整判断过程、原始来源和处理时间，让后续接手的人不用再问"这条为什么这么判"。

## 快速开始

```bash
cd winrate_calibration

# 用样例数据运行
python main.py sample_data.csv

# 指定输出路径
python main.py sample_data.csv output/calibrated.csv output/exceptions.csv
```

运行后会在 `output/` 目录生成：
- `calibrated.csv` — 全量校准结果（含顺利、低置信度、旧口径、需人工确认的所有记录）
- `exceptions.csv` — 异常清单（仅含需人工确认和置信度不足的记录）

## 输入格式

CSV 文件，字段名不需要统一。程序会自动识别以下别名：

| 标准字段 | 可识别的列名 |
|---|---|
| 局编号 | `match_id`, `局编号`, `对局ID`, `局ID`, `match_id(旧)` |
| 玩家ID | `player_id`, `玩家ID`, `用户ID`, `player_id(旧表)` |
| 原始胜率 | `raw_winrate`, `原始胜率`, `胜率`, `win_rate`, `胜率(未校准)` |
| 对局数 | `match_count`, `对局数`, `场次`, `games_played`, `对局数(业务表)` |
| 对手平均胜率 | `avg_opponent_winrate`, `对手平均胜率`, `对手胜率`, `opp_wr` |
| 技能差 | `skill_gap`, `技能差`, `段位差`, `skill_diff` |
| 来源 | `source`, `来源`, `数据来源`, `src` |
| 备注 | `notes`, `备注`, `乱备注`, `说明`, `备注(参数表)` |
| 校准口径 | `calibration_method`, `校准方式`, `口径`, `校准口径`, `旧口径` |
| 旧校准胜率 | `old_calibrated_winrate`, `旧校准胜率`, `历史校准值`, `校准后胜率(旧)` |

备注列里的"乱备注"（如 `!!数据缺失待补!!旧表编号#33`）会原样保留，不会为了整齐被洗掉。

## 输出说明

输出 CSV 在原始字段基础上追加以下列：

| 追加列 | 说明 |
|---|---|
| `calibrated_winrate` | 校准后的胜率值 |
| `calibration_status` | 校准状态，见下表 |
| `judgment_process` | 判断过程，用 `|` 分隔每一步及其原因 |
| `data_source` | 原始数据来源 |
| `processed_at` | 处理时间（UTC ISO 格式） |
| `skip_reason` | 跳过原因（仅无法计算的记录有此列） |
| `original_fields_json` | 原始字段名和值的完整快照 |

### 校准状态含义

| 状态 | 含义 |
|---|---|
| `calibrated` | 校准完成，对局数充足（>=30），置信度可靠 |
| `calibrated_low_confidence` | 校准完成但对局数不足30局，结果已向0.5回归，建议达到30局后复算 |
| `calibrated_unknown_confidence` | 校准完成但缺少对局数，无法评估置信度 |
| `calibrated_from_old` | 原始胜率缺失，使用旧口径校准值作为结果 |
| `needs_manual_review` | 无法自动校准，需人工确认 |

## 怎么看异常清单

打开 `exceptions.csv`，重点看三列：

1. **`calibration_status`** — 为什么进了异常清单
2. **`skip_reason`** — 具体原因（如"原始胜率无法解析且无旧口径值"）
3. **`judgment_process`** — 程序走到了哪一步、在哪里卡住了

补齐材料后，把该记录的新数据填回输入 CSV 重新运行即可，`original_fields_json` 保留了上次的原始值，可以对比。

## 校准逻辑说明

1. **置信度回归**：对局数 < 30 时，校准胜率 = 30% × 原始胜率 + 70% × 0.5，向均值回归以降低小样本过拟合风险
2. **对手强度修正**：对手平均胜率偏离 0.5 时，按偏差的 20% 调整，面对强对手时上调、面对弱对手时下调
3. **技能差修正**：段位差按 5% 比例调整，正差（被低估）上调
4. **裁剪**：最终胜率限制在 [0.05, 0.95] 范围内

每一步修正的原因都写在 `judgment_process` 里。

## 样例数据说明

`sample_data.csv` 包含三条记录：

- **M-1001**：顺利记录 — 原始胜率0.62，150局，对手平均0.55，技能差0.3
- **M-1002**：需人工确认 — 原始胜率写的是"N/A"，仅8局，备注里有乱备注
- **M-1003**：旧口径补录 — 原始胜率缺失，但参数表里有旧口径校准值0.57

运行后可以对比三条记录的 `judgment_process` 列，看清楚每条是怎么判的。
