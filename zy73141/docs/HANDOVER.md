# 海草床调查异常预警 - 接手说明

> 按现场操作顺序写，接手人照做即可。

---

## 0. 第一次部署

```bash
cd /Users/maca/pro/solo/workspaces/zy73141
pip install -r requirements.txt
```

---

## 1. 样例放哪

### 样例目录
标准样例数据在：`data/samples/`

| 文件类型 | 命名规范 | 样例文件 |
|---------|---------|---------|
| 传感器数据 | `sensor_YYYYMMDD.csv` | `data/samples/sensor_20260615.csv` |
| 船上记录 | `ship_YYYYMMDD.csv` | `data/samples/ship_20260615.csv` |
| 遥感截图 | `remote_*_vN.png` | `data/samples/remote_seagrass_v1.png` (v<3为旧版) |
| 边界样本 | `boundary_*.csv` | `data/samples/boundary_sample_001.csv` |
| 口头备注 | `notes_YYYYMMDD.txt` | `data/samples/notes_20260615.txt` |

### 实际运行目录
把要分析的数据放到：`data/raw/`

```bash
# 想用样例测试的话，复制过去
cp data/samples/* data/raw/
```

---

## 2. 先启动（最常用）

### 基础命令
```bash
python run_seagrass_alert.py run --case-id CASE001 --operator 小宋 --conclusion "待复核" --save-history
```

### 参数说明（稳定不变，排班脚本直接用）
| 参数名 | 必填 | 说明 |
|-------|------|------|
| `--case-id` | 是 | 案例编号，如 CASE001 |
| `--operator` | 是 | 操作员姓名，如 小宋 |
| `--conclusion` | 是 | 复核结论，如"海草床异常"或"正常" |
| `--save-history` | 推荐 | 保存历史版本，方便后续追溯 |
| `--config` | 否 | 配置文件路径，默认 `config.yaml` |
| `--input-dir` | 否 | 输入目录，默认 `data/raw` |
| `--output-csv` | 否 | CSV输出路径，默认自动生成 |
| `--change-reason` | 补录用 | 改判原因 |
| `--new-notes` | 补录用 | 新增备注，可多个 |

### 启动后看什么
- 控制台会打印：总记录数、异常数、各异常类型分布
- **各数据源对结论的影响**：会明确标出哪个文件影响了结论
- **异常记录明细**：每条异常会标出来源、类型、影响

---

## 3. 出错能重跑

### 常见错误码（稳定不变）
| 错误码 | 含义 | 处理方法 |
|-------|------|---------|
| `[SEAGRASS_ERROR_001]` | 配置文件未找到 | 检查 `config.yaml` 是否在当前目录 |
| `[SEAGRASS_ERROR_002]` | 配置文件格式错误 | 检查 YAML 格式，注意缩进 |
| `[SEAGRASS_ERROR_003]` | 输入目录为空 | 检查 `data/raw/` 是否有数据文件 |
| `[SEAGRASS_ERROR_004]` | 缺少传感器数据 | 放入 `sensor_*.csv` 文件 |
| `[SEAGRASS_ERROR_005]` | CSV写入失败 | 检查 `output/csv/` 目录权限 |
| `[SEAGRASS_ERROR_006]` | 数据格式错误 | 检查CSV列名是否正确 |
| `[SEAGRASS_ERROR_007]` | 漂移检测失败 | 检查传感器数据是否有连续5条以上 |
| `[SEAGRASS_ERROR_008]` | 历史记录保存失败 | 检查 `data/history/` 目录权限 |

### 重跑命令
```bash
# 最简单的重跑（覆盖上次结果）
python run_seagrass_alert.py run --case-id CASE001 --operator 小宋 --save-history

# 指定输入目录重跑
python run_seagrass_alert.py run --input-dir data/raw --case-id CASE001 --operator 小宋 --save-history

# 补录数据后重跑（记录改判原因）
python run_seagrass_alert.py run \
  --case-id CASE001 \
  --operator 小宋 \
  --conclusion "海草床异常（补录后确认）" \
  --change-reason "补录了B区油污照片，确认异常" \
  --new-notes "B区油污照片已存档" "传感器校准完成" \
  --save-history
```

### 查看历史版本
```bash
# 查看所有案例
python run_seagrass_alert.py history list-cases

# 查看某案例的所有版本
python run_seagrass_alert.py history list-versions --case-id CASE001

# 查看某版本详情
python run_seagrass_alert.py history show --case-id CASE001 --version 1

# 比较两个版本的差异（看改判原因）
python run_seagrass_alert.py history compare \
  --case-id CASE001 \
  --version-old 1 \
  --version-new 2
```

---

## 4. 最后知道去哪看CSV明细

### CSV输出目录（固定不变）
```
output/csv/seagrass_alert_YYYYMMDD_HHMMSS.csv
```

### 查看命令
```bash
# 列出所有CSV明细
ls -lt output/csv/

# 查看最新的CSV
ls -lt output/csv/ | head -1

# 用Excel或Numbers打开，或直接看
cat output/csv/$(ls -t output/csv/ | head -1)
```

### CSV字段说明（稳定不变）
| 字段名 | 说明 |
|-------|------|
| `record_id` | 记录唯一编号 |
| `timestamp` | 时间戳 |
| `source_type` | 数据来源类型（传感器数据/船上记录/遥感截图/边界样本/口头备注） |
| `data_source` | 具体文件名 |
| `metric_name` | 指标名（temperature/salinity/turbidity等） |
| `metric_value` | 指标值 |
| `threshold` | 阈值 |
| `is_anomaly` | 是否异常（True/False） |
| `anomaly_type` | 异常类型（阈值超限/传感器漂移/遥感截图旧版/边界样本/船上记录滞后/备注提示） |
| `confidence` | 置信度 |
| `affected_conclusion` | 对结论的影响说明 |
| `notes` | 备注 |

---

## 5. 系统会区分的异常类型

系统会自动识别并标注，不用人工翻：

1. **阈值超限** - 温度>30℃、盐度<20或>40、浊度>50
2. **传感器漂移** - 滑动窗口检测，偏离过大标为异常，**不会默默放行**
3. **遥感截图旧版** - 文件名含_v1、_v2的会标出，建议用v3以上
4. **边界样本** - is_boundary=true的样本，需特别注意
5. **船上记录滞后** - 记录时间比传感器时间晚1小时以上
6. **备注提示** - 口头备注中的内容

> 每个异常都会标注 `affected_conclusion`，明确说明对结论的影响。

---

## 6. 快速上手三步

```bash
# 第一步：放数据
cp data/samples/* data/raw/

# 第二步：启动分析
python run_seagrass_alert.py run --case-id CASE001 --operator 小宋 --conclusion "待复核" --save-history

# 第三步：看CSV明细
ls -lt output/csv/
```

---

## 7. 排班脚本示例（crontab）

```bash
# 每天早上8点自动跑
0 8 * * * cd /Users/maca/pro/solo/workspaces/zy73141 && \
  python run_seagrass_alert.py run \
    --case-id "CASE$(date +\%Y\%m\%d)" \
    --operator "值班员" \
    --conclusion "自动运行待复核" \
    --save-history \
    >> logs/alert_$(date +\%Y\%m\%d).log 2>&1
```

> 参数名和错误提示保持稳定，脚本不用改。
