# 园区访客车位 API

基于 FastAPI + SQLite 的园区访客临时车位管理系统后端API服务。

## 核心功能

### 数据模型
- **访客 (Visitor)**: 访客基本信息管理
- **车位 (ParkingSpot)**: 车位资源管理（临时/固定）
- **会议预约 (MeetingAppointment)**: 会议与车位预约联动
- **放行码 (PassCode)**: 车辆出入放行验证
- **取消记录 (CancelRecord)**: 会议取消及车位释放记录
- **占用报告 (OccupancyReport)**: 车位使用统计报告
- **异常日志 (ExceptionLog)**: 异常请求记录与处理

### 核心业务规则
- ✅ **车位锁定**: 创建预约时自动锁定对应车位
- ✅ **会议联动**: 会议状态变化自动更新车位状态
- ✅ **放行码失效**: 过期/取消的预约自动失效放行码
- ✅ **取消释放**: 会议取消时自动释放车位
- ✅ **报告导出**: 支持按日期范围导出占用报告
- ✅ **人工修正**: 支持人工干预预约状态和车位分配
- ✅ **异常追踪**: 所有异常请求保存原始输入，支持标记处理结果

### 状态返回
API 返回状态不仅限于成功/失败，支持：
- `APPROVED`: 操作成功
- `REJECTED`: 操作被拒绝
- `PENDING_REVIEW`: 待复核
- `COMPENSATED`: 已补偿

## 项目结构

```
.
├── main.py              # FastAPI 主应用，REST 接口
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 请求/响应模式
├── crud.py              # 业务逻辑与数据操作
├── database.py          # 数据库连接配置
├── init_sample_data.py  # 样例数据初始化脚本
├── test_api.sh          # API 功能测试脚本
├── requirements.txt     # Python 依赖
└── parking.db           # SQLite 数据库文件（运行后生成）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据（可选）

```bash
python init_sample_data.py
```

### 3. 启动服务

```bash
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 访问 API 文档

启动后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 5. 运行测试脚本

```bash
chmod +x test_api.sh
./test_api.sh
```

## 主要 API 接口

### 访客管理
- `POST /visitors/` - 创建访客
- `GET /visitors/` - 获取访客列表
- `GET /visitors/{id}` - 获取单个访客

### 车位管理
- `POST /parking-spots/` - 创建车位
- `GET /parking-spots/` - 获取车位列表（支持按状态筛选）
- `PUT /parking-spots/{id}` - 更新车位信息
- `POST /parking-spots/lock` - 锁定车位
- `POST /parking-spots/{id}/release` - 释放车位

### 会议预约
- `POST /appointments/` - 创建会议预约（自动分配/锁定车位）
- `GET /appointments/` - 获取预约列表
- `PUT /appointments/{id}` - 更新预约信息
- `POST /appointments/{id}/cancel` - 取消预约（自动释放车位）
- `POST /appointments/{id}/pass-code` - 生成放行码

### 放行码验证
- `POST /pass-codes/verify` - 验证放行码（成功后标记车位已占用）

### 报告管理
- `POST /reports/generate` - 生成当日占用报告
- `GET /reports/` - 获取报告列表
- `POST /reports/export` - 导出指定日期范围的报告

### 人工修正
- `POST /manual-correction` - 人工修正预约状态/车位分配（标记为待复核）

### 异常日志
- `GET /exception-logs/` - 获取异常日志列表
- `PUT /exception-logs/{id}` - 更新异常处理状态

### 状态概览
- `GET /status/overview` - 获取系统整体状态概览

## 数据持久化

服务使用 SQLite 数据库，所有数据保存在 `parking.db` 文件中。重启服务后所有历史数据不会丢失。

## 核心流程示例

### 正常会议预约流程
1. 创建访客信息
2. 创建会议预约（指定或自动分配车位）
3. 系统自动锁定对应车位
4. 生成放行码
5. 访客到场，保安验证放行码
6. 系统标记车位为已占用
7. 会议结束后释放车位

### 会议取消流程
1. 提交取消请求（说明取消原因）
2. 系统记录取消日志
3. 自动释放关联车位
4. 失效所有关联放行码
5. 更新预约状态为"已取消"

### 异常处理流程
1. 异常请求自动捕获并记录日志
2. 保存原始请求内容、错误信息
3. 管理员在后台查看待处理异常
4. 标记处理结果（已驳回/已补偿/待复核）
5. 记录处理备注
