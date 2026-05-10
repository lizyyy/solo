# 剧组通告单变更 CLI 工具

一个专门为影视剧组设计的通告单变更管理工具，解决每天频繁更改场景、演员和车辆导致的现场版本混乱问题。

## 核心功能

### 1. 通告导入
- 支持 JSON 和 CSV 格式
- 自动检测并记录脏数据（不静默跳过）
- 支持重复导入，覆盖旧版本

### 2. 版本对比
- 对比任意两个版本的差异
- 显示新增、删除、修改的场景、演员、车辆
- 生成详细的差异报告

### 3. 冲突检测
- **演员时间冲突**: 检测演员是否在同一时间出现在多个场景
- **车辆时间冲突**: 检测车辆是否在同一时间被多个场景使用
- **地点使用冲突**: 检测同一地点是否在同一时间安排多个场景
- **版本变更追踪**: 记录版本间的重要变更（地点、时间等）

### 4. 报告生成
- **汇总报告**: 给业务负责人看的高层概览
- **问题报告**: 所有数据问题的详细列表
- **冲突报告**: 所有冲突的详细列表
- **现场分发报告**: 按地点、演员、车辆分组，方便现场分发

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 初始化项目

```bash
call-sheet init "我的电影项目"
```

### 2. 导入通告单

```bash
# 导入第一个版本
call-sheet import examples/call_sheet_v1.json --version v1

# 导入修订版本
call-sheet import examples/call_sheet_v2.json --version v2

# 导入脏数据测试（会显示所有问题）
call-sheet import examples/dirty_data.json --version dirty-test
```

### 3. 查看版本列表

```bash
call-sheet list
```

### 4. 查看版本详情

```bash
call-sheet show 2024-01-15__v1
```

### 5. 对比版本差异

```bash
call-sheet diff 2024-01-15__v1 2024-01-15__v2

# 生成差异报告文件
call-sheet diff 2024-01-15__v1 2024-01-15__v2 --output diff_report.txt
```

### 6. 查询问题

```bash
# 查看所有问题
call-sheet issues

# 只看错误
call-sheet issues --severity error

# 只看警告
call-sheet issues --severity warning

# 生成问题报告
call-sheet issues --output issues_report.txt
```

### 7. 查询冲突

```bash
# 查看所有冲突
call-sheet conflicts

# 按类型筛选
call-sheet conflicts --type "演员时间冲突"

# 生成冲突报告
call-sheet conflicts --output conflicts_report.txt
```

### 8. 重新运行检查

```bash
call-sheet check
```

### 9. 生成报告

```bash
# 汇总报告（给业务负责人）
call-sheet report --type summary

# 问题报告
call-sheet report --type issues

# 冲突报告
call-sheet report --type conflicts

# 所有报告
call-sheet report --type all --output reports/
```

### 10. 生成现场分发报告

```bash
call-sheet distribute 2024-01-15__v2 --output field_report.txt
```

## 数据格式

### JSON 格式

```json
{
  "shoot_date": "2024-01-15",
  "notes": "备注信息",
  "scenes": [
    {
      "number": "1-1",
      "location": "拍摄地点",
      "description": "场景描述",
      "call_time": "08:00",
      "wrap_time": "12:00",
      "actors": ["演员1", "演员2"],
      "vehicles": ["CAR-001"]
    }
  ],
  "actors": [
    {
      "name": "演员1",
      "role": "角色",
      "call_time": "07:00",
      "wrap_time": "18:00",
      "scenes": ["1-1"],
      "notes": "备注"
    }
  ],
  "vehicles": [
    {
      "id": "CAR-001",
      "type": "轿车",
      "driver": "张师傅",
      "usage": "用途",
      "start_time": "06:00",
      "end_time": "22:00"
    }
  ]
}
```

### CSV 格式

场景行：
```csv
shoot_date,scene_number,location,description,call_time,wrap_time,actors,vehicles,notes
```

演员行：
```csv
shoot_date,actor_name,role,call_time,wrap_time,scenes,notes
```

车辆行：
```csv
shoot_date,vehicle_id,vehicle_type,driver,usage,start_time,end_time,notes
```

## 支持的日期时间格式

- 日期：`2024-01-15`, `2024/01/15`, `01-15-2024`, `2024年1月15日`, `1月15日`
- 时间：`08:00`, `08:00:00`, `8:00 AM`, `08时30分`, `8点30分`

## 项目结构

```
.
├── pyproject.toml
├── src/
│   └── call_sheet_cli/
│       ├── __init__.py
│       ├── models.py          # 数据模型定义
│       ├── storage.py         # 项目状态存储
│       ├── importer.py        # 通告单导入器
│       ├── comparator.py      # 版本对比器
│       ├── conflict_detector.py # 冲突检测器
│       ├── report.py          # 报告生成器
│       └── cli.py             # CLI 命令入口
└── examples/
    ├── call_sheet_v1.json     # 示例数据 v1
    ├── call_sheet_v2.json     # 示例数据 v2 (有变更)
    └── dirty_data.json        # 脏数据测试用例
```

## 关键特性

1. **脏数据不静默跳过** - 所有数据问题都被记录，包含来源、字段、行号
2. **可查询的历史** - 每一步都有输入输出记录
3. **重复导入支持** - 可以多次导入同一版本进行覆盖
4. **业务友好报告** - 不需要技术背景也能看懂
5. **现场分发优化** - 按地点分组，方便现场执行
