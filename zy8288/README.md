# 文件审阅工作台

一个基于 Streamlit 的本地文件审阅工作台，支持 CSV/XLSX 文件的上传、数据预览、字段映射、筛选条件设置、行级标注和备注，并提供完整的状态持久化和恢复机制。

## 功能特性

### 📤 文件上传与数据加载
- 支持 CSV 和 XLSX 格式文件上传
- 自动识别文件类型并解析数据
- 显示文件基本信息（行数、列数、指纹等）

### 📊 数据预览
- 交互式数据表格展示
- 支持筛选条件实时预览
- 显示行级标注概览

### 🔄 字段映射
- 自定义字段重命名
- 启用/禁用特定字段
- 一键重置为原始字段名

### 🔍 筛选条件
- 支持多种比较操作符（等于、不等于、包含、不包含、大于、小于等）
- 多条件组合筛选
- 实时预览筛选效果

### 📝 行级标注
- 5 种标注类型：
  - ✅ 正常 (OK)
  - ❌ 错误 (Error)
  - ⚠️ 警告 (Warning)
  - 👀 需复审 (Review)
  - ❓ 疑问 (Question)
- 支持备注说明
- 标注统计概览

### 📋 全局备注
- 支持整体审阅说明
- 待办事项记录

### 📦 数据导出
- **清洗后数据**：应用字段映射和筛选条件后的数据
  - 支持 CSV 和 XLSX 格式
- **审阅状态包**：完整的工作区状态（JSON 格式）
  - 包含字段映射、筛选条件、行标注、备注
- **完整数据包 (ZIP)**：包含原始数据、清洗后数据、状态文件和报告
- **标注报告**：单独的标注详情 CSV

### 🗂️ 工作区管理
- 查看所有已保存的工作区
- 删除不需要的工作区
- 显示工作区版本和标注数量

### 🔄 状态同步与恢复
- **文件指纹**：基于文件内容和名称生成唯一标识
- **自动保存**：所有操作自动保存到本地
- **状态恢复**：页面刷新、脚本重跑或重新上传同一文件时，自动恢复之前的工作状态
- **冲突检测**：检测文件内容变化、结构不匹配等冲突
- **降级处理**：损坏的状态文件尝试恢复可用数据

## 安装步骤

### 环境要求
- Python 3.8+
- pip 包管理器

### 安装依赖

```bash
# 克隆或下载项目到本地
cd /path/to/project

# 安装依赖
pip install -r requirements.txt
```

依赖包包括：
- `streamlit>=1.30.0` - Web 应用框架
- `pandas>=2.0.0` - 数据处理
- `openpyxl>=3.1.0` - Excel 文件支持
- `pydantic>=2.0.0` - 数据验证
- `python-dateutil>=2.8.0` - 日期处理

## 启动步骤

### 方法 1：直接运行

```bash
# 在项目根目录执行
streamlit run app.py
```

### 方法 2：指定端口运行

```bash
streamlit run app.py --server.port 8501
```

### 方法 3：使用配置文件

创建 `.streamlit/config.toml` 文件：

```toml
[server]
port = 8501
headless = false

[theme]
base = "light"
primaryColor = "#FF4B4B"
```

然后运行：

```bash
streamlit run app.py
```

## 使用说明

### 快速开始

1. **启动应用**：执行 `streamlit run app.py`
2. **访问页面**：浏览器自动打开 `http://localhost:8501`
3. **上传文件**：点击文件上传区域，选择 CSV 或 XLSX 文件
4. **开始审阅**：使用各功能标签页进行数据审阅

### 状态持久化说明

#### 工作原理

1. **文件指纹生成**：
   - 上传文件时，系统计算文件内容的 MD5 哈希值
   - 结合文件名生成唯一的文件指纹
   - 指纹作为工作区的唯一标识

2. **状态存储**：
   - 工作区状态保存在 `.workspaces/` 目录
   - 每个文件对应一个 JSON 状态文件
   - 文件名格式：`{fingerprint}.json`

3. **状态恢复**：
   - 上传文件时，系统检查是否存在对应指纹的状态文件
   - 如果存在，自动恢复字段映射、筛选条件、行标注和备注
   - 页面刷新或重新上传同一文件时，状态自动恢复

#### 冲突检测

系统会检测以下冲突情况：

1. **文件内容变化**：指纹不匹配时提示警告
2. **行数不匹配**：当前数据行数少于标注的最大行号时提示错误
3. **字段缺失**：映射或筛选引用的字段不存在时提示错误

#### 降级处理

当状态文件损坏时：
- 系统尝试解析部分可用数据
- 至少恢复文件名和全局备注
- 提供空的工作区状态供用户重新开始

### 示例数据

项目包含示例数据文件 `samples/sample_data.csv`，可用于测试：

```
订单ID,客户名称,产品类型,单价,数量,订单日期,状态,备注
ORD001,张三科技,电子产品,2999.0,2,2024-01-15,已完成,正常交付
...
```

### 常用操作流程

#### 1. 数据审阅流程

```
上传文件 → 预览数据 → 设置字段映射 → 添加筛选条件
    ↓
添加行标注 → 填写全局备注 → 导出数据
```

#### 2. 状态恢复流程

```
重新上传同一文件 → 系统检测到已有状态 → 自动恢复
    ↓
如有冲突显示警告 → 继续审阅或重新开始
```

#### 3. 数据导出流程

```
配置字段映射 → 设置筛选条件 → 选择导出格式
    ↓
下载清洗后数据 / 状态包 / 完整数据包
```

## 项目结构

```
.
├── app.py                    # Streamlit 主应用
├── requirements.txt          # 依赖列表
├── README.md                 # 本文档
├── samples/                  # 示例数据
│   └── sample_data.csv
├── state_sync/              # 状态同步模块
│   ├── __init__.py
│   ├── file_fingerprint.py  # 文件指纹计算
│   ├── state_storage.py     # 状态存储与管理
│   └── conflict_detection.py # 冲突检测
└── .workspaces/             # 工作区状态存储目录（自动创建）
    └── *.json               # 各文件的状态文件
```

## 状态同步模块说明

### file_fingerprint.py

文件指纹计算模块：

```python
from state_sync import compute_file_fingerprint

# 计算文件指纹
fingerprint = compute_file_fingerprint(file_content, filename)

# 计算 DataFrame 指纹
from state_sync.file_fingerprint import compute_dataframe_fingerprint
df_fingerprint = compute_dataframe_fingerprint(df)
```

### state_storage.py

状态存储模块：

```python
from state_sync import WorkspaceState, StateManager

# 创建状态管理器
state_manager = StateManager(workspaces_dir=".workspaces")

# 创建工作区状态
state = WorkspaceState(
    file_fingerprint=fingerprint,
    filename="data.csv",
    file_type="csv",
)

# 保存状态
state_manager.save_state(state)

# 加载状态
saved_state = state_manager.load_state(fingerprint)

# 列出所有工作区
workspaces = state_manager.list_workspaces()
```

### conflict_detection.py

冲突检测模块：

```python
from state_sync import ConflictDetector, ConflictType

detector = ConflictDetector()

# 检测所有冲突
conflicts = detector.detect_all(
    original_df=None,
    current_df=df,
    saved_state=saved_state,
    current_fingerprint=current_fp,
    saved_fingerprint=saved_fp,
)

# 检查数据兼容性
is_compatible, issues = detector.check_data_compatibility(
    saved_state, current_df
)
```

## 注意事项

1. **状态文件位置**：工作区状态默认保存在 `.workspaces/` 目录，请勿删除此目录
2. **文件指纹**：指纹基于文件内容和名称计算，修改文件名会被视为不同文件
3. **行索引**：行标注基于 DataFrame 的整数索引，数据排序或删除行可能导致标注错位
4. **数据备份**：定期导出完整数据包作为备份
5. **兼容性**：状态文件使用 JSON 格式，可手动编辑（但建议通过界面操作）

## 故障排除

### 问题 1：状态无法恢复

**可能原因**：
- 文件内容已修改，指纹不匹配
- 状态文件损坏

**解决方案**：
- 检查文件是否被修改
- 查看控制台输出的错误信息
- 尝试手动修复 `.workspaces/` 中的 JSON 文件

### 问题 2：导出失败

**可能原因**：
- 筛选条件引用了不存在的字段
- 字段映射配置有误

**解决方案**：
- 检查筛选条件中的字段是否存在
- 检查字段映射是否全部启用
- 尝试不应用筛选和映射导出

### 问题 3：页面刷新后状态丢失

**可能原因**：
- 浏览器缓存问题
- 工作区目录权限问题

**解决方案**：
- 清除浏览器缓存后重试
- 检查 `.workspaces/` 目录的读写权限
- 确认 `StateManager` 使用的路径正确

## 技术栈

- **前端框架**：Streamlit
- **数据处理**：Pandas
- **数据验证**：dataclasses（Python 内置）
- **哈希计算**：hashlib（Python 内置）
- **文件格式**：CSV, XLSX, JSON, ZIP

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
