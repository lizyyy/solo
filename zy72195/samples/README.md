# 样本数据目录

## 目录结构
```
samples/
├── model_logs/          # 模型输出日志（按版本分目录）
│   ├── v1.0/
│   └── v2.0/
├── annotations/         # 人工标注表
├── thresholds/          # 阈值配置
├── conflicts/           # 已知冲突案例
└── notes/               # 人工备注补录
```

## 文件格式说明

### 模型输出日志 (model_logs/*.jsonl)
每行一条JSON记录：
```json
{
  "record_id": "REC001",
  "model_version": "v1.0",
  "original_text": "张三的手机号是13800138000",
  "masked_text": "张*的手机号是138****8000",
  "detected_entities": [
    {"type": "name", "start": 0, "end": 2, "value": "张三", "level": "partial_mask"},
    {"type": "phone", "start": 8, "end": 19, "value": "13800138000", "level": "partial_mask"}
  ]
}
```

### 标注表 (annotations/*.csv)
| record_id | sensitive_type | start_pos | end_pos | original_value | expected_level | comment |
|-----------|----------------|-----------|---------|----------------|----------------|---------|
| REC001    | name           | 0         | 2       | 张三           | partial_mask   | 姓名脱敏 |

### 阈值配置 (thresholds/*.yaml)
```yaml
thresholds:
  - sensitive_type: phone
    precision_threshold: 0.95
    recall_threshold: 0.9
    f1_threshold: 0.92
    description: "手机号要求高准确率"
```
