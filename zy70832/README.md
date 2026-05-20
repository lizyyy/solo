# 晨检管理后端服务

保健老师晨检记录管理系统，支持晨检CSV导入、用药授权JSON管理、班级名单维护，并提供完整的记录追踪和处理流程。

## 功能特性

- 批次管理：创建晨检批次，集中管理每日数据
- 数据导入：支持班级名单CSV、用药授权JSON、晨检CSV
- 自动校验：发热检测、药品过期检查、家长签名验证
- 记录处理：批准、退回修改、隔离、拒绝
- 历史查询：按班级老师、家长签名、隔离状态、状态查询
- 数据导出：CSV导出，导出数量与查询结果一致
- 处理日志：完整记录原因、处理人、时间的处理轨迹

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python -m app.main
```

服务启动后访问: http://localhost:8000/docs 查看API文档

### 运行演示
```bash
python test_demo.py
```

## API接口

### 批次管理
- `POST /api/batches` - 创建新批次
- `GET /api/batches` - 获取所有批次列表
- `GET /api/batches/{batch_id}` - 获取批次详情

### 数据导入
- `POST /api/batches/{batch_id}/import/class-list` - 导入班级名单CSV
- `POST /api/batches/{batch_id}/import/medication` - 导入用药授权JSON
- `POST /api/batches/{batch_id}/import/morning-check` - 导入晨检CSV

### 记录处理
- `GET /api/records/{record_id}/validate` - 校验记录问题
- `POST /api/records/{record_id}/process` - 处理记录

### 记录查询
- `GET /api/batches/{batch_id}/records` - 批次内查询
- `GET /api/records/search` - 跨批次历史查询（支持按老师、签名、隔离状态筛选）
- `GET /api/records/{record_id}/logs` - 获取完整处理轨迹

### 数据导出
- `POST /api/records/export` - 按条件导出CSV

## 处理动作说明

| 动作 | 说明 |
|------|------|
| approve | 批准放行，体温正常、资料齐全 |
| return_for_correction | 退回修改，需要补充资料 |
| isolate | 隔离观察，发热或其他异常情况 |
| reject | 拒绝，严重异常或不符合要求 |

## 样例数据

样例数据位于 `sample_data/` 目录，包含：
- 王老师、李老师两个班级的学生
- 包含发热学生（38.2℃、39.1℃）
- 包含需要人工修正的记录（缺少家长签名）
- 包含过期药品（止咳糖浆，有效期至2024-01-01）

## 项目结构

```
app/
├── __init__.py
├── main.py              # FastAPI主入口
├── models.py            # SQLAlchemy数据模型
├── schemas.py           # Pydantic schema定义
├── database.py          # 数据库配置
├── import_service.py    # 数据导入服务
└── business_service.py  # 业务逻辑服务
sample_data/             # 样例数据
test_demo.py             # 演示脚本
requirements.txt         # 依赖配置
```
