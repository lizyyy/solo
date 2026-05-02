# 选题素材去重和分组助手

本地运行的选题素材管理工具，使用 TF-IDF/余弦相似度算法自动检测重复灵感，分组主题，管理素材状态。

## 功能特性

- 📂 **文件扫描**: 自动扫描目录下的 `.txt` 和 `.md` 文件
- 🔍 **智能去重**: 使用 TF-IDF + 余弦相似度检测近似重复（非完全相同）
- 📊 **主题分组**: 自动聚类生成主题组，提取关键词标签
- 📝 **状态管理**: 支持标记"待写"、"已用"、"先搁置"，状态持久化保存
- 📤 **多格式导出**: 生成 Markdown 选题看板和 JSON 明细

## 项目结构

```
zy1016/
├── content_deduplicator/     # 核心模块
│   ├── __init__.py
│   ├── reader.py             # 文件读取解析器
│   ├── vectorizer.py         # 文本向量化和相似度计算
│   ├── clusterer.py          # 重复检测和主题分组
│   ├── state_manager.py      # 状态管理（JSON持久化）
│   ├── exporter.py           # 导出器（Markdown/JSON）
│   └── cli.py                # 命令行入口
├── examples/                 # 示例素材
│   ├── 公众号灵感.txt
│   ├── 短视频灵感.md
│   └── 小红书素材.txt
├── tests/                    # 测试文件
├── pyproject.toml            # 项目配置
└── README.md
```

## 安装

### 环境要求

- Python 3.9+
- pip

### 安装步骤

1. 克隆或下载项目到本地

2. 进入项目目录，安装依赖：

```bash
pip install -e .
```

或使用 pip 安装开发模式：

```bash
pip install scikit-learn numpy click jieba
```

## 快速开始

### 1. 准备素材

将你的灵感素材以 `.txt` 或 `.md` 文件格式放在一个文件夹中，每行一个想法。

示例素材在 `examples/` 目录下：

```
examples/
├── 公众号灵感.txt
├── 短视频灵感.md
└── 小红书素材.txt
```

### 2. 扫描素材

使用 `scan` 命令扫描素材目录：

```bash
content-dedup scan examples/
```

或指定输出目录：

```bash
content-dedup scan examples/ --output-dir output/
```

### 3. 查看输出

扫描完成后，输出目录会包含：

- `topics_board.md`: 选题看板（Markdown 格式）
- `materials_detail.json`: 详细数据（JSON 格式）
- `.material_state.json`: 状态存储文件（隐藏文件）

### 4. 管理状态

使用 `status` 命令标记素材状态：

```bash
# 标记为待写
content-dedup status --output-dir output/ --id <素材ID> --status pending

# 标记为已用
content-dedup status --output-dir output/ --id <素材ID> --status used

# 标记为先搁置
content-dedup status --output-dir output/ --id <素材ID> --status shelved
```

### 5. 列出素材

使用 `list` 命令查看所有素材及状态：

```bash
# 列出所有素材
content-dedup list --output-dir output/

# 只列出待写的素材
content-dedup list --output-dir output/ --status pending

# 只列出已用的素材
content-dedup list --output-dir output/ --status used
```

### 6. 检查重复

使用 `check-dup` 命令快速检查重复素材：

```bash
content-dedup check-dup examples/
```

## 命令详解

### scan 命令

```bash
content-dedup scan SOURCE_DIR [OPTIONS]
```

**参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `SOURCE_DIR` | 素材源目录（必需） | - |
| `--output-dir, -o` | 输出目录 | 源目录下的 `.dedup_output` |
| `--similarity-threshold, -t` | 相似度阈值（0.0-1.0） | 0.7 |
| `--min-length, -l` | 素材最小字符长度 | 5 |
| `--n-topics, -n` | 主题数量（自动估计如果未指定） | 自动 |
| `--preserve-status/--no-preserve-status` | 是否保留历史状态 | 保留 |
| `--verbose, -v` | 显示详细输出 | 否 |

**示例：**

```bash
# 基本用法
content-dedup scan ./my-materials/

# 严格模式（更高的相似度阈值）
content-dedup scan ./my-materials/ -t 0.85

# 指定主题数量
content-dedup scan ./my-materials/ -n 5

# 显示详细信息
content-dedup scan ./my-materials/ -v
```

### status 命令

```bash
content-dedup status --output-dir DIR --id ID --status STATUS [OPTIONS]
```

**参数：**

| 参数 | 说明 |
|------|------|
| `--output-dir, -o` | 输出目录（必需） |
| `--id` | 素材 ID（必需） |
| `--status, -s` | 状态：`pending/待写`, `used/已用`, `shelved/先搁置`, `unset` |
| `--notes, -n` | 备注信息 |

**示例：**

```bash
# 标记为待写
content-dedup status -o output/ --id abc123 --status pending

# 标记为已用并添加备注
content-dedup status -o output/ --id def456 --status used --notes "已发布于 2024-01-15"
```

### list 命令

```bash
content-dedup list --output-dir DIR [OPTIONS]
```

**参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--output-dir, -o` | 输出目录（必需） | - |
| `--status, -s` | 筛选状态：`all`, `pending`, `used`, `shelved`, `unset` | `all` |

**示例：**

```bash
# 列出所有素材
content-dedup list -o output/

# 列出待写的素材
content-dedup list -o output/ -s pending
```

### check-dup 命令

```bash
content-dedup check-dup SOURCE_DIR [OPTIONS]
```

**参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `SOURCE_DIR` | 素材源目录（必需） | - |
| `--similarity-threshold, -t` | 相似度阈值 | 0.7 |
| `--min-length, -l` | 素材最小字符长度 | 5 |
| `--top-n, -n` | 显示前 N 对相似素材 | 10 |

**示例：**

```bash
# 检查重复
content-dedup check-dup examples/

# 更严格的检查
content-dedup check-dup examples/ -t 0.9
```

## 算法说明

### 文本处理流程

1. **文件读取**: 扫描 `.txt` 和 `.md` 文件，按行解析
2. **文本清理**: 去除 Markdown 符号、多余空格
3. **中文分词**: 使用 jieba 进行中文分词
4. **停用词过滤**: 过滤无意义的常用词

### 相似度计算

- **向量化方法**: TF-IDF (Term Frequency - Inverse Document Frequency)
- **相似度度量**: 余弦相似度 (Cosine Similarity)
- **阈值**: 默认 0.7，可通过 `-t` 参数调整

### 主题聚类

- **算法**: K-Means 聚类
- **主题数估计**: 使用轮廓系数 (Silhouette Score) 自动估计最佳主题数

## 输出文件说明

### Markdown 选题看板 (`topics_board.md`)

包含以下内容：

1. **概览统计**: 总素材数、主题组数、重复簇数、状态统计
2. **按主题分组**: 每个主题下的素材列表，标记重复簇
3. **未分组素材**: 无法归类到任何主题的素材
4. **按状态分类**: 按"待写"、"已用"、"先搁置"分类展示
5. **使用说明**: 状态标记说明

### JSON 明细 (`materials_detail.json`)

完整的数据结构：

```json
{
  "metadata": {
    "generated_at": "2024-01-15T10:30:00",
    "source_directory": "/path/to/source",
    "output_directory": "/path/to/output",
    "version": "1.0"
  },
  "statistics": {
    "total_materials": 50,
    "total_topics": 5,
    "total_duplicate_clusters": 8,
    "materials_in_duplicates": 20,
    "ungrouped_materials": 2
  },
  "topics": [
    {
      "topic_id": "topic_0",
      "topic_name": "标题-文章-公众号",
      "keywords": ["标题", "文章", "公众号", "吸引力", "开头"],
      "size": 10,
      "representative": {...},
      "materials": [...],
      "duplicate_clusters": [...]
    }
  ],
  "materials": {
    "item_id_1": {
      "id": "item_id_1",
      "text": "如何写出让用户有共鸣的公众号文章标题",
      "source_file": "/path/to/file.txt",
      "line_number": 1,
      "status": "pending",
      "status_display": "待写",
      "topic": {...},
      "duplicate_cluster": {...}
    }
  },
  "state_summary": {...}
}
```

### 状态存储文件 (`.material_state.json`)

隐藏文件，用于持久化存储素材状态。再次扫描时会保留历史状态。

```json
{
  "version": "1.0",
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-16T14:20:00",
  "source_directory": "/path/to/source",
  "records": {
    "item_id_1": {
      "id": "item_id_1",
      "status": "pending",
      "source_file": "/path/to/file.txt",
      "line_number": 1,
      "original_text": "如何写出让用户有共鸣的公众号文章标题",
      "created_at": "2024-01-15T10:30:00",
      "updated_at": "2024-01-15T10:30:00",
      "notes": ""
    }
  }
}
```

## 进阶使用

### 自定义相似度阈值

如果觉得检测到的重复太多或太少，可以调整阈值：

```bash
# 更宽松（更多被判定为相似）
content-dedup scan ./materials/ -t 0.5

# 更严格（更少被判定为相似）
content-dedup scan ./materials/ -t 0.9
```

### 批量更新状态

可以通过直接编辑 `.material_state.json` 文件批量更新状态，或编写简单的 Python 脚本：

```python
from content_deduplicator.state_manager import StateManager, MaterialStatus

state_manager = StateManager("output/")

# 批量标记多个素材为待写
state_manager.set_statuses({
    "item_id_1": MaterialStatus.PENDING,
    "item_id_2": MaterialStatus.PENDING,
    "item_id_3": MaterialStatus.USED,
})
```

### 作为库使用

除了命令行，也可以直接在 Python 代码中使用：

```python
from content_deduplicator.reader import read_materials
from content_deduplicator.clusterer import process_materials
from content_deduplicator.state_manager import StateManager
from content_deduplicator.exporter import export_all

# 读取素材
materials = read_materials("./my-materials/")

# 处理（去重+分组）
result = process_materials(
    materials,
    n_topics=None,  # 自动估计
    similarity_threshold=0.7
)

# 状态管理
state_manager = StateManager(
    output_directory="./output/",
    source_directory="./my-materials/"
)
state_manager.merge_with_current_items(materials)

# 导出
export_all(
    processing_result=result,
    state_manager=state_manager,
    output_dir="./output/",
    source_dir="./my-materials/"
)
```

## 示例运行

使用项目自带的示例素材运行：

```bash
# 进入项目目录
cd /path/to/zy1016

# 扫描示例素材
content-dedup scan examples/ -v

# 查看生成的 Markdown
cat examples/.dedup_output/topics_board.md

# 查看生成的 JSON
cat examples/.dedup_output/materials_detail.json
```

## 常见问题

### Q: 为什么有些明显相似的内容没有被检测出来？

可能是相似度阈值设置得太高。尝试降低阈值：

```bash
content-dedup scan ./materials/ -t 0.6
```

### Q: 为什么有些不相似的内容被标记为重复？

可能是相似度阈值设置得太低。尝试提高阈值：

```bash
content-dedup scan ./materials/ -t 0.8
```

### Q: 状态文件在哪里？

状态文件是隐藏文件，位于输出目录下的 `.material_state.json`。

### Q: 再次扫描时状态会丢失吗？

不会。只要使用相同的输出目录，状态会被自动保留和合并。

### Q: 支持哪些文件编码？

默认使用 UTF-8，也会自动尝试 GBK 编码。

## 后续扩展计划

- [ ] 支持自定义停用词表
- [ ] 支持同义词扩展
- [ ] 添加更多聚类算法选项（DBSCAN、Hierarchical）
- [ ] 支持按时间范围筛选素材
- [ ] 添加 Web 界面
- [ ] 支持标签系统

## 许可证

MIT License
