# 数据血缘浏览器

一个用于展示数据集血缘关系的完整Web应用，包括后端API和前端界面。

## 功能特性

- **数据集管理**：查看数据集列表和详情
- **血缘关系图**：可视化展示数据集、上游任务、下游报表、字段映射的关系
- **失败记录追踪**：集中展示所有失败的任务、映射和变更影响
- **详情页面**：失败样例可跳转至详情页，查看处理人、处理时间、处理原因
- **人工修正**：支持对字段映射进行人工修正
- **导出功能**：导出数据集完整信息
- **重新计算**：上游任务变化后可重新计算血缘关系

## 技术栈

- **后端**：FastAPI + SQLAlchemy + SQLite
- **前端**：Vue 3 + Axios + Tailwind CSS

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py      # 数据库配置
│   │   ├── models.py        # 数据模型
│   │   ├── schemas.py       # Pydantic模式
│   │   ├── crud.py          # 数据操作
│   │   └── main.py          # API入口
│   └── requirements.txt
└── frontend/
    ├── index.html
    └── app.js
```

## 快速开始

### 1. 启动后端服务

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档: http://localhost:8000/docs

### 2. 启动前端

```bash
cd frontend
# 使用任意HTTP服务器，例如Python内置服务器
python -m http.server 8080
# 或使用Node.js的http-server
npx http-server -p 8080
```

访问: http://localhost:8080

### 3. 生成演示数据

点击页面右上角的"生成演示数据"按钮，系统将自动创建包含以下内容的演示数据：
- 1个数据集（用户行为数据集）
- 2个上游任务（其中1个失败）
- 2个下游报表
- 2个字段映射（其中1个无效）
- 1个变更影响（失败状态）

## 核心API接口

### 数据集
- `GET /api/datasets/` - 获取数据集列表
- `GET /api/datasets/{id}` - 获取数据集详情

### 上游任务
- `GET /api/upstream-tasks/` - 获取上游任务列表

### 字段映射
- `PUT /api/field-mappings/{id}/correct` - 人工修正字段映射

### 血缘图
- `GET /api/lineage-graphs/{dataset_id}` - 获取血缘图
- `POST /api/lineage-graphs/{dataset_id}/recalculate` - 重新计算血缘图

### 失败记录
- `GET /api/failed-items/` - 获取所有失败记录
- `GET /api/failed-items/{type}/{id}` - 获取失败项详情

### 其他
- `POST /api/demo/` - 生成演示数据
- `GET /api/export/{dataset_id}` - 导出数据集数据

## 数据模型

1. **Dataset（数据集）**：核心数据实体
2. **UpstreamTask（上游任务）**：产生数据集的任务
3. **DownstreamReport（下游报表）**：使用数据集的报表
4. **FieldMapping（字段映射）**：字段转换规则
5. **ChangeImpact（变更影响）**：变更的影响范围
6. **LineageGraph（血缘图）**：血缘关系可视化数据

## 使用说明

1. **数据集列表页**：查看所有数据集，点击进入详情
2. **数据集详情页**：
   - 查看血缘关系图
   - 查看上游任务、下游报表、字段映射、变更影响
   - 点击"重新计算血缘"更新关系图
   - 点击"导出数据"下载完整信息
   - 对无效的字段映射可进行人工修正
3. **失败记录页**：
   - 查看所有失败的任务、映射和变更影响
   - 点击进入详情页，查看处理信息
   - 可跳转至所属数据集详情页
