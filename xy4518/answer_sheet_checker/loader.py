"""数据加载器模块 - 读取各种输入文件。"""

import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .models import AbsentRecord, GradingBatch, Student


class DataLoader:
    """数据加载器。"""

    @staticmethod
    def load_seat_table(csv_path: str) -> Dict[str, Student]:
        """
        读取考场座位表 CSV。

        CSV 格式要求：
        - 必须包含字段: student_id, name, room_number, seat_number
        - 可选字段: department, class_name

        Args:
            csv_path: CSV 文件路径

        Returns:
            以 student_id 为键的学生字典
        """
        students: Dict[str, Student] = {}
        file_path = Path(csv_path)

        if not file_path.exists():
            raise FileNotFoundError(f"座位表文件不存在: {csv_path}")

        with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)

            for row in reader:
                student_id = row.get("student_id", "").strip()
                if not student_id:
                    continue

                try:
                    seat_number = int(row.get("seat_number", "0"))
                except ValueError:
                    seat_number = 0

                student = Student(
                    student_id=student_id,
                    name=row.get("name", "").strip(),
                    room_number=row.get("room_number", "").strip(),
                    seat_number=seat_number,
                    department=row.get("department", "").strip() or None,
                    class_name=row.get("class_name", "").strip() or None,
                )
                students[student_id] = student

        return students

    @staticmethod
    def load_absent_list(csv_path: str) -> Dict[str, AbsentRecord]:
        """
        读取缺考签名单 CSV。

        CSV 格式要求：
        - 必须包含字段: student_id, room_number, seat_number
        - 可选字段: reason

        Args:
            csv_path: CSV 文件路径

        Returns:
            以 student_id 为键的缺考记录字典
        """
        absent_records: Dict[str, AbsentRecord] = {}
        file_path = Path(csv_path)

        if not file_path.exists():
            raise FileNotFoundError(f"缺考签名单文件不存在: {csv_path}")

        with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)

            for row in reader:
                student_id = row.get("student_id", "").strip()
                if not student_id:
                    continue

                try:
                    seat_number = int(row.get("seat_number", "0"))
                except ValueError:
                    seat_number = 0

                record = AbsentRecord(
                    student_id=student_id,
                    room_number=row.get("room_number", "").strip(),
                    seat_number=seat_number,
                    reason=row.get("reason", "").strip() or None,
                    recorded_at=datetime.now(),
                )
                absent_records[student_id] = record

        return absent_records

    @staticmethod
    def load_grading_batch(json_path: str) -> GradingBatch:
        """
        读取阅卷批次 JSON。

        JSON 格式要求：
        {
            "batch_id": "批次ID",
            "exam_name": "考试名称",
            "exam_date": "考试日期",
            "course_code": "课程代码",
            "course_name": "课程名称",
            "total_students": 总人数,
            "rooms": ["考场1", "考场2", ...]
        }

        Args:
            json_path: JSON 文件路径

        Returns:
            阅卷批次对象
        """
        file_path = Path(json_path)

        if not file_path.exists():
            raise FileNotFoundError(f"阅卷批次文件不存在: {json_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return GradingBatch(
            batch_id=data.get("batch_id", ""),
            exam_name=data.get("exam_name", ""),
            exam_date=data.get("exam_date", ""),
            course_code=data.get("course_code", ""),
            course_name=data.get("course_name", ""),
            total_students=data.get("total_students", 0),
            rooms=data.get("rooms", []),
        )

    @staticmethod
    def scan_sheets_folder(folder_path: str) -> List[str]:
        """
        扫描答题卡文件夹，获取所有图片和 PDF 文件路径。

        支持的格式: .jpg, .jpeg, .png, .pdf

        Args:
            folder_path: 文件夹路径

        Returns:
            文件路径列表
        """
        path = Path(folder_path)

        if not path.exists():
            raise FileNotFoundError(f"答题卡文件夹不存在: {folder_path}")

        if not path.is_dir():
            raise NotADirectoryError(f"路径不是目录: {folder_path}")

        supported_extensions = {".jpg", ".jpeg", ".png", ".pdf"}
        files: List[str] = []

        for ext in supported_extensions:
            files.extend(str(f) for f in path.rglob(f"*{ext}"))
            files.extend(str(f) for f in path.rglob(f"*{ext.upper()}"))

        return sorted(files)

    @staticmethod
    def load_remarks(remarks_path: str) -> Dict[str, str]:
        """
        加载备注数据。

        Args:
            remarks_path: 备注文件路径 (JSON)

        Returns:
            备注字典
        """
        path = Path(remarks_path)

        if not path.exists():
            return {}

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
                return {}
        except (json.JSONDecodeError, ValueError):
            return {}

    @staticmethod
    def save_remarks(remarks: Dict[str, str], remarks_path: str) -> None:
        """
        保存备注数据。

        Args:
            remarks: 备注字典
            remarks_path: 备注文件路径
        """
        path = Path(remarks_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(remarks, f, ensure_ascii=False, indent=2)
