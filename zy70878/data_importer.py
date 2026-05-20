import csv
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from models import (
    Supervisor, Student, ApplicationChoice, AdjustmentRecord,
    AdjustmentType
)


class DataImporter:
    @staticmethod
    def import_supervisors_from_csv(file_path: str) -> Dict[str, Supervisor]:
        supervisors = {}
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                supervisor = Supervisor(
                    id=row['导师工号'],
                    name=row['导师姓名'],
                    department=row['所属学院'],
                    major=row['招生专业'],
                    title=row['职称'],
                    total_quota=int(row['总名额']),
                    used_quota=int(row.get('已用名额', 0))
                )
                supervisors[supervisor.id] = supervisor
        return supervisors

    @staticmethod
    def import_students_from_csv(file_path: str) -> Dict[str, Student]:
        students = {}
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                student = Student(
                    id=row['考生编号'],
                    name=row['考生姓名'],
                    id_card=row['身份证号'],
                    undergraduate_major=row['本科专业'],
                    undergraduate_school=row['本科院校'],
                    application_major=row['报考专业'],
                    total_score=float(row['总分']),
                    exam_score=float(row['初试成绩']),
                    interview_score=float(row['复试成绩'])
                )
                students[student.id] = student
        return students

    @staticmethod
    def import_choices_from_json(file_path: str) -> List[ApplicationChoice]:
        choices = []
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for item in data:
                choice = ApplicationChoice(
                    student_id=item['student_id'],
                    supervisor_id=item['supervisor_id'],
                    preference_order=int(item['preference_order']),
                    is_cross_major=bool(item.get('is_cross_major', False))
                )
                choices.append(choice)
        return choices

    @staticmethod
    def import_adjustments_from_json(file_path: str) -> List[AdjustmentRecord]:
        adjustments = []
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for item in data:
                adjustment = AdjustmentRecord(
                    id=item.get('id', str(uuid.uuid4())),
                    student_id=item['student_id'],
                    from_supervisor_id=item.get('from_supervisor_id'),
                    to_supervisor_id=item['to_supervisor_id'],
                    adjustment_batch=AdjustmentType[item['adjustment_batch']],
                    adjustment_time=datetime.fromisoformat(item['adjustment_time']),
                    operator=item['operator'],
                    reason=item['reason'],
                    source_batch=item.get('source_batch')
                )
                adjustments.append(adjustment)
        return adjustments

    @staticmethod
    def import_adjustments_from_csv(file_path: str) -> List[AdjustmentRecord]:
        adjustments = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                adjustment = AdjustmentRecord(
                    id=row.get('记录ID', str(uuid.uuid4())),
                    student_id=row['考生编号'],
                    from_supervisor_id=row.get('原导师工号') if row.get('原导师工号') else None,
                    to_supervisor_id=row['现导师工号'],
                    adjustment_batch=AdjustmentType[row['调剂批次']],
                    adjustment_time=datetime.fromisoformat(row['调剂时间']),
                    operator=row['操作人'],
                    reason=row['调剂原因'],
                    source_batch=row.get('来源批次')
                )
                adjustments.append(adjustment)
        return adjustments
