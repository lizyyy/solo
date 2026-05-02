# Interview Bias Audit

面试评分偏见审计工具 - 用于检测招聘面试评分中的异常模式。

## 功能特性

- **评分尺度漂移检测**: 识别同一岗位评分标准不一致的情况
- **轮次冲突检测**: 检测同一候选人不同面试轮次评分差异过大
- **证据缺失检测**: 标记高分/低分但缺少能力证据的情况
- **同名多岗检测**: 发现同名候选人出现在不同岗位的情况
- **空备注检测**: 标记没有面试备注的候选人
- **理由聚类**: 使用 TF-IDF 聚类面试官常用理由

## 安装

```bash
pip install -e .
```

## 使用方法

### 基本用法

```bash
interview-bias-audit audit \
  --candidates sample_data/candidates.csv \
  --notes sample_data/interview_notes.jsonl \
  --rules sample_data/score_rules.yaml \
  --competency-dict sample_data/competency_dict.yaml \
  --output-dir ./output
```

### Demo 模式（使用示例数据）

```bash
python -m interview_bias_audit.cli \
  --candidates sample_data/candidates.csv \
  --notes sample_data/interview_notes.jsonl \
  --rules sample_data/score_rules.yaml \
  --competency-dict sample_data/competency_dict.yaml \
  --output-dir ./output
```

## 输入文件格式

### candidates.csv

```csv
candidate_id,name,position,score,interview_round,interviewer
C001,张三,后端开发,85,1,李明
```

必需字段: `candidate_id`, `name`, `position`, `score`

### interview_notes.jsonl (JSON Lines)

```json
{"candidate_id": "C001", "candidate_name": "张三", "position": "后端开发", "round": 1, "score": 85, "notes": "技术基础扎实..."}
```

### score_rules.yaml

```yaml
thresholds:
  high_score: 85.0
  low_score: 50.0
  scale_drift_std: 15.0
  round_conflict_diff: 20.0
```

### competency_dict.yaml

```yaml
competencies:
  技术基础:
    keywords:
      - 算法
      - 数据库
  问题解决能力:
    keywords:
      - 逻辑思维
      - 分析能力
```

## 输出文件

- **bias_audit.md**: 详细审计报告
- **review_flags.csv**: 问题标记 CSV 文件
- **score_map.html**: 可视化评分地图（浏览器打开）

## 项目结构

```
interview_bias_audit/
├── parser/          # 解析模块 (CSV, JSONL, YAML)
├── features/        # 特征提取与聚类 (TF-IDF)
├── engine/          # 规则引擎与偏见检测
├── reports/         # 报告生成 (MD, CSV, HTML)
├── cli/             # CLI 参数解析
└── sample_data/    # 示例数据
```

## 运行测试

```bash
pytest tests/ -v
```

## 许可证

MIT
