import os
import hashlib
from datetime import datetime
import pandas as pd

from .database import Database
from .validator import Validator


class DataImporter:
    QUALITY_RESULTS = ["合格", "不合格", "需返修", "报废"]
    REFUND_STATUSES = ["待审核", "已批准", "已退款", "已拒绝"]

    def __init__(self, db_path=None):
        self.db = Database(db_path)
        self.validator = Validator(self.db)

    def generate_batch_id(self, file_path):
        hash_obj = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hash_obj.update(chunk)
        return hash_obj.hexdigest()[:16]

    def read_file(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".csv":
            return pd.read_csv(file_path)
        elif ext in [".xlsx", ".xls"]:
            return pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}，请使用CSV或Excel文件")

    def normalize_column(self, name):
        return (
            str(name)
            .strip()
            .lower()
            .replace(" ", "")
            .replace("_", "")
            .replace("-", "")
        )

    def get_actual_column(self, columns, expected):
        normalized_expected = self.normalize_column(expected)
        for col in columns:
            if self.normalize_column(col) == normalized_expected:
                return col
        return None

    def extract_value(self, row, columns, expected_name, default=None):
        actual_col = self.get_actual_column(columns, expected_name)
        if actual_col is None:
            return default
        val = row.get(actual_col)
        if pd.isna(val):
            return default
        return str(val).strip()

    def validate_quality_result(self, value):
        if not value:
            return None
        for valid in self.QUALITY_RESULTS:
            if value == valid or self.normalize_column(value) == self.normalize_column(valid):
                return valid
        return None

    def validate_refund_status(self, value):
        if not value:
            return None
        for valid in self.REFUND_STATUSES:
            if value == valid or self.normalize_column(value) == self.normalize_column(valid):
                return valid
        return None

    def import_file(self, file_path):
        df = self.read_file(file_path)
        columns = list(df.columns)

        required_fields = [
            "order_no",
            "serial_number",
            "return_date",
        ]

        for field in required_fields:
            if self.get_actual_column(columns, field) is None:
                raise ValueError(
                    f"缺少必需列: {field}。请确保表格包含订单号、序列号和退货日期列"
                )

        batch_id = self.generate_batch_id(file_path)
        existing_batch = self.db.get_batch_by_id(batch_id)
        if existing_batch:
            return {
                "success": False,
                "message": "该文件已导入过，不会重复处理",
                "batch_id": batch_id,
                "import_time": existing_batch["import_time"],
                "total_records": existing_batch["total_records"],
            }

        total_records = len(df)
        success_records = 0
        skipped_records = 0
        exceptions = []
        current_batch_keys = set()

        for idx, row in df.iterrows():
            try:
                order_no = self.extract_value(row, columns, "order_no")
                serial_number = self.extract_value(row, columns, "serial_number")
                return_date = self.extract_value(row, columns, "return_date")
                customer_name = self.extract_value(row, columns, "customer_name")
                product_name = self.extract_value(row, columns, "product_name")
                sku = self.extract_value(row, columns, "sku")
                quality_result = self.validate_quality_result(
                    self.extract_value(row, columns, "quality_result")
                )
                missing_parts_note = self.extract_value(row, columns, "missing_parts_note")
                refund_status = self.validate_refund_status(
                    self.extract_value(row, columns, "refund_status")
                )
                warehouse_location = self.extract_value(row, columns, "warehouse_location")
                repair_responsibility = self.extract_value(row, columns, "repair_responsibility")

                if not return_date:
                    return_date = datetime.now().strftime("%Y-%m-%d")

                record_key = (order_no, serial_number)

                existing_item = self.db.get_item_by_order_and_serial(order_no, serial_number)
                if existing_item:
                    skipped_records += 1
                    continue

                order_id = self.db.add_return_order(order_no, customer_name, return_date)

                item_id = self.db.add_return_item(
                    order_id,
                    serial_number,
                    product_name,
                    sku,
                    quality_result,
                    missing_parts_note,
                    refund_status,
                    warehouse_location,
                    repair_responsibility,
                    batch_id,
                )

                if record_key in current_batch_keys:
                    exceptions.append(
                        {
                            "row": idx + 2,
                            "order_no": order_no,
                            "exception_type": "序列号重复",
                            "exception_detail": (
                                f"该记录（订单 {order_no}，序列号 {serial_number}）"
                                f"在当前导入文件中已出现过。"
                                f"请检查是否是重复录入。"
                            ),
                        }
                    )
                else:
                    current_batch_keys.add(record_key)

                item_exceptions = self.validator.validate_item(
                    item_id,
                    serial_number,
                    order_no,
                    quality_result,
                    missing_parts_note,
                    refund_status,
                    warehouse_location,
                    repair_responsibility,
                )
                exceptions.extend(item_exceptions)

                success_records += 1

            except Exception as e:
                exceptions.append(
                    {
                        "row": idx + 2,
                        "order_no": self.extract_value(row, columns, "order_no"),
                        "exception_type": "导入失败",
                        "exception_detail": str(e),
                    }
                )

        self.db.add_import_batch(
            batch_id,
            os.path.basename(file_path),
            total_records,
            success_records,
            "completed",
        )

        return {
            "success": True,
            "batch_id": batch_id,
            "total_records": total_records,
            "success_records": success_records,
            "skipped_records": skipped_records,
            "failed_records": total_records - success_records - skipped_records,
            "exceptions": exceptions,
        }

    def close(self):
        self.db.close()
