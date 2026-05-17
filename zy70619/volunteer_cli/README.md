# 志愿者替班签到校验时长认证排查CLI

## 项目简介

这是一个用于志愿者排班管理的命令行工具，旨在解决公益活动排班中常见问题，
包括：
- 班次容量校验
- 签到位置验证
- 替班申请审批校验
- 服务时长认证与重算
- 服务报告导出

## 功能特性

- **规则清楚**：内置多种验证规则，确保数据合规
- **结果可复查**：机器可读(JSON/CSV) + 人可读(txt) 双格式报告
- **边界处理**：支持脏数据、边界冲突、空结果等场景

## 安装依赖

```bash
cd volunteer_cli
pip install -r requirements.txt
```

## 使用方法

### 1. 准备数据

在 `data/` 目录下放置以下JSON文件：

- `volunteers.json` - 志愿者信息
- `locations.json` - 活动地点信息
- `shifts.json` - 活动班次信息
- `checkins.json` - 签到记录
- `substitutes.json` - 替班申请
- `certifications.json` - 时长认证申请

### 2. 运行完整验证

```bash
python main.py validate
```

或指定数据目录和输出目录：

```bash
python main.py validate -d ./data -o ./reports -v
```

### 3. 单独检查功能

检查班次容量：
```bash
python main.py check-capacity
```

检查签到位置：
```bash
python main.py check-location
```

导出服务记录：
```bash
python main.py export-records
```

### 4. 查看版本

```bash
python main.py --version
```

## 数据格式说明

### volunteers.json
```json
[
  {
    "volunteer_id": "V001",
    "name": "张三",
    "phone": "13800138001",
    "email": "zhangsan@example.com",
    "status": "active",
    "join_date": "2024-01-15",
    "skills": ["急救", "引导"]
  }
]
```

### shifts.json
```json
[
  {
    "shift_id": "S001",
    "activity_name": "社区敬老活动",
    "location_id": "L001",
    "date": "2024-05-10",
    "start_time": "09:00",
    "end_time": "12:00",
    "capacity": 3,
    "status": "completed",
    "volunteer_ids": ["V001", "V002"]
  }
]
```

## 验证规则

1. **班次容量验证**
   - 每个班次的志愿者人数（包括替班）不能超过设定容量

2. **签到位置验证**
   - 签到GPS坐标必须在活动地点设定的半径范围内

3. **替班审批验证**
   - 已批准的替班申请必须有审批人和审批时间
   - 申请人和被替班人必须是系统中存在的有效志愿者

4. **时长重算验证**
   - 根据实际签到/签退时间计算实际服务时长
   - 与申报时长对比，差异超过5分钟则认证不通过

## 样例数据

项目提供3套测试场景

### 1. 正常输入 (data/)
包含正常的志愿者、班次、签到、替班和认证数据

### 2. 脏数据 (data_dirty/)
- 无效的手机号格式
- 错误的日期格式
- 结束时间早于开始时间
- 负的班次容量
- 未知的状态值

### 3. 边界冲突 (data/)
- 班次S003容量2但分配了4人
- 签到C003位置超出范围
- 签到C005缺少GPS信息
- 替班SUB003引用了不存在的志愿者和班次
- 替班SUB004缺少审批人
- 认证CERT002多报时长
- 认证CERT005引用不存在的签到

### 4. 空结果 (data_empty/)
所有数据文件均为空数组

## 输出报告

运行验证后在 `reports/` 目录生成：

1. **validation_results_*.json** - 机器可读的验证结果
2. **service_records_*.json** - 机器可读的服务记录
3. **service_records_*.csv** - CSV格式服务记录
4. **report_*.txt** - 人可读的详细报告

## 验收说明

- 机器可读输出和人读报告数据完全一致
- 所有错误和警告在两种报告中对应
- 服务记录中的时长计算准确无误
- 替班标记正确无误
