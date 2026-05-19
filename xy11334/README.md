# 门诊陪检任务管理系统

基于 Python CLI + JSON 轻量存储的陪检任务管理系统。

## 核心功能

### 📋 业务规则引擎
- **急诊优先**: 急诊患者自动提升为最高优先级
- **取消补位**: 任务取消后，后续任务自动向前补位
- **转派留痕**: 所有转派操作完整记录，可追溯

### 🔒 敏感数据脱敏
- **患者姓名**: 仅保留首字（如 张三 → 张*）
- **手机号**: 中间4位脱敏（如 138****8001）
- **身份证号**: 中间8位脱敏（如 110101********1234）
- **脱敏层级**: 数据层脱敏（非仅展示层）

### 📊 批量操作
- **部分成功机制**: 批量操作部分成功不影响已成功记录
- **失败记录**: 详细记录失败项和错误原因
- **支持重试**: 可单独重试失败项

### ⏰ 超时处理
- **30分钟超时**: 待接单任务超30分钟自动标记为超时
- **超时补位**: 超时任务释放队列位置

## 命令说明

### 陪检员管理
```bash
# 添加陪检员
python3 cli.py escort add 姓名 电话 工号

# 列出陪检员
python3 cli.py escort list [--show-all]
```

### 任务管理
```bash
# 创建任务
python3 cli.py task create 姓名 电话 身份证 科室 [--emergency]

# 列出任务
python3 cli.py task list [--status pending|assigned|completed|cancelled|timeout] [--show-sensitive]

# 接单
python3 cli.py task accept <任务ID> <陪检员ID>

# 取消任务
python3 cli.py task cancel <任务ID> <取消原因>

# 转派任务
python3 cli.py task reassign <任务ID> <目标陪检员ID> <转派原因>

# 插队
python3 cli.py task jump <任务ID> <目标位置> <插队原因>

# 处理超时任务
python3 cli.py task timeout

# 完成任务
python3 cli.py task complete <任务ID>

# 查看操作日志
python3 cli.py task logs <任务ID>
```

### 批量操作
```bash
# 批量导入任务（JSON格式）
python3 cli.py batch import <文件路径>
```

### 数据导出
```bash
# 导出为 JSON
python3 cli.py export json [--no-desensitize]

# 导出为 CSV
python3 cli.py export csv [--no-desensitize]

# 统计报表
python3 cli.py export stats
```

## 文件结构
```
.
├── cli.py              # CLI 入口
├── models.py           # 数据模型
├── storage.py          # 持久化存储
├── rules.py            # 业务规则引擎
├── batch.py            # 批量处理与导出
├── requirements.txt    # 依赖
├── data/               # 数据存储目录
│   ├── tasks.json
│   └── escorts.json
└── exports/            # 导出文件目录
```

## 快速开始
```bash
# 安装依赖
pip3 install click python-dateutil

# 查看帮助
python3 cli.py --help

# 添加陪检员
python3 cli.py escort add 张三 13800138001 E001

# 创建普通任务
python3 cli.py task create 李四 13900139002 110101199001011234 内科

# 创建急诊任务
python3 cli.py task create 王五 13700137003 110101199002024567 急诊外科 --emergency

# 查看队列（急诊优先）
python3 cli.py task list
```
