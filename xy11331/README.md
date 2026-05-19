# 门诊服务台陪检管理系统

一个落地可用的后端管理系统，解决陪检员接单、取消、插队和超时协调问题，支持患者等候时间统计。

## 核心特性

### 数据持久化
- 使用 SQLite 本地数据库存储所有数据
- 重启服务或二次运行数据不丢失
- 所有操作都有历史记录可追溯

### 业务规则引擎
1. **急诊优先**：高优先级任务优先分配陪检员
2. **取消补位**：任务取消后自动为等待队列的任务重新分配
3. **转派留痕**：任务转派有完整记录和原因说明
4. **幂等校验**：重复提交不会产生重复数据

### 状态机管理
```
PENDING → ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED
               ↓           ↓
           CANCELLED   TRANSFERRED
```

### 统计报告
- 每日任务统计（总数、完成数、取消数、急诊数）
- 平均等候时间统计
- 转派次数统计
- 陪检员工作量统计

## 项目结构

```
.
├── models.py          # 数据模型定义
├── database.py        # 数据库连接和会话管理
├── service.py         # 核心业务逻辑
├── cli.py             # 命令行接口
├── test_clinic.py     # 单元测试
├── requirements.txt   # 依赖列表
└── README.md          # 说明文档
```

## 安装与运行

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 运行演示
```bash
python cli.py demo
```

这将运行一个完整的业务流程演示，包括：
- 创建患者和陪检员
- 创建检查任务（含急诊任务）
- 自动派单（急诊优先）
- 陪检员接单
- 任务转派
- 完成任务
- 取消任务并触发补位机制
- 查看历史记录
- 生成统计报告

### 3. 运行测试
```bash
python -m pytest test_clinic.py -v
```

或
```bash
python test_clinic.py
```

## CLI 命令详解

### 基础数据管理

#### 创建患者
```bash
python cli.py create-patient --patient-id P001 --name 张三 --age 45 --gender 男 --department 内科 --bed-number 101
```

#### 创建陪检员
```bash
python cli.py create-escort --escort-id E001 --name 王师傅 --phone 13800138001 --max-tasks 3
```

### 任务管理

#### 创建检查任务
```bash
python cli.py create-task --task-id T001 --patient-id P001 --inspection-type CT检查 --location 影像科 --priority emergency
```

优先级选项: `emergency`(急诊), `urgent`(加急), `normal`(普通), `low`(低)

#### 派单
```bash
# 自动派单
python cli.py assign-task --task-id T001

# 指定陪检员派单
python cli.py assign-task --task-id T001 --escort-id E001
```

#### 接单
```bash
python cli.py accept-task --task-id T001 --escort-id E001
```

#### 开始任务
```bash
python cli.py start-task --task-id T001 --escort-id E001
```

#### 完成任务
```bash
python cli.py complete-task --task-id T001 --escort-id E001 --actual-duration 1800
```

#### 取消任务
```bash
python cli.py cancel-task --task-id T001 --reason 患者临时取消 --operator-id OP001
```

#### 转派任务
```bash
python cli.py transfer-task --task-id T001 --from-escort-id E001 --to-escort-id E002 --reason E001临时有事
```

### 查询与统计

#### 查看任务历史
```bash
python cli.py task-history --task-id T001
```

#### 查看每日统计报告
```bash
python cli.py daily-report

# 指定日期
python cli.py daily-report --date 2024-01-15
```

#### 列出所有任务
```bash
python cli.py list-tasks

# 按状态筛选
python cli.py list-tasks --status completed

# 按优先级筛选
python cli.py list-tasks --priority emergency
```

## 数据模型说明

### Patient (患者)
- patient_id: 患者唯一标识
- name: 姓名
- age: 年龄
- gender: 性别
- department: 科室
- bed_number: 床号

### Escort (陪检员)
- escort_id: 陪检员唯一标识
- name: 姓名
- phone: 联系电话
- status: 状态
- current_task_count: 当前任务数
- max_tasks: 最大可接任务数
- total_completed: 累计完成任务数

### InspectionTask (检查任务)
- task_id: 任务唯一标识
- patient_id: 患者ID
- inspection_type: 检查类型
- inspection_location: 检查地点
- priority: 优先级
- status: 状态
- assigned_escort_id: 指定陪检员
- accepted_at: 接单时间
- started_at: 开始时间
- completed_at: 完成时间
- wait_time_seconds: 等候时间(秒)
- actual_duration_seconds: 实际时长(秒)
- request_idempotency_key: 幂等键

### TaskHistory (任务历史)
记录任务的每一次状态变更，包括：
- 操作类型
- 状态变更（从什么状态到什么状态）
- 操作者类型和ID
- 原因说明
- 详细信息
- 操作时间

### DailyStatistics (每日统计)
- 日期
- 总任务数
- 完成任务数
- 取消任务数
- 超时任务数
- 急诊任务数
- 平均等候时间
- 平均完成时间
- 转派次数

## 作为库使用

```python
from service import ClinicService

service = ClinicService()

# 创建患者
service.create_patient("P001", "张三")

# 创建陪检员
service.create_escort("E001", "王师傅")

# 创建任务
service.create_task("T001", "P001", "CT检查", "影像科", "emergency")

# 派单
service.assign_task("T001")

# 接单
service.accept_task("T001", "E001")

# 完成
service.complete_task("T001", "E001", 1800)

# 查看历史
history = service.get_task_history("T001")

# 获取统计报告
report = service.get_daily_report()

service.close()
```

## 特点总结

✅ **数据持久化**：本地SQLite数据库，重启不丢失  
✅ **完整状态机**：任务从创建到完成的全生命周期管理  
✅ **规则引擎**：急诊优先、取消补位、转派留痕  
✅ **幂等设计**：重复提交不会产生重复数据  
✅ **历史可追溯**：每一次操作都有详细记录和原因  
✅ **统计报告**：等候时间、工作量等关键指标统计  
✅ **命令行接口**：所有功能可通过CLI调用，易于集成  
✅ **单元测试**：核心功能全覆盖测试
