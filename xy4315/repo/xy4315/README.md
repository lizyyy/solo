# 重复投诉归并复核台

社区热线督导智能分析工具，使用本地文本相似度/聚类算法自动归并重复投诉事件，支持督导复核、标注责任部门、导出周报和派单建议。

## 功能特性

- 📊 **智能聚类**：使用 TF-IDF + 余弦相似度 + DBSCAN 聚类算法自动归并相似投诉
- 🏘️ **街道分组**：同一街道优先归并，时间 proximity 增强（7天内）
- 🔍 **多维度相似度**：综合文本内容、街道匹配、关键词匹配、紧急程度
- 👆 **手动调整**：支持督导拆分/合并事件簇，标注责任部门
- 📝 **状态管理**：完整的复核状态追踪（待复核、复核中、已确认、已指派等）
- 📄 **导出功能**：Markdown 周报、CSV 派单建议、JSON 数据导出
- 💾 **会话持久化**：自动保存会话，支持历史记录查看和恢复

## 项目结构

```
xy4315/
├── backend/                    # 后端代码
│   ├── __init__.py
│   ├── app.py                  # Flask 应用入口
│   ├── config.py               # 配置文件
│   ├── api/
│   │   └── routes.py           # API 路由
│   └── modules/
│       ├── parser.py           # 数据解析模块
│       ├── feature_extractor.py # 特征提取和相似度计算
│       ├── cluster.py          # 聚类引擎
│       ├── storage.py          # 状态存储
│       └── exporter.py         # 导出模块
├── frontend/                   # 前端代码
│   ├── index.html              # 主页面
│   └── static/
│       ├── css/
│       │   └── style.css       # 样式文件
│       └── js/
│           └── app.js          # 前端逻辑
├── data/                       # 数据目录
│   ├── sample_complaints.csv   # 示例投诉数据
│   ├── sample_workorders.json  # 示例工单数据
│   ├── sample_keywords.csv     # 示例关键词表
│   ├── uploads/                # 上传文件目录
│   ├── storage/                # 会话存储目录
│   └── exports/                # 导出文件目录
├── tests/                      # 测试文件
│   ├── test_parser.py          # 解析模块测试
│   └── test_cluster.py         # 聚类模块测试
├── requirements.txt            # Python 依赖
├── run.py                      # 启动脚本
└── README.md                   # 本文档
```

## 安装步骤

### 环境要求

- Python 3.8+
- pip

### 安装依赖

```bash
# 进入项目目录
cd xy4315

# 安装 Python 依赖
pip install -r requirements.txt
```

## 快速开始

### 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5000` 启动。

### 验证流程

#### 1. 访问界面

打开浏览器访问 `http://localhost:5000`，看到"重复投诉归并复核台"界面。

#### 2. 上传示例数据

项目提供了示例数据用于测试，位于 `data/` 目录下：

- **投诉摘要 CSV**：`data/sample_complaints.csv`（20条投诉记录）
- **工单结果 JSON**：`data/sample_workorders.json`（5条工单记录）
- **街道关键词表**：`data/sample_keywords.csv`（6个街道的关键词）

点击左侧"数据上传"区域的三个模块，分别上传对应的示例文件。

#### 3. 运行聚类分析

上传投诉数据后，"开始聚类分析"按钮变为可用，点击按钮执行聚类。

预期结果：
- 20条投诉应被归并为约7-9个事件簇
- 相似投诉应被正确归并（如阳光花园施工噪音、幸福小区停车问题等）
- 统计面板显示事件簇数、投诉数、紧急事件数、待复核数

#### 4. 查看事件簇详情

点击任意事件簇卡片，右侧详情面板显示：
- 基本信息（编号、投诉数、街道、紧急程度、状态）
- 相似性分析（置信度、相似原因、关键词）
- 代表摘要
- 投诉列表
- 派单信息和复核备注

#### 5. 执行复核操作

在详情面板中可以执行以下操作：
- **变更状态**：将状态改为"复核中"、"已确认"等
- **指派部门**：选择或输入责任部门
- **添加备注**：记录复核意见
- **拆分簇**：将多投诉的事件簇拆分为多个

#### 6. 多选合并

点击"多选模式"按钮，勾选多个事件簇后点击"合并选中"。

#### 7. 导出数据

点击顶部右侧导出按钮：
- **导出周报**：生成 Markdown 格式的周报
- **派单建议**：生成 CSV 格式的派单建议
- **导出JSON**：导出完整的聚类数据

#### 8. 运行单元测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 或单独运行特定测试
python -m pytest tests/test_parser.py -v
python -m pytest tests/test_cluster.py -v
```

## 数据格式说明

### 投诉摘要 CSV

必需字段：
| 字段名 | 说明 | 示例 |
|--------|------|------|
| 投诉编号 | 唯一标识 | CP001 |
| 来电时间 | 来电日期时间 | 2024-05-01 09:30:00 |
| 居民姓名 | 投诉人姓名 | 张三 |
| 联系电话 | 联系电话 | 13800138001 |
| 所属街道 | 街道名称 | 朝阳区 |
| 投诉摘要 | 投诉内容文本 | 小区夜间施工噪音 |
| 紧急程度 | 紧急/高/普通 | 紧急 |

### 工单结果 JSON

字段说明：
```json
[
  {
    "工单编号": "WO001",
    "关联投诉编号": "CP001",
    "创建时间": "2024-05-01 10:00:00",
    "派单部门": "城管部门",
    "处理人": "王队长",
    "处理结果": "已联系施工单位",
    "工单状态": "处理中"
  }
]
```

### 街道关键词表 CSV

第一列为街道名称，后续列为该街道的关键词：

| 街道 | 关键词1 | 关键词2 | 关键词3 |
|------|---------|---------|---------|
| 朝阳区 | 施工噪音 | 物业收费 | 电梯故障 |
| 海淀区 | 停车位 | 消防通道 | 物业 |

## API 接口说明

### 基础路径

所有 API 路径前缀为 `/api`

### 健康检查

```
GET /api/health
```

### 文件上传

```
POST /api/upload/complaints   # 上传投诉 CSV
POST /api/upload/workorders   # 上传工单 JSON
POST /api/upload/keywords     # 上传关键词 CSV
```

### 聚类分析

```
POST /api/cluster
Body: {
  "complaints": [...],     // 投诉列表
  "work_orders": [...],    // 工单列表（可选）
  "street_keywords": {...} // 街道关键词（可选）
}
```

### 聚类查询

```
GET /api/clusters?status=xxx&district=xxx&urgency=xxx
```

### 单个聚类操作

```
GET    /api/clusters/<cluster_id>           # 获取详情
PUT    /api/clusters/<cluster_id>/status    # 更新状态
PUT    /api/clusters/<cluster_id>/assign    # 指派部门
POST   /api/clusters/<cluster_id>/notes     # 添加备注
POST   /api/clusters/<cluster_id>/split     # 拆分簇
```

### 合并操作

```
POST /api/clusters/merge
Body: { "cluster_ids": ["CL0001", "CL0002"] }
```

### 统计信息

```
GET /api/statistics
```

### 会话管理

```
GET  /api/sessions              # 列出所有会话
GET  /api/sessions/<session_id> # 加载指定会话
```

### 导出功能

```
GET /api/export/weekly-report       # 导出 Markdown 周报
GET /api/export/dispatch-suggestions # 导出 CSV 派单建议
GET /api/export/clusters-json       # 导出 JSON 数据
```

## 聚类算法说明

### 相似度计算

系统使用多维度综合相似度评分：

- **文本相似度** (60%)：基于 TF-IDF + 余弦相似度
- **街道匹配** (25%)：同一街道 +1.0，不同街道 +0.3
- **关键词匹配** (15%)：基于街道关键词表的匹配程度
- **紧急程度加成**：均为紧急时 ×1.1

### 聚类规则

1. **按街道分组**：首先按街道将投诉分组
2. **时间 proximity**：7天内的投诉相似度阈值降低20%
3. **DBSCAN 风格聚类**：基于相似度矩阵进行密度聚类
4. **代表摘要选择**：选择包含关键词最多、长度最长的摘要作为代表

### 置信度说明

| 置信度区间 | 颜色标识 | 说明 |
|------------|----------|------|
| ≥ 80% | 绿色 | 高度相似 |
| 65% - 80% | 黄色 | 中等相似 |
| < 65% | 红色 | 相似度较低 |

## 常见问题

### Q: 如何调整相似度阈值？

修改 `backend/config.py` 中的 `SIMILARITY_THRESHOLD` 参数（默认 0.65）。

### Q: 支持哪些日期时间格式？

系统自动识别以下格式：
- `%Y-%m-%d %H:%M:%S`
- `%Y/%m/%d %H:%M:%S`
- `%Y-%m-%d`
- `%Y/%m/%d`
- `%Y年%m月%d日 %H:%M:%S`
- `%Y年%m月%d日`

### Q: 数据存储在哪里？

- 会话数据：`data/storage/sessions/`
- 上传文件：`data/storage/uploads/`
- 导出文件：`data/storage/exports/`

## 技术栈

- **后端**：Python + Flask
- **前端**：HTML + CSS + JavaScript（原生）
- **NLP**：jieba（中文分词）+ scikit-learn（TF-IDF、余弦相似度）
- **数据处理**：pandas + numpy

## 许可证

MIT License
