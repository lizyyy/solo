from datetime import datetime
from typing import Optional, Tuple


class DateParser:
    def __init__(self, date_formats):
        self.date_formats = date_formats
    
    def parse(self, date_str: str) -> Tuple[Optional[datetime], Optional[str]]:
        if not date_str or str(date_str).strip() == '':
            return None, "日期为空"
        
        date_str = str(date_str).strip()
        
        for fmt in self.date_formats:
            try:
                parsed = datetime.strptime(date_str, fmt)
                if fmt in ["%Y-%m", "%Y/%m", "%Y年%m月"]:
                    if parsed.month == 12:
                        parsed = parsed.replace(day=31)
                    else:
                        parsed = parsed.replace(month=parsed.month + 1, day=1)
                        parsed = parsed.replace(day=1) - timedelta(days=1)
                return parsed, None
            except ValueError:
                continue
        
        return None, f"无法解析日期格式: {date_str}"


from datetime import timedelta
