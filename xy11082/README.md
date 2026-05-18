# 中药代煎房代煎处方排队 API 系统

## 系统概述

本系统实现了中药代煎房处方排队的完整业务流程，包括状态流转控制、角色权限管理、同锅合煎检测、异常处理等核心功能。

## 快速开始

```bash
# 一键启动（自动创建环境、初始化数据、运行测试、启动服务器）
chmod +x run.sh
./run.sh
```

或者手动执行：

```bash
# 安装依赖
pip install -r requirements.txt

# 初始化样例数据
python sample_data.py

# 运行规则验证测试
python test_queue_rules.py

# 启动 API 服务器
uvicorn main:app --reload
```

## 系统特性

### 1. 状态流转 (9种状态)
- `待排队` → `已排队` → `已分配锅次` → `煎煮中` → `煎煮完成` → `包装中` → `已完成`
- `异常` - 特殊状态，需后台复核人处理
- `已取消` - 终态，不可逆转

### 2. 角色权限分离

| 角色 | 允许操作 |
|------|---------|
| **现场负责人** | 排队登记、分配锅次、开始煎煮、完成煎煮、开始包装、完成包装、申请取消、标记异常 |
| **后台复核人** | 确认取消、处理异常 |
| **操作员** | 排队登记、开始煎煮、完成煎煮、开始包装、完成包装 |

### 3. 同锅合煎功能
- 支持多张处方同一锅煎煮
- 自动验证煎煮类型一致性
- 组内状态保持同步
- 任一处方申请取消时，整组标记

### 4. 完整审计追踪
- 所有状态变更均记录历史
- 包含：操作者、角色、时间戳、备注
- 完整的操作日志可追溯

## 业务规则 (R001-R010)

| 规则ID | 规则描述 |
|--------|---------|
| **R001** | 状态流转必须符合预定义的状态转换图 |
| **R002** | 操作必须在角色权限范围内 |
| **R003** | 已完成状态不可逆转 |
| **R004** | 已取消状态不可逆转 |
| **R005** | 同锅合煎组中任一处方申请取消需标记整个组 |
| **R006** | 确认取消必须由后台复核人执行 |
| **R007** | 异常处理必须由后台复核人执行 |
| **R008** | 煎煮开始后不可直接取消，需先标记异常 |
| **R009** | 同锅合煎组状态必须保持一致 |
| **R010** | 所有状态变更必须记录操作者、时间和来源 |

## API 接口

### 排队管理
- `GET /queue/` - 获取排队列表
- `GET /queue/{id}` - 获取排队详情
- `GET /queue/{id}/history` - 获取状态历史

### 状态操作
- `POST /prescriptions/` - 创建处方
- `POST /queue/{id}/enqueue` - 排队登记
- `POST /queue/{id}/assign-pot` - 分配锅次
- `POST /queue/{id}/start-boiling` - 开始煎煮
- `POST /queue/{id}/complete-boiling` - 完成煎煮
- `POST /queue/{id}/start-packing` - 开始包装
- `POST /queue/{id}/complete-packing` - 完成包装

### 异常与取消
- `POST /queue/{id}/request-cancellation` - 申请取消
- `POST /queue/{id}/confirm-cancellation` - 确认取消（后台复核人）
- `POST /queue/{id}/mark-exception` - 标记异常
- `POST /queue/{id}/handle-exception` - 处理异常（后台复核人）

### 查询
- `GET /same-pot-groups/` - 获取同锅合煎组
- `GET /users/allowed-actions/{id}` - 获取用户可执行操作
- `GET /rules/` - 查看所有业务规则

## 测试样例

系统内置完整的样例数据：
- 3个用户（覆盖三种角色）
- 6张处方，覆盖所有排队状态
- 4个煎锅
- 1个同锅合煎组（2张处方）
- 完整的状态流转历史记录

## 项目结构

```
.
├── main.py              # FastAPI 主程序
├── models.py            # 数据模型
├── schemas.py           # Pydantic 模式
├── database.py          # 数据库配置
├── state_machine.py     # 状态机核心逻辑
├── sample_data.py       # 样例数据初始化
├── test_queue_rules.py  # 规则验证测试
├── requirements.txt     # 依赖列表
└── run.sh              # 一键启动脚本
```
