# 安全巡检闭环管理系统

一个基于 FastAPI + SQLite 的轻量级安全隐患全生命周期管理系统，实现从登记、派发、整改、复查到归档的完整闭环。

## 核心功能

### 1. 全流程闭环管理
- **登记隐患**: 录入隐患基本信息和现场照片
- **派发整改**: 指定整改责任人和完成期限
- **提交整改**: 记录整改措施和结果
- **复查验收**: 审核整改质量，合格闭环/不合格返工
- **归档管理**: 历史记录永久保存，支持查询追溯

### 2. 数据导入功能
- 隐患批量导入 (CSV格式)
- 照片索引批量导入 (JSON格式)
- 复查记录批量导入 (JSON格式)
- **错误记录保留**: 坏数据不丢弃，保留原始位置、失败原因和修改建议

### 3. 关键特性
- **幂等性保证**: 重复提交/导入结果稳定，不会产生重复数据
- **本地持久化**: SQLite数据库，重启服务数据不丢失
- **完整操作日志**: 每条状态变更都有记录，支持审计追溯
- **无前端依赖**: 纯API服务，curl即可操作

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务运行在 `http://127.0.0.1:8000`

### 3. API文档
访问 `http://127.0.0.1:8000/docs` 查看交互式API文档

### 4. 运行完整测试
```bash
python test_flow.py
```

## 接口说明

### 核心流程接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/dangers/register` | 登记隐患 |
| POST | `/api/dangers/assign` | 派发整改任务 |
| POST | `/api/dangers/rectify` | 提交整改结果 |
| POST | `/api/dangers/review` | 复查整改结果 |
| POST | `/api/dangers/archive` | 归档隐患记录 |

### 数据导入接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/dangers-csv` | 导入隐患CSV |
| POST | `/api/import/photos-json` | 导入照片索引JSON |
| POST | `/api/import/reviews-json` | 导入复查记录JSON |

### 查询接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dangers` | 隐患列表，支持按状态筛选 |
| GET | `/api/dangers/{danger_no}` | 隐患完整链路详情 |
| GET | `/api/import-errors` | 导入错误记录列表 |
| GET | `/api/operation-logs` | 操作日志审计 |
| GET | `/api/stats` | 统计概览 |

## 状态流转图
```
registered (已登记)
    ↓
rectifying (整改中) ←┐
    ↓                │
reviewing (复查中)    │
    ↓                │
closed (已闭环)      │ 不合格重整改
    ↓                │
archived (已归档)    ┘
```

## 数据格式示例

### 隐患导入CSV格式
```csv
隐患编号,标题,描述,位置,等级,检查人
D001,消防通道堵塞,一楼东侧消防通道被货物堵塞,生产区1楼东侧,严重,张安全
```

### 照片导入JSON格式
```json
[
    {"danger_no": "D001", "photo_path": "/photos/D001_1.jpg", "photo_type": "现场照片", "description": "消防通道堵塞全景"}
]
```

### 复查记录导入JSON格式
```json
[
    {"danger_no": "D001", "reviewer_name": "赵复查", "result": "合格", "comments": "消防通道已清理"}
]
```

## curl 操作示例

```bash
# 1. 登记隐患
curl -X POST http://127.0.0.1:8000/api/dangers/register \
  -H "Content-Type: application/json" \
  -d '{"danger_no":"D001","title":"消防通道堵塞","level":"严重"}'

# 2. 派发整改
curl -X POST http://127.0.0.1:8000/api/dangers/assign \
  -H "Content-Type: application/json" \
  -d '{"danger_no":"D001","assignee_name":"刘整改","deadline":"2024-12-31T00:00:00"}'

# 3. 提交整改
curl -X POST http://127.0.0.1:8000/api/dangers/rectify \
  -H "Content-Type: application/json" \
  -d '{"danger_no":"D001","rectification_date":"2024-12-28T00:00:00","measures":"清理通道","result":"完成","completed_by":"刘整改"}'

# 4. 复查
curl -X POST http://127.0.0.1:8000/api/dangers/review \
  -H "Content-Type: application/json" \
  -d '{"danger_no":"D001","reviewer_name":"赵复查","review_date":"2024-12-29T00:00:00","result":"合格"}'

# 5. 查看完整链路
curl http://127.0.0.1:8000/api/dangers/D001
```

## 项目结构
```
.
├── main.py              # FastAPI主应用
├── database.py          # 数据库模型和初始化
├── requirements.txt     # 依赖列表
├── test_flow.py         # 完整流程测试脚本
├── sample_data/         # 示例数据
│   ├── dangers.csv      # 隐患示例数据
│   ├── photos.json      # 照片索引示例
│   └── reviews.json     # 复查记录示例
└── safety_inspection.db # SQLite数据库文件（运行后生成）
```

## 特性说明

### 幂等性设计
所有写入接口都实现了幂等性检查：
- 重复登记同一隐患编号 → 返回已存在记录
- 重复派发同一任务 → 返回已派发记录
- 重复导入同一数据 → 跳过不重复创建

### 错误记录机制
导入失败的数据会完整保存：
- 原始数据内容
- 所在文件和行号
- 具体错误原因
- 可修改建议

### 审计追溯
每条隐患的完整生命周期都可追溯：
- 状态变更历史
- 操作人记录
- 时间戳信息
- 详细操作说明
