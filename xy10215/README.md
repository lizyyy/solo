# 口腔正畸复诊提醒器

## 安装运行

```bash
pip install -r requirements.txt
python cli.py init
```

## 样例入口

```bash
python demo.py
```

这将执行完整业务流程演示：
1. 初始化数据库
2. 加载样例数据（3名医生、2周排班、6名不同复诊周期的患者）
3. 执行日常处理（复诊窗口检测、逾期标记）
4. 完成复诊、重新安排、记录托槽脱落
5. 导出报告、验证重跑机制

## 核心操作

### 查询

```bash
python cli.py doctors                # 医生列表
python cli.py patients               # 患者列表
python cli.py patient-plans 1        # 患者1的复诊计划
python cli.py schedules              # 可用排班
python cli.py events                 # 异常事件
python cli.py events --unresolved    # 未解决事件
python cli.py runs                   # 运行记录
python cli.py run-details <批次>     # 运行详情
python cli.py exports                # 导出记录
```

### 业务操作

```bash
python cli.py daily --date 2026-05-10 --export    # 日常处理并导出报告
python cli.py complete 1 --actual-date 2026-05-10 # 完成复诊计划1
python cli.py reschedule 1 2026-05-17             # 重排计划1到5月17日
python cli.py bracket 1 --description "托槽脱落"  # 记录患者1托槽脱落
python cli.py resolve 1                           # 标记事件1已解决
```

### 导出报告

```bash
python cli.py export-daily --date 2026-05-10      # 每日报告
python cli.py export-overdue --date 2026-05-10    # 逾期报告
python cli.py export-run <批次>                    # 运行日志报告
```

### 清理工具

```bash
python cli.py cleanup-failed      # 清理失败的运行批次
python cli.py cleanup-orphan    # 清理孤立的导出文件
python cli.py cleanup-full --confirm  # 完全清理
```

## 检查结果

运行演示后，检查以下内容验证业务联动：

1. **复诊周期处理**
   ```bash
   python cli.py patient-plans 1
   ```
   应看到患者根据其复诊周期（2/4/6周）生成的所有计划，状态随处理流程变化。

2. **异常事件与排班联动**
   ```bash
   python cli.py events --patient-id 1
   ```
   托槽脱落事件应触发相关计划重新安排，并影响排班预约数。

3. **运行留痕**
   ```bash
   python cli.py runs
   python cli.py run-details <批次>
   ```
   每次操作都有独立批次，包含统计信息和变更历史。

4. **重跑一致性**
   多次执行 `python cli.py daily`，观察影响计划数是否递减（已处理的不再重复处理）。

5. **导出文件**
   检查 `exports/` 目录中的CSV报告，与数据库中导出记录比对。
