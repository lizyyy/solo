# 向量索引同步看板

一个轻量级的向量索引同步管理系统，用于管理数据批次、监控索引同步状态、校验召回结果。

## 技术栈

- **后端**: Python Flask + SQLAlchemy + SQLite
- **前端**: HTML + Tailwind CSS + 原生 JavaScript
- **导出**: Pandas + OpenPyXL (Excel导出)

## 功能特性

### 核心功能
1. **数据批次管理** - 查看所有索引批次，支持按名称、负责人、版本搜索
2. **状态监控** - 实时显示索引进度、删除同步状态、召回校验结果
3. **批量导入** - 支持JSON格式批量导入数据批次
4. **详情查看** - 点击查看批次详情，包括删除同步记录和召回校验记录
5. **处理记录** - 支持标记删除同步和召回校验的处理状态，记录处理人及时间
6. **Excel导出** - 按负责人、时间、索引状态分组导出完整报告

### 数据维度
- **数据批次**: 批次名称、Embedding版本、负责人、状态、索引进度
- **删除同步**: 记录ID、状态、失败原因、处理人、处理时间
- **召回校验**: 查询语句、期望结果、实际结果、是否通过、处理人、处理时间

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 初始化数据库（导入示例数据）
```bash
python init_db.py
```

### 3. 启动后端服务
```bash
python app.py
```
服务将在 `http://localhost:5000` 启动

### 4. 打开前端页面
直接在浏览器中打开 `index.html` 文件，或使用任意HTTP服务器：
```bash
# 使用Python内置服务器
python -m http.server 8000
```
然后访问 `http://localhost:8000`

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/batches` | 获取批次列表，支持search和status参数过滤 |
| GET | `/api/batches/{id}` | 获取批次详情 |
| POST | `/api/batches/import` | 批量导入数据批次 |
| PUT | `/api/batches/{id}/status` | 更新批次状态 |
| PUT | `/api/delete_syncs/{id}/handle` | 处理删除同步记录 |
| PUT | `/api/recall_validations/{id}/handle` | 处理召回校验记录 |
| GET | `/api/export` | 导出Excel报告 |
| GET | `/api/stats` | 获取统计数据 |

## 批量导入数据格式

```json
{
  "batches": [
    {
      "batch_name": "批次名称",
      "embedding_version": "v1.0.0",
      "owner": "负责人",
      "status": "pending",
      "total_records": 1000,
      "delete_syncs": [
        {"record_id": "ID1", "status": "pending", "fail_reason": "失败原因"}
      ],
      "recall_validations": [
        {"query": "查询语句", "expected_result": "期望结果"}
      ]
    }
  ]
}
```

### 状态值说明
- `pending` - 待处理
- `indexing` - 索引中
- `validating` - 校验中
- `completed` - 已完成
- `failed` - 失败

## 项目结构

```
.
├── app.py              # Flask后端应用
├── init_db.py          # 数据库初始化脚本
├── index.html          # 前端页面
├── requirements.txt    # Python依赖
├── README.md          # 项目说明
└── vector_index.db    # SQLite数据库（运行后自动生成）
```
