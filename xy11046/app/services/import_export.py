import pandas as pd
from datetime import datetime
from typing import List, Dict, Any
from io import BytesIO
from app.models.schemas import (
    MealVoucherCreate, BatchImportResult, ExportRequest,
    SubsidyLevel, VerificationStatus
)
from app.services.database import db


class ImportExportService:
    def parse_excel(self, file_content: bytes) -> List[Dict[str, Any]]:
        df = pd.read_excel(BytesIO(file_content))
        records = df.to_dict('records')
        return records

    def convert_to_voucher_create(self, record: Dict[str, Any]) -> MealVoucherCreate:
        def parse_date(value):
            if isinstance(value, datetime):
                return value.date()
            if isinstance(value, str):
                return datetime.strptime(value, '%Y-%m-%d').date()
            return value

        def parse_bool(value):
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ['是', 'yes', 'true', '1']
            return bool(value)

        return MealVoucherCreate(
            voucher_no=str(record.get('助餐券编号', '')),
            id_card=str(record.get('身份证号', '')),
            name=str(record.get('姓名', '')),
            phone=str(record.get('联系电话', '')),
            address=str(record.get('居住地址', '')),
            community=str(record.get('所属社区', '')),
            subsidy_level=SubsidyLevel(str(record.get('补贴等级', 'C'))),
            subsidy_amount=float(record.get('补贴金额', 0)),
            issue_date=parse_date(record.get('发放日期')),
            expire_date=parse_date(record.get('有效期至')),
            dining_point=str(record.get('助餐点名称', '')),
            dining_point_code=str(record.get('助餐点编号', '')),
            applicant_type=str(record.get('申请人类型', '')),
            family_status=str(record.get('家庭状况', '')),
            income_level=str(record.get('收入水平', '')),
            disability_type=str(record.get('残疾类型')) if record.get('残疾类型') else None,
            disability_level=str(record.get('残疾等级')) if record.get('残疾等级') else None,
            elderly_age=int(record.get('老年人年龄')) if record.get('老年人年龄') else None,
            low_income_cert=parse_bool(record.get('低保证明', False)),
            low_income_cert_no=str(record.get('低保证编号')) if record.get('低保证编号') else None,
            disability_cert=parse_bool(record.get('残疾证明', False)),
            disability_cert_no=str(record.get('残疾证编号')) if record.get('残疾证编号') else None,
            elderly_cert=parse_bool(record.get('老年证', False)),
            elderly_cert_no=str(record.get('老年证编号')) if record.get('老年证编号') else None,
            household_registry=parse_bool(record.get('户口本', False)),
            income_proof=parse_bool(record.get('收入证明', False)),
            operator=str(record.get('操作人', 'system')),
            remark=str(record.get('备注')) if record.get('备注') else None
        )

    def batch_import(self, file_content: bytes, operator: str) -> BatchImportResult:
        records = self.parse_excel(file_content)
        total = len(records)
        success = 0
        failed = 0
        errors = []
        warnings = []

        for idx, record in enumerate(records):
            try:
                voucher_create = self.convert_to_voucher_create(record)
                voucher_create.operator = operator
                
                existing = db.get_voucher(voucher_create.voucher_no)
                if existing:
                    warnings.append({
                        "row": idx + 2,
                        "voucher_no": voucher_create.voucher_no,
                        "message": "助餐券已存在，将被覆盖"
                    })
                
                db.add_voucher(voucher_create)
                success += 1
            except Exception as e:
                failed += 1
                errors.append({
                    "row": idx + 2,
                    "voucher_no": str(record.get('助餐券编号', f'row_{idx+2}')),
                    "error": str(e)
                })

        return BatchImportResult(
            total=total,
            success=success,
            failed=failed,
            errors=errors,
            warnings=warnings
        )

    def export_to_dataframe(self, export_request: ExportRequest) -> pd.DataFrame:
        vouchers = db.get_all_vouchers()
        filtered = []

        for v in vouchers:
            if export_request.status_filter and v.verification_status not in export_request.status_filter:
                continue
            if export_request.date_from and v.issue_date < export_request.date_from:
                continue
            if export_request.date_to and v.issue_date > export_request.date_to:
                continue
            if export_request.dining_point_code and v.dining_point_code != export_request.dining_point_code:
                continue
            if export_request.subsidy_level and v.subsidy_level != export_request.subsidy_level:
                continue
            filtered.append(v)

        data = []
        for v in filtered:
            data.append({
                "助餐券编号": v.voucher_no,
                "身份证号": v.id_card,
                "姓名": v.name,
                "联系电话": v.phone,
                "居住地址": v.address,
                "所属社区": v.community,
                "补贴等级": v.subsidy_level.value,
                "补贴金额": v.subsidy_amount,
                "发放日期": v.issue_date.strftime('%Y-%m-%d'),
                "有效期至": v.expire_date.strftime('%Y-%m-%d'),
                "助餐点名称": v.dining_point,
                "助餐点编号": v.dining_point_code,
                "申请人类型": v.applicant_type,
                "家庭状况": v.family_status,
                "收入水平": v.income_level,
                "核验状态": v.verification_status.value,
                "券状态": v.certificate_status.value,
                "核验时间": v.verification_time.strftime('%Y-%m-%d %H:%M:%S') if v.verification_time else '',
                "核验人": v.verifier or '',
                "操作人": v.operator,
                "创建时间": v.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                "备注": v.remark or ''
            })

        return pd.DataFrame(data)

    def export_to_excel(self, export_request: ExportRequest) -> bytes:
        df = self.export_to_dataframe(export_request)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='助餐券资格核验')
        return output.getvalue()


import_export_service = ImportExportService()
