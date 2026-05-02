# 客服录音质检工具

一个本地离线的客服录音质检小工具，用于分析通话转写数据，识别质检问题。

## 功能特性

- 开场白缺失检测
- 承诺时效矛盾检测
- 敏感词命中检测
- 长时间静默检测
- 可筛选的 Streamlit 可视化页面
- 支持导出 Markdown/CSV 复盘报告

## 项目结构

```
call_quality_tool/
├── data_loader/          # 数据加载模块
│   ├── call_data_loader.py
│   ├── rule_loader.py
│   └── sensitive_word_loader.py
├── rule_engine/          # 规则引擎模块
│   ├── opening_detector.py
│   ├── promise_detector.py
│   ├── sensitive_word_detector.py
│   ├── silence_detector.py
│   └── quality_engine.py
├── metrics_agg/          # 指标聚合模块
│   └── aggregator.py
├── ui/                   # 页面模块
│   └── app.py
├── exporter/             # 导出模块
│   ├── markdown_exporter.py
│   └── csv_exporter.py
├── sample_data/          # 样例数据
│   ├── sample_transcripts.json
│   ├── quality_rules.yaml
│   └── sensitive_words.txt
├── tests/                # 测试用例
│   └── test_boundary_cases.py
└── README.md
```

## 安装依赖

```bash
pip install streamlit pandas pyyaml pytest
```

## 运行方式

### 启动 Streamlit 界面

```bash
cd call_quality_tool
streamlit run ui/app.py
```

### 配置文件说明

1. **通话转写 JSON** - 格式示例：
```json
{
  "call_id": "call_001",
  "agent_id": "agent_001",
  "agent_name": "张三",
  "transcript": [
    {"speaker": "agent", "start_time": 0, "end_time": 5, "text": "您好..."}
  ]
}
```

2. **质检规则 YAML** - 包含开场白规则、承诺规则、静默规则

3. **敏感词表 TXT** - 每行一个敏感词，以 `#` 开头的行视为注释

## 测试

```bash
cd call_quality_tool
pytest tests/test_boundary_cases.py -v
```

## 导出报告

在 Streamlit 界面点击相应按钮可导出：
- Markdown 报告：包含概览、坐席表现、违规详情
- CSV 报告：包含所有违规记录的详细信息