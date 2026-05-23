# 志愿者排班签到 API

基于 FastAPI + SQLite 的志愿者排班签到系统后端服务。

## 功能特性

- **志愿者管理**: 志愿者信息增删改查
- **签到位置管理**: 支持地理位置签到验证
- **班次管理**: 创建和管理志愿服务班次，包含容量控制
- **签到管理**: 签到、签退、迟到检测、位置校验
- **替班管理**: 替班申请、审批流程
- **时长认证**: 服务时长申报、审核验证
- **服务报告**: 服务记录汇总、导出（CSV/JSON）
- **人工修正**: 签到记录人工修正，完整追溯
- **异常日志**: 所有异常操作记录原始输入和处理结论

## 核心规则

1. **班次容量**: 每个班次有最大人数限制，超出后无法签到
2. **位置校验**: 基于经纬度和半径计算签到位置是否有效（地理围栏）
   - 每个签到位置可配置 `require_location_check` 控制是否强制校验
   - 位置超出设定半径时**拒绝签到**并记录异常日志
   - 签到接口支持 `skip_location_check` 参数用于特殊情况跳过校验
3. **替班审批**: 替班申请需要审批后生效
4. **时长重算**: 支持重新计算服务时长
5. **报告导出**: 支持 CSV 和 JSON 格式导出

## 数据追溯

- 主记录: 签到记录
- 明细记录: 每次状态变更、修正记录
- 处理结论: 异常日志保存完整原始输入和处理结果

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --reload
```

服务启动后访问:
- API 文档 (Swagger): http://localhost:8000/docs
- ReDoc 文档: http://localhost:8000/redoc

### 3. 导入样例数据

新打开一个终端，运行:

```bash
pip install requests
python sample_data.py
```

## API 接口概览

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 志愿者 | POST | /volunteers/ | 创建志愿者 |
| 志愿者 | GET | /volunteers/ | 获取志愿者列表 |
| 志愿者 | GET | /volunteers/{id} | 获取单个志愿者 |
| 志愿者 | PUT | /volunteers/{id} | 更新志愿者信息 |
| 位置 | POST | /locations/ | 创建签到位置 |
| 位置 | GET | /locations/ | 获取位置列表 |
| 班次 | POST | /shifts/ | 创建班次 |
| 班次 | GET | /shifts/ | 获取班次列表 |
| 签到 | POST | /checkins/ | 签到 |
| 签到 | POST | /checkins/{id}/checkout | 签退 |
| 签到 | POST | /checkins/{id}/recalculate | 重算时长 |
| 替班 | POST | /swaps/ | 创建替班申请 |
| 替班 | POST | /swaps/{id}/approve | 审批替班申请 |
| 认证 | POST | /certifications/ | 申报时长认证 |
| 认证 | POST | /certifications/{id}/verify | 验证时长认证 |
| 报告 | POST | /reports/ | 生成服务报告 |
| 报告 | POST | /reports/export | 导出报告 |
| 修正 | POST | /corrections/ | 人工修正签到 |
| 日志 | GET | /exceptions/ | 查看异常日志 |

## 项目结构

```
.
├── main.py          # FastAPI 主应用
├── models.py        # SQLAlchemy 数据模型
├── schemas.py       # Pydantic 请求/响应模型
├── services.py      # 业务逻辑服务
├── database.py      # 数据库连接
├── sample_data.py   # 样例数据脚本
├── requirements.txt # 依赖包
└── volunteer_scheduling.db  # SQLite 数据库 (自动创建)
```

## 数据库表说明

1. **volunteers**: 志愿者表
2. **locations**: 签到位置表
3. **shifts**: 班次表
4. **checkin_records**: 签到记录表
5. **shift_swaps**: 替班申请表
6. **duration_certifications**: 时长认证表
7. **service_reports**: 服务报告表
8. **report_details**: 报告明细表
9. **exception_logs**: 异常日志表
10. **manual_corrections**: 人工修正表