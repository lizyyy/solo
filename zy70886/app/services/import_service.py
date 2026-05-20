import pandas as pd
import json
from datetime import datetime
from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from app.models import ContractApplication, StampRecord, ApprovalRecord, ExpressRecord
from app import schemas


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def parse_date(self, date_str):
        if pd.isna(date_str) or date_str == '':
            return None
        try:
            if isinstance(date_str, datetime):
                return date_str
            return pd.to_datetime(date_str).to_pydatetime()
        except:
            return None

    def import_contract_applications_from_csv(self, file_path: str) -> Tuple[int, List[str]]:
        errors = []
        imported_count = 0

        try:
            df = pd.read_csv(file_path)
            required_columns = ['application_no', 'contract_name']
            for col in required_columns:
                if col not in df.columns:
                    errors.append(f"缺少必需列: {col}")
                    return 0, errors

            for idx, row in df.iterrows():
                try:
                    application = ContractApplication(
                        application_no=str(row.get('application_no', '')),
                        contract_name=str(row.get('contract_name', '')),
                        contract_amount=float(row.get('contract_amount', 0)) if pd.notna(row.get('contract_amount')) else None,
                        applicant=str(row.get('applicant', '')) if pd.notna(row.get('applicant')) else None,
                        department=str(row.get('department', '')) if pd.notna(row.get('department')) else None,
                        application_date=self.parse_date(row.get('application_date')),
                        counterparty=str(row.get('counterparty', '')) if pd.notna(row.get('counterparty')) else None,
                        stamp_type=str(row.get('stamp_type', '')) if pd.notna(row.get('stamp_type')) else None,
                        stamp_count=int(row.get('stamp_count', 1)) if pd.notna(row.get('stamp_count')) else 1,
                        is_urgent=bool(row.get('is_urgent', False)),
                        remarks=str(row.get('remarks', '')) if pd.notna(row.get('remarks')) else None
                    )
                    self.db.add(application)
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第 {idx + 2} 行导入失败: {str(e)}")

            self.db.commit()
        except Exception as e:
            self.db.rollback()
            errors.append(f"CSV文件读取失败: {str(e)}")

        return imported_count, errors

    def import_stamp_records_from_json(self, file_path: str) -> Tuple[int, List[str]]:
        errors = []
        imported_count = 0

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, dict) and 'records' in data:
                records = data['records']
            else:
                records = data if isinstance(data, list) else [data]

            for idx, record in enumerate(records):
                try:
                    stamp = StampRecord(
                        application_no=str(record.get('application_no', '')),
                        stamp_date=self.parse_date(record.get('stamp_date')),
                        stamp_operator=str(record.get('stamp_operator', '')) if record.get('stamp_operator') else None,
                        stamp_type=str(record.get('stamp_type', '')) if record.get('stamp_type') else None,
                        stamp_count=int(record.get('stamp_count', 1)),
                        is_supplementary=bool(record.get('is_supplementary', False)),
                        supplementary_reason=str(record.get('supplementary_reason', '')) if record.get('supplementary_reason') else None,
                        is_withdrawn=bool(record.get('is_withdrawn', False)),
                        withdrawal_reason=str(record.get('withdrawal_reason', '')) if record.get('withdrawal_reason') else None,
                        remarks=str(record.get('remarks', '')) if record.get('remarks') else None
                    )
                    self.db.add(stamp)
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第 {idx + 1} 条记录导入失败: {str(e)}")

            self.db.commit()
        except Exception as e:
            self.db.rollback()
            errors.append(f"JSON文件读取失败: {str(e)}")

        return imported_count, errors

    def import_approval_records_from_json(self, file_path: str) -> Tuple[int, List[str]]:
        errors = []
        imported_count = 0

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, dict) and 'approvals' in data:
                records = data['approvals']
            else:
                records = data if isinstance(data, list) else [data]

            for idx, record in enumerate(records):
                try:
                    approval = ApprovalRecord(
                        application_no=str(record.get('application_no', '')),
                        approval_level=str(record.get('approval_level', '')) if record.get('approval_level') else None,
                        approver=str(record.get('approver', '')) if record.get('approver') else None,
                        approval_date=self.parse_date(record.get('approval_date')),
                        approval_result=str(record.get('approval_result', '')) if record.get('approval_result') else None,
                        approval_opinion=str(record.get('approval_opinion', '')) if record.get('approval_opinion') else None,
                        is_authorised=bool(record.get('is_authorised', False)),
                        authorisation_scope=str(record.get('authorisation_scope', '')) if record.get('authorisation_scope') else None
                    )
                    self.db.add(approval)
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第 {idx + 1} 条记录导入失败: {str(e)}")

            self.db.commit()
        except Exception as e:
            self.db.rollback()
            errors.append(f"JSON文件读取失败: {str(e)}")

        return imported_count, errors

    def import_express_records_from_csv(self, file_path: str) -> Tuple[int, List[str]]:
        errors = []
        imported_count = 0

        try:
            df = pd.read_csv(file_path)

            for idx, row in df.iterrows():
                try:
                    express = ExpressRecord(
                        application_no=str(row.get('application_no', '')),
                        express_company=str(row.get('express_company', '')) if pd.notna(row.get('express_company')) else None,
                        tracking_no=str(row.get('tracking_no', '')) if pd.notna(row.get('tracking_no')) else None,
                        recipient=str(row.get('recipient', '')) if pd.notna(row.get('recipient')) else None,
                        recipient_phone=str(row.get('recipient_phone', '')) if pd.notna(row.get('recipient_phone')) else None,
                        recipient_address=str(row.get('recipient_address', '')) if pd.notna(row.get('recipient_address')) else None,
                        send_date=self.parse_date(row.get('send_date')),
                        receive_date=self.parse_date(row.get('receive_date')),
                        is_received=bool(row.get('is_received', False)),
                        remarks=str(row.get('remarks', '')) if pd.notna(row.get('remarks')) else None
                    )
                    self.db.add(express)
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第 {idx + 2} 行导入失败: {str(e)}")

            self.db.commit()
        except Exception as e:
            self.db.rollback()
            errors.append(f"CSV文件读取失败: {str(e)}")

        return imported_count, errors
