import csv
import json
import re
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

from models import Slide, BorrowRecord, DepartmentRule, SlideStatus, ValidationResult


class DataImporter:
    REQUIRED_SLIDE_FIELDS = ['slide_id', 'patient_id', 'specimen_type',
                             'collection_date', 'department', 'storage_location']

    REQUIRED_BORROW_FIELDS = ['record_id', 'slide_id', 'borrower_name',
                             'borrower_dept', 'borrow_date', 'expected_return_date']

    REQUIRED_RULE_FIELDS = ['department', 'max_borrow_days', 'max_concurrent_borrows']

    DATE_FORMATS = ["%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"]

    def __init__(self, db):
        self.db = db

    def parse_date(self, date_str: str) -> Optional[str]:
        date_str = date_str.strip()
        for fmt in self.DATE_FORMATS:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return None

    def validate_slide_csv(self, file_path: str) -> ValidationResult:
        result = ValidationResult()
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            if not rows:
                result.add_error("file", "CSV文件为空")
                return result

            header = rows[0].keys() if rows else []
            missing_fields = [f for f in self.REQUIRED_SLIDE_FIELDS if f not in header]
            if missing_fields:
                result.add_error("header", f"缺少必需字段: {', '.join(missing_fields)}")
                return result

            seen_ids = set()
            for idx, row in enumerate(rows, 1):
                slide_id = row.get('slide_id', '').strip()
                if not slide_id:
                    result.add_error(f"row_{idx}", "slide_id不能为空", row)
                    continue

                if slide_id in seen_ids:
                    result.add_warning(f"第{idx}行: 切片ID '{slide_id}' 重复")
                seen_ids.add(slide_id)

                existing_slide = self.db.get_slide(slide_id)
                if existing_slide and existing_slide.status != SlideStatus.AVAILABLE:
                    result.add_warning(f"第{idx}行: 切片 '{slide_id}' 当前状态为 '{existing_slide.status.value}'，非在库状态")

                if not row.get('patient_id', '').strip():
                    result.add_error(f"row_{idx}", f"切片 '{slide_id}' 的 patient_id 不能为空", row)

                date_str = row.get('collection_date', '').strip()
                if not self.parse_date(date_str):
                    result.add_error(f"row_{idx}", f"切片 '{slide_id}' 的 collection_date 格式无效: {date_str}", row)

        except FileNotFoundError:
            result.add_error("file", f"文件不存在: {file_path}")
        except Exception as e:
            result.add_error("file", f"读取文件失败: {str(e)}")

        return result

    def import_slide_csv(self, file_path: str) -> tuple[List[Slide], ValidationResult]:
        result = self.validate_slide_csv(file_path)
        slides = []

        if result.is_valid or not result.errors:
            try:
                with open(file_path, 'r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        slide = Slide(
                            slide_id=row['slide_id'].strip(),
                            patient_id=row['patient_id'].strip(),
                            specimen_type=row['specimen_type'].strip(),
                            collection_date=self.parse_date(row['collection_date'].strip()) or row['collection_date'].strip(),
                            department=row['department'].strip(),
                            storage_location=row['storage_location'].strip(),
                            status=SlideStatus.AVAILABLE,
                            notes=row.get('notes', '').strip()
                        )
                        slides.append(slide)
            except Exception as e:
                result.add_error("import", f"导入失败: {str(e)}")

        return slides, result

    def validate_borrow_json(self, file_path: str) -> ValidationResult:
        result = ValidationResult()
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, dict):
                if 'borrows' in data:
                    records = data['borrows']
                else:
                    records = [data]
            elif isinstance(data, list):
                records = data
            else:
                result.add_error("format", "JSON格式无效，应为对象或数组")
                return result

            if not records:
                result.add_error("data", "没有借阅记录")
                return result

            seen_records = set()
            for idx, rec in enumerate(records):
                if not isinstance(rec, dict):
                    result.add_error(f"record_{idx}", "记录格式无效", rec)
                    continue

                missing = [f for f in self.REQUIRED_BORROW_FIELDS if f not in rec or not rec[f]]
                if missing:
                    result.add_error(f"record_{idx}", f"缺少必需字段: {', '.join(missing)}", rec)
                    continue

                record_id = rec['record_id']
                if record_id in seen_records:
                    result.add_error(f"record_{idx}", f"记录ID '{record_id}' 重复", rec)
                seen_records.add(record_id)

                slide_id = rec['slide_id']
                slide = self.db.get_slide(slide_id)
                if not slide:
                    result.add_warning(f"记录 '{record_id}': 切片 '{slide_id}' 不存在于台账中")
                    continue

                active_borrow = self.db.get_active_borrow_by_slide(slide_id)
                if active_borrow and active_borrow.record_id != record_id:
                    result.add_error(f"记录_{idx}", f"切片 '{slide_id}' 已有借阅记录 '{active_borrow.record_id}' 未归还", rec)

                borrow_date = self.parse_date(rec['borrow_date'])
                return_date = self.parse_date(rec.get('actual_return_date', ''))

                if not borrow_date:
                    result.add_error(f"record_{idx}", f"借阅日期格式无效: {rec['borrow_date']}", rec)

                if return_date and borrow_date:
                    if return_date < borrow_date:
                        result.add_error(f"record_{idx}",
                                       f"归还日期 {return_date} 早于借阅日期 {borrow_date}", rec)

        except FileNotFoundError:
            result.add_error("file", f"文件不存在: {file_path}")
        except json.JSONDecodeError as e:
            result.add_error("file", f"JSON解析失败: {str(e)}")
        except Exception as e:
            result.add_error("file", f"读取文件失败: {str(e)}")

        return result

    def import_borrow_json(self, file_path: str) -> tuple[List[BorrowRecord], ValidationResult]:
        result = self.validate_borrow_json(file_path)
        records = []

        if result.is_valid or not result.errors:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                if isinstance(data, dict):
                    records_data = data.get('borrows', [data])
                else:
                    records_data = data

                for rec in records_data:
                    if not isinstance(rec, dict):
                        continue

                    record = BorrowRecord(
                        record_id=rec['record_id'].strip(),
                        slide_id=rec['slide_id'].strip(),
                        borrower_name=rec['borrower_name'].strip(),
                        borrower_dept=rec['borrower_dept'].strip(),
                        borrow_date=self.parse_date(rec['borrow_date']) or rec['borrow_date'],
                        expected_return_date=self.parse_date(rec['expected_return_date']) or rec['expected_return_date'],
                        actual_return_date=self.parse_date(rec.get('actual_return_date', '')),
                        status=SlideStatus.BORROWED if not rec.get('actual_return_date') else SlideStatus.RETURNED,
                        notes=rec.get('notes', '').strip()
                    )
                    records.append(record)
            except Exception as e:
                result.add_error("import", f"导入失败: {str(e)}")

        return records, result

    def validate_rules_json(self, file_path: str) -> ValidationResult:
        result = ValidationResult()
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, dict):
                rules_data = data.get('rules', [data])
            elif isinstance(data, list):
                rules_data = data
            else:
                result.add_error("format", "JSON格式无效")
                return result

            if not rules_data:
                result.add_error("data", "没有科室规则")
                return result

            for idx, rule_data in enumerate(rules_data):
                if not isinstance(rule_data, dict):
                    result.add_error(f"rule_{idx}", "规则格式无效", rule_data)
                    continue

                missing = [f for f in self.REQUIRED_RULE_FIELDS if f not in rule_data]
                if missing:
                    result.add_error(f"rule_{idx}", f"缺少必需字段: {', '.join(missing)}", rule_data)
                    continue

                max_days = rule_data.get('max_borrow_days', 0)
                if not isinstance(max_days, int) or max_days <= 0:
                    result.add_error(f"rule_{idx}", f"max_borrow_days 必须为正整数", rule_data)

                max_borrows = rule_data.get('max_concurrent_borrows', 0)
                if not isinstance(max_borrows, int) or max_borrows <= 0:
                    result.add_error(f"rule_{idx}", f"max_concurrent_borrows 必须为正整数", rule_data)

        except FileNotFoundError:
            result.add_error("file", f"文件不存在: {file_path}")
        except json.JSONDecodeError as e:
            result.add_error("file", f"JSON解析失败: {str(e)}")
        except Exception as e:
            result.add_error("file", f"读取文件失败: {str(e)}")

        return result

    def import_rules_json(self, file_path: str) -> tuple[List[DepartmentRule], ValidationResult]:
        result = self.validate_rules_json(file_path)
        rules = []

        if result.is_valid or not result.errors:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                if isinstance(data, dict):
                    rules_data = data.get('rules', [data])
                else:
                    rules_data = data

                for rule_data in rules_data:
                    if not isinstance(rule_data, dict):
                        continue
                    rule = DepartmentRule(
                        department=rule_data['department'].strip(),
                        max_borrow_days=int(rule_data['max_borrow_days']),
                        max_concurrent_borrows=int(rule_data['max_concurrent_borrows']),
                        allow_extend=rule_data.get('allow_extend', True),
                        requires_approval=rule_data.get('requires_approval', True),
                        notes=rule_data.get('notes', '').strip()
                    )
                    rules.append(rule)
            except Exception as e:
                result.add_error("import", f"导入失败: {str(e)}")

        return rules, result
