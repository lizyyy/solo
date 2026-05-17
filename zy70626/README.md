# 保洁验收返工客诉证据管理系统

## 项目概述

这是一个完整的民宿保洁验收流程管理后端API系统，支持从保洁任务创建、检查项打勾、照片留存、返工流程到客诉处理的全生命周期管理。

## 核心功能

### 1. 数据模型
- **房源管理**：管理民宿基本信息
- **检查项管理**：按房源配置保洁检查清单（支持必选项/可选项）
- **保洁任务**：任务生命周期管理
- **照片凭证**：保洁前后照片上传与关联
- **客诉记录**：客人投诉跟踪与处理
- **验收报告**：PDF/Excel报告导出

### 2. 返工状态机
12种状态流转：
```
created → assigned → in_progress → submitted → inspecting
                          ↓                        ↓
                    needs_rework ←---------------↓
                          ↓
                    reworking → rework_submitted → inspecting → approved
                          ↓                        ↓
                    complaint_open → complaint_under_review → complaint_resolved
                          ↓
                        closed
```

### 3. 错误响应分类
| 错误码 | 说明 |
|--------|------|
| missing_field | 缺少必填字段/检查项 |
| invalid_status | 当前状态不允许该操作 |
| needs_manual_review | 已达最大返工次数，需人工复核 |
| already_processed | 重复操作，已处理过 |
| not_found | 资源不存在 |

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite (SQLAlchemy ORM)
- **报告导出**: ReportLab (PDF), OpenPyXL (Excel)
- **测试**: pytest + httpx

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### API文档
启动后访问：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 运行自检

```bash
python test_self_check.py
```

自检脚本会自动：
1. 启动API服务
2. 执行完整流程测试（25+测试用例）
3. 验证导入、筛选、处理、导出功能
4. 停止服务并输出测试结果

## 主要API端点

### 房源管理
- `POST /properties/` - 创建房源
- `GET /properties/` - 房源列表（支持按业主筛选）

### 检查项管理
- `POST /checklist-items/` - 创建检查项
- `GET /checklist-items/{property_id}` - 获取房源检查清单

### 保洁任务
- `POST /tasks/` - 创建保洁任务
- `GET /tasks/` - 任务列表（支持状态/房源/保洁员筛选）
- `GET /tasks/{task_id}` - 获取任务详情
- `POST /tasks/update-status` - 推进任务状态（支持状态机验证）
- `POST /tasks/submit-cleaning` - 提交保洁成果
- `POST /tasks/inspect` - 验收检查
- `POST /tasks/start-rework` - 开始返工

### 照片凭证
- `POST /photos/` - 上传照片凭证
- `GET /photos/{task_id}` - 获取任务照片（支持按类别筛选）

### 客诉管理
- `POST /complaints/` - 创建客诉
- `GET /complaints/` - 客诉列表（支持状态/严重程度/任务筛选）
- `POST /complaints/resolve` - 处理客诉

### 报告导出
- `GET /reports/{task_id}/pdf` - 导出PDF验收报告
- `GET /reports/{task_id}/excel` - 导出Excel验收报告

## 核心业务规则

1. **检查项打勾**：提交保洁时必须勾选所有必填检查项
2. **重复验收拦截**：同一客诉处理后不能重复处理
3. **返工限制**：超过最大返工次数触发人工审核流程
4. **状态验证**：所有操作前验证当前状态是否允许
5. **照片留存**：支持按检查项关联照片，客诉处理时可关联证据

## 文件结构

```
.
├── main.py                 # 主API应用
├── requirements.txt        # 依赖列表
├── test_self_check.py      # 自检脚本
├── README.md              # 项目说明
└── cleaning.db            # SQLite数据库文件（自动生成）
```
