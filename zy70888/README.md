# 司法社工记录追踪系统

## 项目简介

这是一个为司法社工设计的后端服务系统，用于管理签到记录、请假记录、定位摘要，支持可追踪的审批流程。

## 主要功能

### 1. 批次管理
- 创建新批次
- 标记处理
- 退回修改
- 查看批次状态

### 2. 数据导入
- 签到记录：支持CSV格式导入
- 请假记录：支持JSON格式导入
- 定位摘要：支持JSON格式导入

### 3. 异常处理
- 超时未签标记
- 请假覆盖标记
- 轨迹缺口标记
- 记录异常原因、处理人和时间

### 4. 查询功能
- 按对象等级查询
- 按请假范围查询
- 按定位时段查询
- 按状态和异常类型筛选

### 5. 导出功能
- 导出明细数据
- 导出数量与查询结果一致
- 包含中文可读字段名

### 6. 审计日志
- 记录所有操作历史
- 可追踪处理过程
- 记录处理理由说明

## 技术栈

- Python 3.8+
- FastAPI - Web框架
- SQLAlchemy - ORM
- SQLite - 数据库
- Pandas - 数据处理

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

或使用启动脚本：

```bash
chmod +x start.sh
./start.sh
```

### 3. 访问API文档

启动后访问：http://localhost:8000/docs

## API接口概览

### 批次管理
- `POST /api/batches/` - 创建批次
- `GET /api/batches/` - 获取批次列表
- `GET /api/batches/{batch_id}` - 获取批次详情
- `PUT /api/batches/{batch_id}/process` - 处理批次

### 数据导入
- `POST /api/checkins/import/csv` - 导入签到CSV
- `POST /api/leaves/import/json` - 导入请假JSON
- `POST /api/locations/import/json` - 导入定位JSON

### 记录查询
- `POST /api/checkins/query` - 查询签到记录
- `POST /api/leaves/query` - 查询请假记录
- `POST /api/locations/query` - 查询定位摘要

### 记录处理
- `PUT /api/checkins/{record_id}/process` - 处理签到记录
- `PUT /api/leaves/{record_id}/process` - 处理请假记录
- `PUT /api/locations/{record_id}/process` - 处理定位摘要

### 异常标记
- `PUT /api/checkins/{record_id}/mark-exception` - 标记签到异常
- `PUT /api/leaves/{record_id}/mark-exception` - 标记请假异常
- `PUT /api/locations/{record_id}/mark-exception` - 标记定位异常

### 数据导出
- `POST /api/export/checkins` - 导出签到记录
- `POST /api/export/leaves` - 导出请假记录
- `POST /api/export/locations` - 导出定位摘要

### 审计日志
- `GET /api/audit-logs/` - 获取审计日志

## 数据字典

### 对象等级 (ObjectLevel)
- A级 - 重点关注对象
- B级 - 一般关注对象
- C级 - 普通对象
- D级 - 低风险对象

### 请假范围 (LeaveScope)
- 本市范围内
- 本省范围内
- 全国范围

### 处理状态 (ProcessStatus)
- 待处理
- 已处理
- 退回修改
- 已放行
- 需补材料

### 异常类型 (ExceptionType)
- 超时未签
- 请假覆盖
- 轨迹缺口
- 正常

## 示例数据

项目包含示例数据文件：
- `sample_checkins.csv` - 示例签到数据
- `sample_leaves.json` - 示例请假数据
- `sample_locations.json` - 示例定位数据

## 使用流程

1. 创建一个新批次
2. 导入签到、请假、定位数据到该批次
3. 检查数据，标记异常记录
4. 处理每条记录，填写可读说明
5. 处理完成后导出明细
6. 审计日志记录所有操作历史

## 可读说明

处理记录时，司法社工需要填写可读说明，以便向他人说明为什么这条记录被放行、退回或要求补材料。

示例说明：
- "该对象签到超时30分钟，已电话核实因交通拥堵导致，予以放行"
- "请假时间与定位轨迹存在重叠，需补材料说明具体情况"
- "轨迹缺口超过2小时，要求对象说明去向"
