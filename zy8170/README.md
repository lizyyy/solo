# 反兴奋剂样本交接链管理系统

一个本地全栈应用，用于管理反兴奋剂实验室样本的交接链，支持导入数据、核对交接链、异常筛选和人工复核。

## 功能特性

- **数据导入**: 支持导入采样登记 CSV、冰箱库位 YAML、转运扫码 JSONL
- **交接链核对**: 自动检测交接链中的问题
  - 重复扫码检测
  - 跨午夜转运警告
  - 库位温区不匹配检查
  - 交接链断点检测
- **前端界面**:
  - 批次列表管理
  - 样本时间线可视化
  - 多维度异常筛选
  - 人工复核备注功能
- **数据导出**:
  - 问题列表导出 (issues.csv)
  - 交接报告导出 (handoff_report.md)
- **数据存储**: 本地 SQLite 数据库

## 项目结构

```
.
├── backend/
│   └── app.py              # Flask 后端应用
├── frontend/
│   └── index.html          # 前端界面
├── samples/
│   ├── sample_registration.csv    # 示例采样登记数据
│   ├── fridge_locations.yaml      # 示例冰箱库位数据
│   └── transport_scans.jsonl      # 示例转运扫码数据
├── requirements.txt        # Python 依赖
└── README.md
```

## 安装与启动

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装步骤

1. 克隆或下载项目到本地

2. 创建虚拟环境（推荐）：
```bash
cd /path/to/project
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows
```

3. 安装依赖：
```bash
pip install -r requirements.txt
```

### 启动应用

1. 启动后端服务器：
```bash
cd backend
python app.py
```

后端服务将在 `http://localhost:5000` 启动

2. 打开前端界面：

直接用浏览器打开 `frontend/index.html` 文件，或者使用任何静态文件服务器。

例如使用 Python 内置服务器：
```bash
cd frontend
python -m http.server 8080
```

然后访问 `http://localhost:8080`

## 使用流程

### 1. 导入数据

按照以下顺序导入数据：

1. **导入采样登记 CSV** (必需)
   - 点击 "📋 采样登记 CSV" 区域的选择文件按钮
   - 选择 `samples/sample_registration.csv` 或您自己的 CSV 文件
   - 这会创建一个新的批次

2. **导入冰箱库位 YAML** (可选，但推荐)
   - 点击 "🧊 冰箱库位 YAML" 区域的选择文件按钮
   - 选择 `samples/fridge_locations.yaml`
   - 用于库位温区匹配检查

3. **导入转运扫码 JSONL** (可选，但推荐)
   - 点击 "📱 转运扫码 JSONL" 区域的选择文件按钮
   - 选择 `samples/transport_scans.jsonl`
   - 包含入库、转运、接收的扫码记录

### 2. 校验交接链

导入所有数据后，点击 "✓ 校验交接链" 按钮，系统将自动检测：

- 交接链是否完整（采样→分装→入库→转运→接收）
- 是否存在重复扫码
- 是否存在跨午夜转运
- 库位温区是否与样本类型匹配

### 3. 查看和筛选

点击批次列表中的 "查看" 按钮，可以：

- **样本列表标签页**:
  - 按样本ID、类型、复核状态、问题状态筛选
  - 点击样本卡片查看详细信息

- **问题列表标签页**:
  - 按严重程度、问题类型、解决状态筛选
  - 标记问题为已解决/待解决

### 4. 人工复核

点击样本卡片进入样本详情页：

- 查看交接时间线
- 查看检测到的问题
- 设置复核状态（待复核/复核中/已通过/已拒绝）
- 添加复核备注

### 5. 导出报告

校验完成后，可以导出：

- **导出问题列表**: 生成包含所有问题的 CSV 文件
- **导出交接报告**: 生成包含完整批次信息的 Markdown 报告

## 数据格式说明

### 采样登记 CSV 格式

必需字段：
- `sample_id`: 样本唯一标识
- `sample_type`: 样本类型 (blood/urine)

可选字段：
- `athlete_id`: 运动员ID
- `competition`: 赛事名称
- `sampling_time`: 采样时间
- `sampling_location`: 采样地点
- `sampling_operator`: 采样操作人
- `aliquoting_time`: 分装时间
- `aliquoting_location`: 分装地点
- `aliquoting_operator`: 分装操作人

### 冰箱库位 YAML 格式

```yaml
locations:
  - code: FRIDGE-01-A1
    zone: frozen           # 温区: frozen(冷冻)/refrigerated(冷藏)/room_temperature(常温)
    description: 冷冻冰箱1层A区
    temperature: -20°C
```

### 转运扫码 JSONL 格式

每行一个 JSON 对象：

```json
{
  "sample_id": "S001",
  "event_type": "storage",    # 事件类型: sampling/aliquoting/storage/transport/receipt
  "event_time": "2024-12-20 14:00:00",
  "location": "FRIDGE-01-A1",
  "operator": "仓管员A",
  "storage_zone": "frozen"
}
```

## 示例数据中的预设问题

使用 `samples/` 目录下的示例数据进行测试，系统将检测到以下问题：

| 样本 | 问题类型 | 说明 |
|------|----------|------|
| S001 | 重复扫码 | 接收环节被扫码两次 |
| S002 | 跨午夜转运 | 转运发生在凌晨 02:15 |
| S003 | 温区不匹配 | 血液样本存放在冷藏区 |
| S004 | 温区不匹配 | 尿液样本存放在冷冻区；缺少分装环节 |
| S005 | 交接链断点 | 缺少接收环节 |

## API 接口

### 批次管理
- `GET /api/batches` - 获取所有批次
- `GET /api/batches/<id>` - 获取批次详情
- `DELETE /api/batches/<id>` - 删除批次
- `POST /api/batches/<id>/validate` - 校验批次

### 数据导入
- `POST /api/import/csv` - 导入采样登记 CSV
- `POST /api/import/yaml` - 导入冰箱库位 YAML
- `POST /api/import/jsonl` - 导入转运扫码 JSONL

### 样本管理
- `GET /api/samples/<id>` - 获取样本详情
- `PUT /api/samples/<id>/review` - 更新样本复核状态

### 问题管理
- `PUT /api/issues/<id>/resolve` - 标记问题解决状态

### 数据导出
- `GET /api/export/<batch_id>/issues.csv` - 导出问题列表
- `GET /api/export/<batch_id>/handoff_report.md` - 导出交接报告

## 技术栈

- **后端**: Python Flask, Flask-SQLAlchemy, SQLite
- **前端**: 原生 HTML/CSS/JavaScript
- **数据格式**: CSV, YAML, JSONL

## 注意事项

1. 这是一个本地应用，数据存储在本地 SQLite 数据库 (`backend/antidoping.db`)
2. 首次运行时会自动创建数据库表
3. 建议使用虚拟环境隔离依赖
4. 示例数据仅用于测试目的

## License

MIT
