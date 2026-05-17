import re
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
import croniter
import pytz


CRON_PATTERN = re.compile(
    r'^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$'
)

ENV_LINE_PATTERN = re.compile(r'^(\w+)\s*=\s*(.*)$')
COMMENT_PATTERN = re.compile(r'^#\s*(.*)$')


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
        task_name: Optional[str] = None,
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
        self.task_name = task_name or self._extract_task_name()
        self.owner = owner
        self._next_runs: List[datetime] = []

    def _extract_task_name(self) -> str:
        if not self.command:
            return "unknown"
        cmd = self.command.strip()
        if len(cmd) > 50:
            return cmd[:47] + "..."
        return cmd

    @property
    def cron_expression(self) -> str:
        if all([self.minute, self.hour, self.day, self.month, self.weekday]):
            return f"{self.minute} {self.hour} {self.day} {self.month} {self.weekday}"
        return ""

    def calculate_next_runs(
        self,
        start_time: Optional[datetime] = None,
        count: int = 10,
        tz: str = "Asia/Shanghai"
    ) -> List[datetime]:
        if not self.is_valid or not self.cron_expression:
            return []
        if start_time is None:
            start_time = datetime.now(pytz.timezone(tz))
        elif start_time.tzinfo is None:
            start_time = pytz.timezone(tz).localize(start_time)
        
        try:
            cron = croniter.croniter(self.cron_expression, start_time)
            self._next_runs = [cron.get_next(datetime) for _ in range(count)]
            return self._next_runs
        except Exception as e:
            self.is_valid = False
            self.error = f"cron expression error: {str(e)}"
            return []


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
