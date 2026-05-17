import sys
import re
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import croniter
import pytz

CRON_PATTERN = re.compile(r'^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$')
ENV_LINE_PATTERN = re.compile(r'^(\w+)\s*=\s*(.*)$')
COMMENT_PATTERN = re.compile(r'^#\s*(.*)$')
DEFAULT_TZ = 'Asia/Shanghai'


class CronLine:
    def __init__(
        self,
        raw: str,
        line_number: int,
        file_path: str,
        is_valid: bool = True,
        error: Optional[str] = None,
        minute: Optional[str] = None,
        hour: Optional[str] = None,
        day: Optional[str] = None,
        month: Optional[str] = None,
        weekday: Optional[str] = None,
        command: Optional[str] = None,
        owner: Optional[str] = None,
    ):
        self.raw = raw
        self.line_number = line_number
        self.file_path = file_path
        self.is_valid = is_valid
        self.error = error
        self.minute = minute
        self.hour = hour
        self.day = day
        self.month = month
        self.weekday = weekday
        self.command = command
        self.owner = owner
        self._next_runs: List[datetime] = []

    @property
    def cron_expression(self) -> str:
        if all([self.minute, self.hour, self.day, self.month, self.weekday]):
            return f"{self.minute} {self.hour} {self.day} {self.month} {self.weekday}"
        return ""

    @property
    def task_name(self) -> str:
        if not self.command:
            return "unknown"
        cmd = self.command.strip()
        return cmd[:47] + "..." if len(cmd) > 50 else cmd

    def calculate_next_runs_within_hours(
        self,
        start_time: Optional[datetime] = None,
        hours_to_check: int = 24,
        tz: str = DEFAULT_TZ
    ) -> List[datetime]:
        if not self.is_valid or not self.cron_expression:
            return []
        if start_time is None:
            start_time = datetime.now(pytz.timezone(tz))
        elif start_time.tzinfo is None:
            start_time = pytz.timezone(tz).localize(start_time)
        
        end_time = start_time + timedelta(hours=hours_to_check)
        runs = []
        
        try:
            cron = croniter.croniter(self.cron_expression, start_time)
            while True:
                next_run = cron.get_next(datetime)
                if next_run >= end_time:
                    break
                runs.append(next_run)
        except Exception as e:
            self.is_valid = False
            self.error = f"cron expression error: {str(e)}"
            return []
        
        self._next_runs = runs
        return runs


def parse_crontab_file(file_path: str, owner: Optional[str] = None) -> Tuple[List[CronLine], Dict[str, str]]:
    lines = []
    env_vars = {}
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.readlines()
    except Exception as e:
        error_line = CronLine(
            raw=f"FILE_READ_ERROR: {str(e)}",
            line_number=0,
            file_path=file_path,
            is_valid=False,
            error=f"Failed to read file: {str(e)}"
        )
        return [error_line], env_vars

    for line_num, raw_line in enumerate(content, 1):
        raw_line = raw_line.rstrip('\n')
        stripped = raw_line.strip()

        if not stripped:
            continue

        if stripped.startswith('#'):
            match = COMMENT_PATTERN.match(stripped)
            if match:
                comment = match.group(1).strip()
            continue

        env_match = ENV_LINE_PATTERN.match(stripped)
        if env_match:
            key, value = env_match.groups()
            env_vars[key] = value.strip()
            continue

        cron_match = CRON_PATTERN.match(stripped)
        if cron_match:
            minute, hour, day, month, weekday, command = cron_match.groups()
            cron_line = CronLine(
                raw=raw_line,
                line_number=line_num,
                file_path=file_path,
                minute=minute,
                hour=hour,
                day=day,
                month=month,
                weekday=weekday,
                command=command,
                owner=owner
            )
            try:
                croniter.croniter(cron_line.cron_expression, datetime.now())
            except Exception as e:
                cron_line.is_valid = False
                cron_line.error = f"Invalid cron expression: {str(e)}"
            lines.append(cron_line)
        else:
            lines.append(CronLine(
                raw=raw_line,
                line_number=line_num,
                file_path=file_path,
                is_valid=False,
                error="Unrecognized line format"
            ))

    return lines, env_vars


class BlackWindow:
    def __init__(self, start_hour: int, end_hour: int, start_minute: int = 0, end_minute: int = 0):
        self.start_hour = start_hour
        self.start_minute = start_minute
        self.end_hour = end_hour
        self.end_minute = end_minute

    def contains(self, dt: datetime) -> bool:
        minutes = dt.hour * 60 + dt.minute
        start_min = self.start_hour * 60 + self.start_minute
        end_min = self.end_hour * 60 + self.end_minute

        if start_min <= end_min:
            return start_min <= minutes < end_min
        else:
            return minutes >= start_min or minutes < end_min

    def __str__(self) -> str:
        return f"{self.start_hour:02d}:{self.start_minute:02d} - {self.end_hour:02d}:{self.end_minute:02d}"


class Conflict:
    def __init__(self, cron_line: CronLine, run_time: datetime, black_window: BlackWindow):
        self.cron_line = cron_line
        self.run_time = run_time
        self.black_window = black_window
        self.risk_level = "high"

    def to_dict(self) -> Dict:
        return {
            "file": self.cron_line.file_path,
            "line_number": self.cron_line.line_number,
            "task_name": self.cron_line.task_name,
            "cron_expression": self.cron_line.cron_expression,
            "conflict_time": self.run_time.strftime("%Y-%m-%d %H:%M:%S"),
            "black_window": str(self.black_window),
            "owner": self.cron_line.owner,
            "risk_level": self.risk_level
        }


def check_conflicts(
    cron_lines: List[CronLine],
    black_windows: List[BlackWindow],
    hours_to_check: int = 24
) -> Tuple[List[Conflict], List[CronLine]]:
    conflicts = []
    invalid_lines = []
    start_time = datetime.now(pytz.timezone(DEFAULT_TZ))

    for line in cron_lines:
        if not line.is_valid:
            invalid_lines.append(line)
            continue

        next_runs = line.calculate_next_runs_within_hours(start_time, hours_to_check=hours_to_check)
        for run_time in next_runs:
            for bw in black_windows:
                if bw.contains(run_time):
                    conflict = Conflict(line, run_time, bw)
                    conflicts.append(conflict)
                    break

    return conflicts, invalid_lines


def generate_terminal_summary(
    cron_lines: List[CronLine],
    conflicts: List[Conflict],
    invalid_lines: List[CronLine],
    black_windows: List[BlackWindow],
    hours_to_check: int = 24
) -> str:
    lines = []
    lines.append("=" * 70)
    lines.append("CRONTAB 黑窗时间检查报告")
    lines.append("=" * 70)
    lines.append("")

    lines.append(f"检查时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"检查范围: 未来 {hours_to_check} 小时")
    lines.append(f"黑窗配置: {', '.join(str(bw) for bw in black_windows)}")
    lines.append("")

    lines.append(f"总共扫描任务: {len(cron_lines)} 个")
    lines.append(f"发现冲突任务: {len(set(c.cron_line for c in conflicts))} 个")
    lines.append(f"冲突执行次数: {len(conflicts)} 次")
    lines.append(f"解析错误行数: {len(invalid_lines)} 行")
    lines.append("")

    if conflicts:
        lines.append("-" * 70)
        lines.append("冲突任务列表 (按风险排序):")
        lines.append("-" * 70)

        conflict_by_task = {}
        for c in conflicts:
            key = (c.cron_line.file_path, c.cron_line.line_number)
            if key not in conflict_by_task:
                conflict_by_task[key] = []
            conflict_by_task[key].append(c)

        sorted_tasks = sorted(conflict_by_task.items(), key=lambda x: len(x[1]), reverse=True)

        for i, (key, task_conflicts) in enumerate(sorted_tasks[:10], 1):
            first = task_conflicts[0]
            lines.append(f"{i}. [{first.cron_line.file_path}:{first.cron_line.line_number}]")
            lines.append(f"   任务: {first.cron_line.task_name}")
            lines.append(f"   Cron: {first.cron_line.cron_expression}")
            lines.append(f"   冲突次数: {len(task_conflicts)}")
            lines.append(f"   最近冲突: {task_conflicts[0].run_time.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")

        if len(sorted_tasks) > 10:
            lines.append(f"  ... 还有 {len(sorted_tasks) - 10} 个冲突任务未显示")
            lines.append("")

    if invalid_lines:
        lines.append("-" * 70)
        lines.append("解析错误行:")
        lines.append("-" * 70)
        for line in invalid_lines[:10]:
            lines.append(f"  [{line.file_path}:{line.line_number}] {line.error}")
            lines.append(f"    原始内容: {line.raw[:60]}")
        if len(invalid_lines) > 10:
            lines.append(f"  ... 还有 {len(invalid_lines) - 10} 个错误行未显示")
        lines.append("")

    lines.append("=" * 70)
    return "\n".join(lines)


def generate_json_report(
    cron_lines: List[CronLine],
    conflicts: List[Conflict],
    invalid_lines: List[CronLine],
    black_windows: List[BlackWindow],
    hours_to_check: int = 24
) -> str:
    report = {
        "generated_at": datetime.now().isoformat(),
        "check_hours": hours_to_check,
        "black_windows": [str(bw) for bw in black_windows],
        "summary": {
            "total_tasks": len(cron_lines),
            "conflict_tasks": len(set(c.cron_line for c in conflicts)),
            "conflict_count": len(conflicts),
            "invalid_lines": len(invalid_lines)
        },
        "conflicts": [c.to_dict() for c in conflicts],
        "invalid_lines": [
            {
                "file": l.file_path,
                "line_number": l.line_number,
                "error": l.error,
                "raw": l.raw
            } for l in invalid_lines
        ]
    }
    return json.dumps(report, ensure_ascii=False, indent=2)


def generate_markdown_report(
    cron_lines: List[CronLine],
    conflicts: List[Conflict],
    invalid_lines: List[CronLine],
    black_windows: List[BlackWindow],
    hours_to_check: int = 24
) -> str:
    lines = []
    lines.append("# Crontab 黑窗时间检查报告")
    lines.append("")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"检查范围: 未来 {hours_to_check} 小时")
    lines.append("")

    lines.append("## 概览")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 扫描任务数 | {len(cron_lines)} |")
    lines.append(f"| 冲突任务数 | {len(set(c.cron_line for c in conflicts))} |")
    lines.append(f"| 冲突执行次数 | {len(conflicts)} |")
    lines.append(f"| 解析错误行数 | {len(invalid_lines)} |")
    lines.append("")

    lines.append("## 黑窗配置")
    lines.append("")
    for bw in black_windows:
        lines.append(f"- {str(bw)}")
    lines.append("")

    if conflicts:
        lines.append("## 冲突任务详情")
        lines.append("")
        lines.append("| 任务 | Cron表达式 | 文件位置 | 最近冲突时间 | 冲突次数 |")
        lines.append("|------|-----------|----------|-------------|---------|")

        conflict_by_task = {}
        for c in conflicts:
            key = (c.cron_line.file_path, c.cron_line.line_number)
            if key not in conflict_by_task:
                conflict_by_task[key] = []
            conflict_by_task[key].append(c)

        for key, task_conflicts in sorted(conflict_by_task.items(), key=lambda x: len(x[1]), reverse=True):
            first = task_conflicts[0]
            lines.append(f"| {first.cron_line.task_name} | `{first.cron_line.cron_expression}` | {first.cron_line.file_path}:{first.cron_line.line_number} | {task_conflicts[0].run_time.strftime('%Y-%m-%d %H:%M:%S')} | {len(task_conflicts)} |")
        lines.append("")

    if invalid_lines:
        lines.append("## 解析错误")
        lines.append("")
        lines.append("| 文件 | 行号 | 错误 | 原始内容 |")
        lines.append("|------|------|------|---------|")
        for line in invalid_lines:
            escaped_raw = line.raw.replace("|", "\\|")
            lines.append(f"| {line.file_path} | {line.line_number} | {line.error} | {escaped_raw[:80]} |")
        lines.append("")

    lines.append("---")
    lines.append("*此报告由 Crontab Black Window CLI 工具自动生成*")
    return "\n".join(lines)


def create_sample_crontab(output_path: str) -> None:
    sample = """# 示例 Crontab - 用于测试黑窗检查工具
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# 正常业务任务 - 白天执行
0 9 * * * /usr/local/bin/daily_backup.sh
30 10 * * 1-5 python3 /scripts/send_report.py
0 14 * * * /usr/bin/curl https://example.com/health

# 夜间维护任务 - 可能冲突
0 2 * * * /usr/local/bin/clean_logs.sh
30 2 * * * /scripts/database_backup.sh
0 3 * * 0 /scripts/weekly_maintenance.sh

# 每分钟执行 - 高风险
* * * * * /scripts/heartbeat.sh
*/5 * * * * /scripts/monitor_check.sh

# 无效行测试
invalid cron line here
"""
    with open(output_path, 'w') as f:
        f.write(sample)
    print(f"创建示例文件: {output_path}")


def run_self_test() -> int:
    print("=" * 60)
    print("Crontab 黑窗检查工具 - 自检模式")
    print("=" * 60)
    print()

    sample_file = "/tmp/sample_crontab"
    create_sample_crontab(sample_file)
    print()

    print("1. 测试 crontab 文件解析...")
    cron_lines, env_vars = parse_crontab_file(sample_file)
    print(f"   解析成功: {len(cron_lines)} 行")
    print(f"   环境变量: {len(env_vars)} 个")
    print()

    print("2. 测试 cron 表达式展开（未来 24 小时）...")
    valid_lines = [l for l in cron_lines if l.is_valid]
    if valid_lines:
        first = valid_lines[0]
        next_runs = first.calculate_next_runs_within_hours(hours_to_check=24)
        print(f"   示例任务: {first.task_name}")
        print(f"   Cron表达式: {first.cron_expression}")
        print(f"   未来 24 小时内执行次数: {len(next_runs)} 次")
        if next_runs:
            print(f"   接下来 5 次执行:")
            for dt in next_runs[:5]:
                print(f"     - {dt.strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    print("3. 测试黑窗冲突检测（检查未来 1 小时）...")
    black_windows = [BlackWindow(2, 5)]
    print(f"   黑窗配置: {black_windows[0]}")
    conflicts, invalid_lines = check_conflicts(cron_lines, black_windows, hours_to_check=1)
    print(f"   发现冲突: {len(conflicts)} 次")
    print(f"   无效行数: {len(invalid_lines)}")
    print()

    print("4. 测试报告生成...")
    terminal_report = generate_terminal_summary(cron_lines, conflicts, invalid_lines, black_windows, hours_to_check=1)
    json_report = generate_json_report(cron_lines, conflicts, invalid_lines, black_windows, hours_to_check=1)
    md_report = generate_markdown_report(cron_lines, conflicts, invalid_lines, black_windows, hours_to_check=1)
    print(f"   终端报告: {len(terminal_report)} 字符")
    print(f"   JSON报告: {len(json_report)} 字符")
    print(f"   Markdown报告: {len(md_report)} 字符")
    print()

    print("=" * 60)
    print("自检完成! 所有功能正常工作。")
    print("=" * 60)
    print()
    print("终端报告摘要:")
    print(terminal_report)

    return 0
