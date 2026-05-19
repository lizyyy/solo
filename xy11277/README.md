# 仓库夜班排班管理系统

基于 FastAPI 构建的仓库夜班排班管理系统，用于管理叉车、充电桩、司机排班，支持任务分配、资源锁定、异常处理和日报生成。

## 功能特性

- **资源管理**: 叉车、充电桩、司机的基础信息管理
- **排班管理**: 按日期和班次进行排班，支持任务分配
- **任务管理**: 任务创建、批量导入、状态跟踪
- **资源锁定**: 支持资源锁定/解锁，防止冲突
- **异常管理**: 异常上报、处理、解决
- **充电管理**: 叉车充电开始/结束管理
- **报表生成**: 自动生成每日工作日报
- **幂等性保证**: 重复提交结果稳定，不重复扣算
- **批量操作**: 支持批量创建，失败时明确成功/失败记录
- **敏感字段脱敏**: 手机号、身份证等敏感信息自动脱敏

## 技术栈

- Python 3.8+
- FastAPI 0.104.1
- Uvicorn
- Pydantic 2.x

## 快速开始

### 启动服务

```bash
# 方式1: 使用启动脚本
./start.sh

# 方式2: 手动启动
pip install -r requirements.txt
python main.py
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 运行测试

```bash
# 确保服务已启动，然后运行测试脚本
./test_api.sh
```

## API 接口

### 资源管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/forklifts | 获取叉车列表 |
| GET | /api/v1/forklifts/{id} | 获取叉车详情 |
| PATCH | /api/v1/forklifts/{id}/battery | 更新叉车电量 |
| GET | /api/v1/charging-stations | 获取充电桩列表 |
| POST | /api/v1/charging-stations/{id}/start-charging | 开始充电 |
| POST | /api/v1/charging-stations/{id}/stop-charging | 停止充电 |
| GET | /api/v1/drivers | 获取司机列表（敏感字段脱敏） |

### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/tasks | 创建任务（幂等） |
| POST | /api/v1/tasks/batch | 批量创建任务 |
| GET | /api/v1/tasks | 获取任务列表 |

### 排班管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/schedules | 创建排班（幂等） |
| POST | /api/v1/schedules/batch | 批量创建排班 |
| GET | /api/v1/schedules | 获取排班列表 |

### 资源锁定

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/locks | 锁定资源 |
| POST | /api/v1/locks/unlock | 解锁资源 |
| GET | /api/v1/locks | 获取活动锁定 |

### 异常管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/exceptions | 上报异常 |
| POST | /api/v1/exceptions/{id}/resolve | 解决异常 |
| GET | /api/v1/exceptions | 获取异常列表 |

### 报表管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/reports/daily | 生成日报 |
| GET | /api/v1/reports | 获取报表列表 |

## 核心设计

### 幂等性实现

每个写操作都需要传递 `idempotency_key`，系统通过该键识别重复请求，直接返回已存在的记录，保证：
- 重复提交任务结果一致
- 不会重复创建排班
- 不会重复扣算资源

### 批量操作结果

批量操作返回结构：
```json
{
  "success_count": 2,
  "failure_count": 1,
  "successful": [...],
  "failed": [
    {
      "index": 1,
      "data": {...},
      "error": "错误信息"
    }
  ]
}
```

### 敏感字段脱敏

系统在 API 返回时自动处理：
- 手机号: 138****8001
- 身份证: 110101********1234
- 其他敏感字段按规则脱敏

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── core/
│   │   ├── config.py          # 配置管理
│   │   └── security.py        # 安全、脱敏
│   ├── models/
│   │   └── database.py        # 数据模型、内存存储
│   ├── schemas/
│   │   ├── common.py          # 通用 schema
│   │   └── schedule.py        # 业务 schema
│   ├── services/
│   │   ├── schedule_service.py # 排班、锁定、异常、报表服务
│   │   └── resource_service.py # 资源服务
│   └── api/
│       └── routes.py          # API 路由
├── main.py                      # 应用入口
├── requirements.txt             # 依赖配置
├── start.sh                     # 启动脚本
└── test_api.sh                 # 测试脚本
```
