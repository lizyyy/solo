# 客服话术质检工作台

基于 TF-IDF 相似度和规则引擎的本地客服对话智能质检系统。

## 功能特性

- **多格式数据导入**：支持 JSONL 对话、YAML 政策知识库、CSV 历史抽检记录
- **智能意图聚类**：使用 TF-IDF + KMeans/DBSCAN 自动按意图聚类会话
- **多维度风险检测**：
  - 🔴 **旧政策话术**：检测客服是否使用了过期政策
  - 🟡 **答非所问**：检测客服回复与用户问题相关性
  - 🔴 **编造条款引用**：检测客服引用不存在的政策条款
  - 🔴 **政策版本冲突**：检测知识库中的版本冲突
- **人工确认**：支持质检员对检测结果进行确认/忽略
- **报告导出**：导出 `risks.csv` 风险清单和 `report.md` 详细报告

## 边界情况处理

### 1. 短句无法聚类
- 系统会自动识别词数不足阈值（默认 5 词）的短句
- 短句会话会被单独列出，标记为"需人工复核"
- 支持自定义短句阈值

### 2. 政策版本冲突
- 支持多版本政策管理
- 自动检测同一政策的版本重叠问题
- 标记生效时间冲突，提醒管理员

## 项目结构

```
.
├── app.py                 # Streamlit 主应用
├── requirements.txt       # 依赖包
├── src/
│   ├── __init__.py
│   ├── data_parser.py     # 数据解析模块
│   ├── text_features.py   # 文本特征/聚类模块
│   ├── risk_detector.py   # 风险判定模块
│   └── storage.py         # 存储/导出模块
├── sample_data/           # 示例数据
│   ├── conversations.jsonl  # 客服对话示例
│   ├── policies.yaml        # 政策知识库示例
│   └── inspection_history.csv # 历史抽检记录
└── tests/                # 测试文件
    └── test_basic.py
```

## 快速开始

### 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 本地启动

```bash
# 启动 Streamlit 应用
streamlit run app.py
```

启动后浏览器会自动打开 `http://localhost:8501`

### 使用流程

1. **数据导入**标签页：
   - 上传 `conversations.jsonl`（客服对话）
   - 上传 `policies.yaml`（政策知识库）
   - 可选上传历史抽检记录

2. **运行分析**标签页：
   - 调整聚类数量、相似度阈值等参数
   - 点击"开始分析"

3. **查看结果**：
   - **聚类分析**：查看按意图分组的会话
   - **风险检测**：查看检测到的风险，可人工确认
   - **对话查询**：搜索和查看具体对话

4. **导出结果**标签页：
   - 生成并下载 `risks.csv`
   - 生成并下载 `report.md`

### 测试运行

```bash
# 运行最小测试
python -m pytest tests/ -v

# 或者直接运行测试文件
python tests/test_basic.py
```

## 数据格式说明

### 1. 对话数据 (JSONL)

每行一个 JSON 对象：

```json
{
  "session_id": "conv_001",
  "agent_id": "agent_01",
  "customer_id": "cust_101",
  "start_time": "2024-06-15 10:30:00",
  "messages": [
    {"role": "user", "content": "你好，我想咨询一下退款政策是什么样的？"},
    {"role": "assistant", "content": "您好！根据我们的退款政策，您在收到商品后的15天内可以申请无理由退款。"}
  ]
}
```

### 2. 政策知识库 (YAML)

```yaml
policies:
  - clause_id: REFUND_POLICY
    version: "2.0"
    category: "退款政策"
    content: "根据最新退款政策，用户在收到商品后的7天内可以申请无理由退款..."
    keywords: ["退款", "7天", "无理由"]
    effective_date: "2024-06-01"
    is_active: true
```

### 3. 历史抽检记录 (CSV)

```csv
record_id,session_id,risk_types,risk_level,confirmed,inspector,inspection_time,comments
r001,conv_002,OLD_POLICY,high,True,张质检,2024-06-15 16:00:00,确认使用旧政策话术
```

## 输出文件说明

### risks.csv

包含所有检测到的风险，字段包括：
- `risk_id`: 风险唯一标识
- `session_id`: 关联会话ID
- `risk_type`: 风险类型
- `risk_level`: 风险等级（high/medium/low）
- `description`: 风险描述
- `evidence`: 证据详情
- `confidence`: 置信度
- `confirmed`: 是否已确认
- `inspector_notes`: 质检员备注

### report.md

完整的质检报告，包含：
1. 执行概览（统计数据）
2. 意图聚类分析（各聚类详情）
3. 短句/无法聚类会话列表
4. 风险检测结果（按类型/等级）
5. 处理建议
6. 附录说明

## 风险检测规则

### 旧政策话术 (OLD_POLICY)
- 检测客服回复中是否包含已过期政策的关键词
- 或文本相似度超过阈值匹配旧政策内容
- 对比当前最新版本与引用版本

### 答非所问 (IRRELEVANT_ANSWER)
- 计算用户问题与客服回复的 TF-IDF 余弦相似度
- 相似度低于阈值且关键词无重叠时触发
- 关键词重叠数量小于 1 时触发

### 编造条款引用 (FABRICATED_CLAUSE)
- 正则匹配客服回复中的条款引用模式（如"第5.2条"、"条款XX"等）
- 检查引用内容是否存在于政策知识库中
- 不在知识库中的引用标记为风险

### 政策版本冲突 (VERSION_CONFLICT)
- 解析政策时检查同一 base_id 的多个版本
- 检测生效时间是否重叠
- 标记为系统级风险

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `n_clusters` | 自动 | 聚类数量（0=自动计算） |
| `similarity_threshold` | 0.3 | 相似度阈值 |
| `min_word_count` | 5 | 短句阈值（词数） |
| `use_dbscan` | False | 使用 DBSCAN 自动聚类 |

## 注意事项

1. **本地运行**：所有数据仅在本地处理，不上传服务器
2. **中文分词**：使用 jieba 进行中文分词，首次运行可能需要下载词典
3. **内存优化**：处理大量数据（>10000条）时，建议分批处理
4. **政策版本**：建议政策 YAML 中使用 `effective_date` 和 `expiry_date` 管理版本有效期

## 许可证

MIT License
