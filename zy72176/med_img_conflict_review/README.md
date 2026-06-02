# 医学影像标注冲突复核工具

模型评测同事日常处理标注冲突时，模型输出、人工修正和线上反馈经常各算各的。本工具把三路数据对齐，自动检出冲突、分层统计、记录每条判定依据，支持补录备注并导出带原因的报告。

## 快速开始

```bash
cd med_img_conflict_review

# 1. 检查数据目录和文件是否就位
python cli.py init

# 2. 跑一轮冲突检测
python cli.py review

# 3. 筛指定模型版本
python cli.py review --model-version v2.1

# 4. 检测同时导出报告
python cli.py review --save-json report.json --save-csv report.csv

# 5. 给某条冲突补备注
python cli.py notes add --target-id <冲突ID> --operator 小孟 --content "经核实该结节确为良性"

# 6. 标记冲突已解决
python cli.py notes resolve --conflict-id <冲突ID> --resolution "采纳人工修正" --operator 小孟

# 7. 查看所有备注
python cli.py notes list

# 8. 导出报告
python cli.py export --format stratified --output final_report.json
```

## 数据目录与文件格式

所有数据放在 `data/` 目录下，共4个CSV文件。首行为列名，UTF-8编码。

### 放样本 — `data/samples.csv`

| 列名 | 含义 | 示例 |
|------|------|------|
| sample_id | 样本唯一ID | S001 |
| patient_id | 患者ID | P1001 |
| image_path | 影像路径 | /images/ct/lung/P1001_001.dcm |
| modality | 影像模态(CT/MRI/X-ray等) | CT |
| body_part | 检查部位 | lung |
| study_date | 检查日期 | 2025-10-12 |

### 切模型版本 — `data/model_outputs.csv`

同一样本可有多行（不同模型版本各一行），工具自动比对跨版本差异。

| 列名 | 含义 | 示例 |
|------|------|------|
| sample_id | 样本ID | S001 |
| model_version | 模型版本号 | v2.1 |
| predicted_label | 模型预测标签 | nodule_malignant |
| confidence | 置信度(0-1) | 0.87 |
| predicted_at | 预测时间 | 2025-10-13T09:15:00 |

用 `--model-version v2.2` 参数可只看某一版本的冲突，不传则全量检测。

### 人工修正 — `data/manual_corrections.csv`

| 列名 | 含义 | 示例 |
|------|------|------|
| sample_id | 样本ID | S001 |
| annotator_id | 标注员ID | A01 |
| corrected_label | 修正后标签 | nodule_benign |
| correction_reason | 修正原因 | v2.1误判恶性;影像边缘光滑无明显毛刺 |
| corrected_at | 修正时间 | 2025-10-14T16:30:00 |

### 线上反馈 — `data/online_feedback.csv`

| 列名 | 含义 | 示例 |
|------|------|------|
| sample_id | 样本ID | S001 |
| feedback_source | 反馈来源 | radiology_report |
| feedback_label | 反馈标签 | nodule_benign |
| feedback_note | 反馈备注 | 影像科报告:右肺上叶结节边界清晰考虑良性可能性大 |
| feedback_at | 反馈时间 | 2025-10-15T09:00:00 |

`feedback_source` 建议值: `radiology_report`(影像科报告)、`pathology_report`(病理报告)、`clinical_followup`(临床随访)。病理报告来源的冲突自动标记为高严重程度。

## 冲突类型说明

| 类型 | 含义 |
|------|------|
| model_vs_manual | 模型预测与人工修正不一致 |
| model_vs_online | 模型预测与线上反馈不一致 |
| manual_vs_online | 人工修正与线上反馈不一致 |
| multi_model_conflict | 同一样本不同模型版本预测不一致 |
| manual_disagreement | 多个标注员修正不一致 |

## 看冲突清单

`review` 命令输出含三层信息:

1. **分层统计**: 按严重程度(high/medium/low)、冲突类型、影像模态、模型版本分组计数
2. **冲突明细**: 每条冲突展示自动判定结论和完整证据链
3. **证据链**: 每个来源的标签、详情、时间戳，可直接溯源

严重程度自动判定逻辑:
- 模型置信度 > 0.85 且各方意见分歧大 → HIGH
- 线上反馈来源为病理报告 → 直接 HIGH
- 置信度 > 0.70 或存在分歧 → MEDIUM
- 其余 → LOW

## 备注补录

备注补录会自动记录:

- **原始来源**: 备注从哪来（手动补录 / 冲突解决 等）
- **处理时间**: 精确到毫秒的时间戳
- **差异说明**: 若涉及值变更，自动生成 `变更: '旧值' → '新值'` 或 `新增: '值'`

这样别人接手时不用再问为什么这么判。

## 导出报告

支持三种格式:

| 格式 | 命令参数 | 说明 |
|------|----------|------|
| CSV | `--format csv` | 扁平表，Excel可打开 |
| JSON | `--format json` | 含报告元数据的JSON |
| stratified | `--format stratified` | 按严重程度/类型/模态/版本分层的JSON，含备注记录 |

所有导出格式都带冲突原因和证据链，不会只在页面上闪一下。

## 交接说明

1. `output/audit_notes.json` 保存了所有备注和冲突解决记录，包含操作人、时间、变更详情
2. 每次跑 `review` 是幂等的（不依赖之前状态），但 `notes resolve` 会修改冲突的已解决状态
3. 换人处理时:
   - 看 `output/` 下的导出报告了解上一次检测结果
   - 看 `audit_notes.json` 了解每条冲突怎么判的、谁判的、什么时候判的
   - 如需重新检测，直接再跑 `review` 即可

## 项目结构

```
med_img_conflict_review/
├── cli.py                  # CLI入口
├── core/
│   ├── models.py           # 数据模型
│   ├── detector.py         # 冲突检测
│   ├── stratifier.py       # 样本分层
│   ├── auditor.py          # 备注与审计
│   └── exporter.py         # 报告导出
├── data/                   # 放CSV数据
└── output/                 # 导出报告和审计记录
```
