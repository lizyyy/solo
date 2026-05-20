# 直播告警样本违规片段去重 CLI

用于合并直播告警样本中的重复违规片段，保留完整证据链，支持通过配置灵活调整去重规则。

## 功能特性

- **时间重叠检测**：检测同一直播流中时间重叠的同类违规片段
- **内容相似度检测**：基于文本相似度判断内容是否重复
- **模型重复检测**：检测同一模型在短时间内产生的重复告警
- **误报恢复处理**：标记并保留已确认的误报记录
- **证据链保留**：合并时保留所有原始告警的证据信息
- **配置驱动**：所有去重规则可通过配置文件调整，无需修改代码

## 快速开始

### 安装依赖

```bash
pip install pyyaml click rich
```

### 基本使用

```bash
# 使用默认配置运行去重
python live_alert_dedup.py run samples/live_alerts_sample.json

# 指定配置文件和输出
python live_alert_dedup.py run samples/live_alerts_sample.json \
    --config config/strict.yaml \
    --output output/result.json

# 对比不同配置的效果
python live_alert_dedup.py run samples/live_alerts_sample.json \
    --diff-config config/strict.yaml
```

### 其他命令

```bash
# 验证配置文件
python live_alert_dedup.py validate-config config/default.yaml

# 查看默认配置
python live_alert_dedup.py show-default-config
```

## 配置说明

### 去重规则配置

```yaml
deduplication:
  overlap:
    enabled: true                    # 是否启用重叠检测
    time_overlap_threshold: 5        # 时间重叠阈值(秒)
    content_similarity_threshold: 0.85  # 内容相似度阈值
    merge_strategy: merge_evidence   # 合并策略: keep_first | keep_longest | merge_evidence

  model_duplicate:
    enabled: true                    # 是否启用模型重复检测
    time_window: 300                 # 时间窗口(秒)
    confidence_diff_threshold: 0.1   # 置信度差异阈值

  false_positive_recovery:
    enabled: true                    # 是否启用误报恢复
    fp_marker_field: "is_false_positive"  # 误报标记字段
    keep_fp_with_marker: true        # 是否保留误报记录
```

### 字段映射配置

```yaml
fields:
  alert_id: "alert_id"           # 告警唯一ID
  stream_id: "stream_id"         # 直播流ID
  violation_type: "violation_type"  # 违规类型
  start_time: "start_time"       # 开始时间(时间戳)
  end_time: "end_time"           # 结束时间(时间戳)
  model_name: "model_name"       # 模型名称
  confidence: "confidence"       # 置信度
  content_summary: "content_summary"  # 内容摘要
  evidence_url: "evidence_url"   # 证据URL
  violation_level: "violation_level"  # 违规等级
```

## 输入输出格式

### 输入格式

支持 JSON 数组或 JSONL 格式：

```json
[
  {
    "alert_id": "ALERT-001",
    "stream_id": "STREAM-001",
    "violation_type": "涉政敏感词",
    "start_time": 1716200000,
    "end_time": 1716200015,
    "model_name": "sensitive_word_detection_v2",
    "confidence": 0.95,
    "content_summary": "主播在直播中提及敏感政治词汇",
    "evidence_url": "/evidence/STREAM-001/frame_1716200005.jpg",
    "violation_level": "严重"
  }
]
```

### 输出格式

```json
{
  "alerts": [
    {
      "alert_id": "ALERT-001",
      "stream_id": "STREAM-001",
      "violation_type": "涉政敏感词",
      "start_time": 1716200000,
      "end_time": 1716200025,
      "model_name": "sensitive_word_detection_v2",
      "confidence": 0.95,
      "evidence_chain": [
        {
          "alert_id": "ALERT-001",
          "model_name": "sensitive_word_detection_v2",
          "start_time": 1716200000,
          "end_time": 1716200015,
          "confidence": 0.95,
          "evidence_url": "/evidence/STREAM-001/frame_1716200005.jpg"
        },
        {
          "alert_id": "ALERT-002",
          "model_name": "sensitive_word_detection_v2",
          "start_time": 1716200010,
          "end_time": 1716200025,
          "confidence": 0.92,
          "evidence_url": "/evidence/STREAM-001/frame_1716200015.jpg"
        }
      ],
      "deduplication_info": {
        "merge_type": "overlap_merge",
        "merged_count": 2,
        "merged_alert_ids": ["ALERT-001", "ALERT-002"],
        "merge_timestamp": "2024-05-20T12:00:00"
      }
    }
  ],
  "statistics": {
    "total_input": 10,
    "total_output": 6,
    "overlap_merged": 3,
    "model_duplicates_removed": 0,
    "false_positives_recovered": 1
  },
  "deduplication_version": "1.0.0",
  "config_used": {
    "overlap_enabled": true,
    "model_duplicate_enabled": true,
    "fp_recovery_enabled": true,
    "merge_strategy": "merge_evidence"
  }
}
```

## 项目结构

```
.
├── config/
│   ├── default.yaml          # 默认配置
│   └── strict.yaml           # 严格模式配置
├── samples/
│   └── live_alerts_sample.json  # 样例数据
├── expected_outputs/        # 期望输出文件
├── src/
│   ├── __init__.py
│   ├── config.py            # 配置加载模块
│   ├── deduplicator.py      # 核心去重逻辑
│   └── cli.py               # CLI入口
├── tests/                   # 测试文件
├── live_alert_dedup.py      # 主入口
└── README.md
```

## 运行测试

```bash
pytest tests/ -v
```
