import csv
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Tuple

from .models import OUTPUT_COLUMNS, VisitorRecord, TimeoutResult

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_THRESHOLD = timedelta(hours=8)
DATETIME_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y/%m/%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y/%m/%d %H:%M",
]


def parse_datetime(dt_str: str) -> datetime:
    if not dt_str or dt_str.strip() == "":
        return None
    dt_str = dt_str.strip()
    for fmt in DATETIME_FORMATS:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析日期时间: {dt_str}")


def parse_bool(val: str) -> bool:
    if not val:
        return False
    val = val.strip().lower()
    return val in ("true", "1", "yes", "是", "跨楼层", "手工放行")


class VisitorProcessor:
    def __init__(self, timeout_hours: float = 8.0):
        self.timeout_threshold = timedelta(hours=timeout_hours)
        self.errors = []

    def read_csv_file(self, file_path: Path) -> List[VisitorRecord]:
        records = []
        if not file_path.exists():
            logger.warning(f"文件不存在: {file_path}")
            return records

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for line_num, row in enumerate(reader, start=2):
                    try:
                        record = self._parse_row(row, line_num, file_path.name)
                        if record:
                            records.append(record)
                    except Exception as e:
                        self.errors.append(f"{file_path.name}:{line_num} - {str(e)}")
                        logger.warning(f"跳过坏行 {file_path.name}:{line_num}: {e}")
        except Exception as e:
            logger.error(f"读取文件失败 {file_path}: {e}")
            raise

        return records

    def _parse_row(self, row: dict, line_num: int, filename: str) -> VisitorRecord:
        def get_col(*names):
            for name in names:
                if name in row:
                    return row[name]
            return ""

        visitor_id = get_col("visitor_id", "访客ID", "ID").strip()
        visitor_name = get_col("visitor_name", "访客姓名", "姓名").strip()
        company = get_col("company", "公司", "所属公司").strip()
        visit_floor = get_col("visit_floor", "访问楼层", "楼层").strip()

        if not visitor_id:
            raise ValueError("访客ID不能为空")
        if not visitor_name:
            raise ValueError("访客姓名不能为空")

        checkin_str = get_col("checkin_time", "签到时间", "进入时间")
        checkout_str = get_col("checkout_time", "签离时间", "离开时间")

        try:
            checkin_time = parse_datetime(checkin_str)
            if not checkin_time:
                raise ValueError("签到时间无效")
        except ValueError as e:
            raise ValueError(f"签到时间解析失败: {e}")

        try:
            checkout_time = parse_datetime(checkout_str)
        except ValueError:
            checkout_time = None

        is_cross_floor = parse_bool(get_col("is_cross_floor", "跨楼层通行", "跨楼层"))
        is_manual_release = parse_bool(get_col("is_manual_release", "手工放行", "手动放行"))
        remarks = get_col("remarks", "备注", "说明").strip()

        return VisitorRecord(
            visitor_id=visitor_id,
            visitor_name=visitor_name,
            company=company,
            visit_floor=visit_floor,
            checkin_time=checkin_time,
            checkout_time=checkout_time,
            is_cross_floor=is_cross_floor,
            is_manual_release=is_manual_release,
            remarks=remarks,
        )

    def calculate_timeout(self, record: VisitorRecord, end_time: datetime = None) -> Tuple[bool, int]:
        if end_time is None:
            end_time = datetime.now()

        effective_checkout = record.checkout_time or end_time
        duration = effective_checkout - record.checkin_time

        is_timeout = duration > self.timeout_threshold
        timeout_minutes = int(duration.total_seconds() // 60)

        return is_timeout, timeout_minutes

    def process_directory(self, input_dir: Path, end_time: datetime = None) -> List[TimeoutResult]:
        if not input_dir.exists():
            raise FileNotFoundError(f"输入目录不存在: {input_dir}")
        if not input_dir.is_dir():
            raise NotADirectoryError(f"输入路径不是目录: {input_dir}")

        csv_files = sorted(input_dir.glob("*.csv"))
        if not csv_files:
            logger.info(f"目录中没有CSV文件: {input_dir}")
            return []

        all_records = []
        for csv_file in csv_files:
            logger.info(f"处理文件: {csv_file.name}")
            records = self.read_csv_file(csv_file)
            all_records.extend(records)

        logger.info(f"共读取 {len(all_records)} 条有效记录")

        results = []
        for record in all_records:
            is_timeout, timeout_minutes = self.calculate_timeout(record, end_time)
            if is_timeout or record.is_cross_floor or record.is_manual_release:
                checkout_str = record.checkout_time.strftime("%Y-%m-%d %H:%M:%S") if record.checkout_time else "未签离"
                result = TimeoutResult(
                    visitor_id=record.visitor_id,
                    visitor_name=record.visitor_name,
                    company=record.company,
                    visit_floor=record.visit_floor,
                    checkin_time=record.checkin_time.strftime("%Y-%m-%d %H:%M:%S"),
                    checkout_time=checkout_str,
                    timeout_duration_minutes=timeout_minutes,
                    is_cross_floor=record.is_cross_floor,
                    is_manual_release=record.is_manual_release,
                    remarks=record.remarks,
                )
                results.append(result)

        results.sort(key=lambda r: (r.visit_floor, r.checkin_time, r.visitor_id))
        logger.info(f"找到 {len(results)} 条超时/特殊记录")

        return results

    def write_results(self, results: List[TimeoutResult], output_path: Path):
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(OUTPUT_COLUMNS)
            for r in results:
                writer.writerow([
                    r.visitor_id,
                    r.visitor_name,
                    r.company,
                    r.visit_floor,
                    r.checkin_time,
                    r.checkout_time,
                    r.timeout_duration_minutes,
                    "是" if r.is_cross_floor else "否",
                    "是" if r.is_manual_release else "否",
                    r.remarks,
                ])
        logger.info(f"结果已写入: {output_path}")
