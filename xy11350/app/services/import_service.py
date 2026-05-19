import uuid
import json
import pandas as pd
from typing import List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import PrintBatch, LabRecord, Order, ReworkRecord, ErrorRecord, ImportRecord
from app.schemas.schemas import LabRecordCreate, OrderCreate, ReworkRecordCreate


class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.session_id = str(uuid.uuid4())
        self.errors: List[ErrorRecord] = []
        self.success_count = 0
        self.total_count = 0

    def import_lab_csv(self, file_content: bytes, filename: str, user_id: int = None) -> Tuple[int, int, str]:
        try:
            df = pd.read_csv(pd.io.common.BytesIO(file_content))
        except Exception as e:
            return 0, 0, f"CSV文件解析失败: {str(e)}"
        
        self.total_count = len(df)
        
        required_columns = ['batch_number', 'l_value', 'a_value', 'b_value']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return 0, 0, f"缺少必要列: {', '.join(missing_columns)}"
        
        for idx, row in df.iterrows():
            row_num = idx + 2
            try:
                self._process_lab_row(row, filename, row_num)
                self.success_count += 1
            except Exception as e:
                self._record_error(
                    filename=filename,
                    row_num=row_num,
                    raw_data=json.dumps(row.to_dict(), ensure_ascii=False),
                    error_type="LabDataImportError",
                    error_message=str(e),
                    suggestion=self._get_lab_suggestion(row, str(e))
                )
        
        self._save_import_record(filename, "lab_data", user_id)
        self.db.commit()
        return self.success_count, len(self.errors), self.session_id

    def _process_lab_row(self, row, filename: str, row_num: int):
        batch_number = str(row['batch_number']).strip()
        if not batch_number:
            raise ValueError("批次号不能为空")
        
        batch = self.db.query(PrintBatch).filter(PrintBatch.batch_number == batch_number).first()
        if not batch:
            batch = PrintBatch(
                batch_number=batch_number,
                paper_batch=row.get('paper_batch', 'UNKNOWN')
            )
            self.db.add(batch)
            self.db.flush()
        
        l_value = self._validate_float(row['l_value'], "L*值")
        a_value = self._validate_float(row['a_value'], "a*值")
        b_value = self._validate_float(row['b_value'], "b*值")
        
        lab_record = LabRecord(
            batch_id=batch.id,
            l_value=l_value,
            a_value=a_value,
            b_value=b_value,
            delta_e=row.get('delta_e'),
            measurement_point=row.get('measurement_point'),
            measured_at=datetime.fromisoformat(row['measured_at']) if pd.notna(row.get('measured_at')) else None,
            operator_id=row.get('operator_id')
        )
        self.db.add(lab_record)

    def import_orders_json(self, file_content: bytes, filename: str, user_id: int = None) -> Tuple[int, int, str]:
        try:
            data = json.loads(file_content.decode('utf-8'))
        except Exception as e:
            return 0, 0, f"JSON文件解析失败: {str(e)}"
        
        if not isinstance(data, list):
            data = [data]
        
        self.total_count = len(data)
        
        for idx, order_data in enumerate(data):
            row_num = idx + 1
            try:
                self._process_order_row(order_data, filename, row_num)
                self.success_count += 1
            except Exception as e:
                self._record_error(
                    filename=filename,
                    row_num=row_num,
                    raw_data=json.dumps(order_data, ensure_ascii=False),
                    error_type="OrderImportError",
                    error_message=str(e),
                    suggestion=self._get_order_suggestion(order_data, str(e))
                )
        
        self._save_import_record(filename, "orders", user_id)
        self.db.commit()
        return self.success_count, len(self.errors), self.session_id

    def _process_order_row(self, order_data, filename: str, row_num: int):
        batch_number = str(order_data.get('batch_number', '')).strip()
        order_number = str(order_data.get('order_number', '')).strip()
        
        if not batch_number:
            raise ValueError("批次号不能为空")
        if not order_number:
            raise ValueError("订单号不能为空")
        
        existing_order = self.db.query(Order).filter(Order.order_number == order_number).first()
        if existing_order:
            raise ValueError(f"订单号 {order_number} 已存在")
        
        batch = self.db.query(PrintBatch).filter(PrintBatch.batch_number == batch_number).first()
        if not batch:
            batch = PrintBatch(
                batch_number=batch_number,
                paper_batch=order_data.get('paper_batch', 'UNKNOWN')
            )
            self.db.add(batch)
            self.db.flush()
        
        order = Order(
            batch_id=batch.id,
            order_number=order_number,
            product_spec=order_data.get('product_spec'),
            quantity=order_data.get('quantity'),
            customer_info=order_data.get('customer_info'),
            cost_details=order_data.get('cost_details'),
            delivery_date=datetime.fromisoformat(order_data['delivery_date']) if order_data.get('delivery_date') else None
        )
        self.db.add(order)

    def import_rework_text(self, file_content: bytes, filename: str, user_id: int = None) -> Tuple[int, int, str]:
        try:
            lines = file_content.decode('utf-8').splitlines()
        except Exception as e:
            return 0, 0, f"文件解析失败: {str(e)}"
        
        self.total_count = len(lines)
        
        for idx, line in enumerate(lines):
            row_num = idx + 1
            line = line.strip()
            if not line:
                continue
            
            try:
                self._process_rework_line(line, filename, row_num)
                self.success_count += 1
            except Exception as e:
                self._record_error(
                    filename=filename,
                    row_num=row_num,
                    raw_data=line,
                    error_type="ReworkImportError",
                    error_message=str(e),
                    suggestion=self._get_rework_suggestion(line, str(e))
                )
        
        self._save_import_record(filename, "rework", user_id)
        self.db.commit()
        return self.success_count, len(self.errors), self.session_id

    def _process_rework_line(self, line: str, filename: str, row_num: int):
        parts = line.split('|')
        if len(parts) < 2:
            raise ValueError("格式错误，需要批次号|返工原因格式")
        
        batch_number = parts[0].strip()
        reason = parts[1].strip()
        
        if not batch_number:
            raise ValueError("批次号不能为空")
        if not reason:
            raise ValueError("返工原因不能为空")
        
        batch = self.db.query(PrintBatch).filter(PrintBatch.batch_number == batch_number).first()
        if not batch:
            raise ValueError(f"批次 {batch_number} 不存在，请先导入批次信息")
        
        rework = ReworkRecord(
            batch_id=batch.id,
            reason=reason,
            rework_type=parts[2].strip() if len(parts) > 2 else None,
            operator_id=parts[3].strip() if len(parts) > 3 else None,
            notes=parts[4].strip() if len(parts) > 4 else None
        )
        self.db.add(rework)

    def _validate_float(self, value, field_name: str) -> float:
        try:
            return float(value)
        except (ValueError, TypeError):
            raise ValueError(f"{field_name} {value} 不是有效的数字")

    def _record_error(self, filename: str, row_num: int, raw_data: str, 
                     error_type: str, error_message: str, suggestion: str):
        error = ErrorRecord(
            import_session_id=self.session_id,
            source_file=filename,
            row_number=row_num,
            raw_data=raw_data,
            error_type=error_type,
            error_message=error_message,
            suggestion=suggestion,
            status="pending"
        )
        self.db.add(error)
        self.errors.append(error)

    def _save_import_record(self, filename: str, import_type: str, user_id: int = None):
        record = ImportRecord(
            user_id=user_id,
            file_name=filename,
            import_type=import_type,
            total_records=self.total_count,
            success_count=self.success_count,
            error_count=len(self.errors),
            session_id=self.session_id
        )
        self.db.add(record)

    def _get_lab_suggestion(self, row, error_msg: str) -> str:
        if "L*值" in error_msg or "a*值" in error_msg or "b*值" in error_msg:
            return "请检查Lab数值是否为有效数字，范围L:0-100, a/b:-128到127"
        if "批次号" in error_msg:
            return "请填写正确的批次号，批次号不能为空"
        return "请检查数据格式是否正确"

    def _get_order_suggestion(self, order_data, error_msg: str) -> str:
        if "已存在" in error_msg:
            return "该订单号已导入，请检查是否重复或更新订单信息"
        if "不能为空" in error_msg:
            return "批次号和订单号为必填字段，请补充完整"
        return "请检查JSON格式和字段是否完整"

    def _get_rework_suggestion(self, line: str, error_msg: str) -> str:
        if "格式错误" in error_msg:
            return "请使用格式: 批次号|返工原因|返工类型|操作员工号|备注"
        if "不存在" in error_msg:
            return "请先导入该批次的基础信息后再导入返工记录"
        return "请检查文本格式，每行一条记录用竖线分隔"
