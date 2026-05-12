# 招聘面试排班 CLI 工具

一个用于协调招聘多轮面试的命令行工具，支持候选人、面试官、会议室的资源协调和改期管理。

## 功能特性

- 📅 **面试排班**: 自动匹配可用的面试官和会议室
- 🔄 **改期管理**: 面试官临时改时间？一键重新协调
- 📋 **历史追踪**: 完整记录改期原因和操作者
- ⚠️ **冲突检测**: 自动检测面试官双重占用、会议室冲突、候选人轮次间隔
- 📊 **状态报告**: 已确认/待确认/爽约/改期一目了然

## 快速开始

### 1. 环境要求

- Python 3.9+
- 依赖: click, rich, python-dateutil

### 2. 安装

```bash
# 进入项目目录
cd /path/to/interview-scheduler

# 安装依赖
pip3 install click rich python-dateutil

# 开发模式运行（直接使用 python3 -m）
python3 -m interview_scheduler.cli --help
```

### 3. 初始化（造数）

```bash
# 初始化并加载样例数据
python3 -m interview_scheduler.cli init

# 强制重新初始化（覆盖现有数据）
python3 -m interview_scheduler.cli init --force
```

**内置样例数据包含:**
- 8 位候选人（研发、产品、销售岗位）
- 8 位面试官（覆盖各部门）
- 5 个会议室（不同容量和设备）
- 9 条轮次规则（不同岗位的初试/复试/终面规则）
- 6 个预设面试场景

## 主要演示路径

### 路径 1: 完整演示流程

```bash
# 一键运行完整演示
python3 -m interview_scheduler.cli demo
```

演示内容:
1. 查看当前状态统计
2. 查看提醒事项
3. 成功安排一个新面试
4. 失败场景：冲突检测演示
5. 最终状态汇总

### 路径 2: 手动操作流程

```bash
# 初始化
python3 -m interview_scheduler.cli init

# 查看所有面试
python3 -m interview_scheduler.cli list

# 查看状态统计和提醒
python3 -m interview_scheduler.cli check

# 查看某个面试的详情和历史
python3 -m interview_scheduler.cli detail intv_001

# 确认一个已安排的面试
python3 -m interview_scheduler.cli confirm intv_002

# 为新候选人安排面试
python3 -m interview_scheduler.cli schedule cand_005 first

# 改期一个面试
python3 -m interview_scheduler.cli reschedule intv_003 -r "面试官临时有会" -t "2026-05-15 10:00"

# 生成排班报告
python3 -m interview_scheduler.cli report
```

### 路径 3: 失败场景演示

**场景 1: 面试官时间冲突**
```bash
# 查看已占用时间段的面试
python3 -m interview_scheduler.cli detail intv_001

# 尝试在同一时间段安排另一个面试（应该失败）
python3 -m interview_scheduler.cli schedule cand_007 first --time "2026-05-13 09:00"
```

**场景 2: 候选人不存在**
```bash
python3 -m interview_scheduler.cli schedule nonexistent first
```

**场景 3: 标记爽约后的重排**
```bash
# 查看爽约的面试
python3 -m interview_scheduler.cli list -s no_show

# 查看该面试详情
python3 -m interview_scheduler.cli detail intv_005

# 重新安排
python3 -m interview_scheduler.cli reschedule intv_005 -r "重新安排爽约候选人"
```

## 内置样例场景说明

### 研发岗位
- **陈小明 (cand_001)**: 后端开发工程师
  - 初试 (intv_001): 已确认
  - 复试 (intv_004): 已安排
- **王技术 (cand_004)**: 前端开发工程师
  - 初试 (intv_005): 候选人爽约（需重排）
- **孙架构 (cand_007)**: 系统架构师 - 未安排
- **周数据 (cand_008)**: 数据分析工程师 - 未安排

### 产品岗位
- **刘小花 (cand_002)**: 产品经理
  - 初试 (intv_002): 已安排
  - 复试 (intv_006): 已安排
- **李产品 (cand_005)**: 高级产品经理 - 未安排

### 销售岗位
- **赵大伟 (cand_003)**: 销售经理
  - 初试 (intv_003): 已改期（有改期历史）
- **钱销售 (cand_006)**: 渠道销售 - 未安排

## 命令参考

### 核心命令

| 命令 | 说明 |
|------|------|
| `init` | 初始化工作目录 |
| `list` | 列出所有面试安排 |
| `detail <id>` | 查看面试详情和历史 |
| `schedule <candidate_id> <round>` | 安排新面试 |
| `reschedule <id>` | 改期面试 |
| `confirm <id>` | 确认面试 |
| `mark-no-show <id>` | 标记爽约 |
| `check` | 检查状态和提醒 |
| `report` | 生成排班报告 |
| `demo` | 运行演示流程 |

### 详细命令说明

#### init - 初始化
```bash
# 初始化并加载样例数据
python3 -m interview_scheduler.cli init

# 初始化空目录
python3 -m interview_scheduler.cli init --no-sample

# 强制覆盖
python3 -m interview_scheduler.cli init --force
```

#### list - 列出面试
```bash
# 列出所有
python3 -m interview_scheduler.cli list

# 按状态筛选
python3 -m interview_scheduler.cli list -s confirmed
python3 -m interview_scheduler.cli list -s pending
python3 -m interview_scheduler.cli list -s no_show

# 按候选人筛选
python3 -m interview_scheduler.cli list -c cand_001

# 按轮次筛选
python3 -m interview_scheduler.cli list -r first
```

#### schedule - 安排面试
```bash
# 自动分配时间
python3 -m interview_scheduler.cli schedule cand_005 first

# 指定时间
python3 -m interview_scheduler.cli schedule cand_005 first -t "2026-05-20 10:00"

# 指定面试官和会议室
python3 -m interview_scheduler.cli schedule cand_005 first -i intv_cai -i intv_wang -r room_a

# 指定操作者
python3 -m interview_scheduler.cli schedule cand_005 first -o "hr_zhangsan"
```

#### reschedule - 改期
```bash
# 自动分配新时间
python3 -m interview_scheduler.cli reschedule intv_003 -r "面试官临时有事"

# 指定新时间
python3 -m interview_scheduler.cli reschedule intv_003 -r "改期原因" -t "2026-05-15 14:00"

# 换面试官
python3 -m interview_scheduler.cli reschedule intv_003 -r "张工请假" -i intv_wang
```

#### mark-no-show - 标记爽约
```bash
# 候选人爽约
python3 -m interview_scheduler.cli mark-no-show intv_005 -r "电话无法接通"

# 面试官爽约
python3 -m interview_scheduler.cli mark-no-show intv_005 --who interviewer -r "面试官紧急出差"
```

#### report - 报告
```bash
# 表格形式全部报告
python3 -m interview_scheduler.cli report

# JSON 格式
python3 -m interview_scheduler.cli report -o json

# 筛选
python3 -m interview_scheduler.cli report -f confirmed
python3 -m interview_scheduler.cli report -f no_show
python3 -m interview_scheduler.cli report -f today
```

## 状态流转

```
待安排 (pending) → 已安排 (scheduled) → 已确认 (confirmed) → 已完成 (completed)
                           ↓
                    已改期 (rescheduled)
                           ↓
              候选人爽约/面试官爽约 (no_show)
                           ↓
                    (可重新安排)
```

## 排班规则

系统根据岗位类型自动应用不同的排班规则：

| 岗位 | 轮次 | 时长 | 面试官数 | 轮次间隔 | 必需设备 |
|------|------|------|----------|----------|----------|
| 研发 | 初试 | 45min | 2人 | 24小时 | 投影仪、白板 |
| 研发 | 复试 | 60min | 2人 | 24小时 | 投影仪、白板、视频会议 |
| 研发 | 终面 | 45min | 3人 | 24小时 | 投影仪、白板、视频会议 |
| 产品 | 初试 | 45min | 1人 | 24小时 | 投影仪、白板 |
| 产品 | 复试 | 60min | 2人 | 24小时 | 投影仪、白板 |
| 产品 | 终面 | 45min | 2人 | 24小时 | 投影仪、白板、视频会议 |
| 销售 | 初试 | 30min | 1人 | 24小时 | 白板 |
| 销售 | 复试 | 45min | 2人 | 24小时 | 白板 |
| 销售 | 终面 | 30min | 2人 | 24小时 | 白板、视频会议 |

## 冲突检测

系统会自动检测以下冲突：

1. **面试官双重占用**: 同一面试官同一时间有多个面试
2. **会议室冲突**: 同一会议室同一时间被多个面试占用
3. **轮次间隔不足**: 候选人多轮面试间隔小于 24 小时
4. **会议室容量不足**: 参会人数超过会议室容量
5. **设备不匹配**: 会议室缺少必需设备

## 幂等性说明

- 重复执行 `init` 命令（不带 `--force`）不会覆盖现有数据
- 数据使用 JSON 格式存储，可备份恢复
- 所有操作记录操作者和时间戳

## 数据文件

状态存储位置: `.interview_scheduler/state.json`

可以直接编辑此文件进行数据导入/导出。

## 项目结构

```
interview_scheduler/
├── __init__.py
├── models.py       # 数据模型
├── scheduler.py    # 核心业务逻辑
├── store.py        # 状态存储和样例数据
└── cli.py          # CLI 入口
```

## 演示检查清单

运行以下命令验证系统是否完整闭环：

```bash
# 1. 初始化
python3 -m interview_scheduler.cli init --force

# 2. 查看状态
python3 -m interview_scheduler.cli check

# 3. 检查已确认的面试
python3 -m interview_scheduler.cli list -s confirmed

# 4. 检查待确认的面试
python3 -m interview_scheduler.cli list -s pending

# 5. 检查爽约的面试
python3 -m interview_scheduler.cli list -s no_show

# 6. 查看一个有改期历史的面试
python3 -m interview_scheduler.cli detail intv_003

# 7. 安排一个新面试（成功路径）
python3 -m interview_scheduler.cli schedule cand_005 first

# 8. 尝试冲突时间安排（失败路径）
python3 -m interview_scheduler.cli schedule cand_007 first --time "2026-05-13 09:00"

# 9. 生成报告
python3 -m interview_scheduler.cli report
```

## 查看业务闭环

通过 `report` 命令可以快速判断业务是否闭环：

- ✅ **已确认**: 不需要处理
- ⏳ **待确认**: 需要跟进确认
- 🔄 **已改期**: 需要通知相关人员新时间
- ❌ **爽约**: 需要重新安排或评估是否继续流程
