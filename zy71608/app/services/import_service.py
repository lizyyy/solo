import os
from typing import Dict, Any, Tuple, Optional, List
from datetime import date
from decimal import Decimal
import pandas as pd
from sqlalchemy.orm import Session
from uuid import uuid4

from app.config import settings
from app.utils import ExcelReader, DataCleaner
from app.models import (
    Contract,
    RentPlan,
    ReductionApplication,
    StoreClosureProof,
    SupplementaryAgreement,
    ImportRecord,
    DocumentType,
    OperationType,
)
from app.services.audit_service import AuditService


class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)

    def import_document(
        self,
        file_content: bytes,
        file_name: str,
        document_type: str,
        sheet_name: Optional[str] = None,
        operator: str = "system",
    ) -> Dict[str, Any]:
        df, read_stats = ExcelReader.read_file(file_content, file_name, sheet_name)
        df, clean_stats = DataCleaner.clean_dataframe(df)

        import_record = ImportRecord(
            file_name=file_name,
            document_type=document_type,
            total_rows=read_stats["total_rows"],
            empty_columns_removed=clean_stats["empty_columns_removed"],
            duplicate_rows=clean_stats["duplicate_rows_removed"],
            sheet_name=read_stats["sheet_name"],
            encoding=read_stats["encoding"],
            imported_by=operator,
            errors_details="\n".join(clean_stats["errors"]),
            warnings_details="\n".join(clean_stats["warnings"]),
        )

        handlers = {
            DocumentType.LEASE_CONTRACT.value: self._import_contracts,
            DocumentType.RENT_PLAN.value: self._import_rent_plans,
            DocumentType.REDUCTION_APPLICATION.value: self._import_reduction_applications,
            DocumentType.STORE_CLOSURE_PROOF.value: self._import_closure_proofs,
            DocumentType.SUPPLEMENTARY_AGREEMENT.value: self._import_supplementary_agreements,
        }

        handler = handlers.get(document_type)
        if not handler:
            raise ValueError(f"不支持的文档类型: {document_type}")

        imported_ids, success_count, error_count, warning_count = handler(df, operator)

        import_record.success_rows = success_count
        import_record.error_rows = error_count
        import_record.warning_rows = warning_count
        import_record.imported_by = operator

        self.db.add(import_record)
        self.db.flush()

        self.audit_service.log_operation(
            operation_type=OperationType.IMPORT.value,
            operator=operator,
            table_name="import_records",
            record_id=import_record.id,
            new_values={
                "document_type": document_type,
                "file_name": file_name,
                "success_rows": success_count,
                "error_rows": error_count,
            },
            change_reason=f"导入{document_type}",
        )

        self.db.commit()

        return {
            "file_name": file_name,
            "document_type": document_type,
            "total_rows": read_stats["total_rows"],
            "success_rows": success_count,
            "error_rows": error_count,
            "warning_rows": warning_count,
            "duplicate_rows": clean_stats["duplicate_rows_removed"],
            "empty_columns_removed": clean_stats["empty_columns_removed"],
            "errors": clean_stats["errors"],
            "warnings": clean_stats["warnings"],
            "imported_ids": imported_ids,
        }

    def _import_contracts(
        self, df: pd.DataFrame, operator: str
    ) -> Tuple[List[int], int, int, int]:
        imported_ids = []
        success_count = 0
        error_count = 0
        warning_count = 0

        col_map = {
            "contract_no": DataCleaner.find_column(df, ["合同编号", "合同号", "合约编号", "合同编好"]),
            "tenant_name": DataCleaner.find_column(df, ["租户名称", "商户名称", "租户", "商户", "组户名称", "阻户名称"]),
            "tenant_id": DataCleaner.find_column(df, ["租户ID", "商户ID", "租户编号"]),
            "store_code": DataCleaner.find_column(df, ["铺位编号", "店铺编号", "铺位号"]),
            "store_name": DataCleaner.find_column(df, ["铺位名称", "店铺名称", "品牌"]),
            "floor": DataCleaner.find_column(df, ["楼层"]),
            "area": DataCleaner.find_column(df, ["面积", "建筑面积", "套内面积", "建筑面积(㎡)"]),
            "start_date": DataCleaner.find_column(df, ["合同起始日期", "起始日期", "开始日期", "合同起期", "合同开始"]),
            "end_date": DataCleaner.find_column(df, ["合同结束日期", "结束日期", "终止日期", "合同到期", "合同截止"]),
            "monthly_rent": DataCleaner.find_column(df, ["月租金", "月租金额", "月租金标准", "月租金(元)", "租金"]),
            "monthly_service_fee": DataCleaner.find_column(df, ["月物业费", "月服务费", "物业费"]),
            "deposit_amount": DataCleaner.find_column(df, ["押金", "保证金", "履约保证金"]),
            "payment_cycle": DataCleaner.find_column(df, ["付款周期", "缴租周期", "支付方式"]),
            "version": DataCleaner.find_column(df, ["合同版本", "版本号", "版本"]),
        }

        for idx, row in df.iterrows():
            try:
                row_data = row.to_dict()

                required_fields = ["contract_no", "tenant_name", "start_date", "end_date", "monthly_rent"]
                missing_fields = [f for f in required_fields if not col_map.get(f) or pd.isna(row.get(col_map[f]))]
                if missing_fields:
                    error_count += 1
                    continue

                contract_no = str(row[col_map["contract_no"]]).strip()

                existing = self.db.query(Contract).filter(
                    Contract.contract_no == contract_no,
                    Contract.is_active == True
                ).first()

                if existing:
                    warning_count += 1
                    continue

                start_date = DataCleaner.parse_date(row[col_map["start_date"]])
                end_date = DataCleaner.parse_date(row[col_map["end_date"]])

                if not start_date or not end_date:
                    error_count += 1
                    continue

                version = DataCleaner.parse_int(row.get(col_map.get("version"))) or 1

                contract = Contract(
                    contract_no=contract_no,
                    version=version,
                    tenant_name=str(row[col_map["tenant_name"]]).strip(),
                    tenant_id=str(row[col_map["tenant_id"]]).strip() if col_map.get("tenant_id") and row.get(col_map["tenant_id"]) else None,
                    store_code=str(row[col_map["store_code"]]).strip() if col_map.get("store_code") and row.get(col_map["store_code"]) else None,
                    store_name=str(row[col_map["store_name"]]).strip() if col_map.get("store_name") and row.get(col_map["store_name"]) else None,
                    floor=str(row[col_map["floor"]]).strip() if col_map.get("floor") and row.get(col_map["floor"]) else None,
                    area=DataCleaner.parse_decimal(row.get(col_map.get("area"))),
                    start_date=start_date,
                    end_date=end_date,
                    monthly_rent=DataCleaner.parse_decimal(row[col_map["monthly_rent"]]) or Decimal("0"),
                    monthly_service_fee=DataCleaner.parse_decimal(row.get(col_map.get("monthly_service_fee"))) or Decimal("0"),
                    deposit_amount=DataCleaner.parse_decimal(row.get(col_map.get("deposit_amount"))) or Decimal("0"),
                    payment_cycle=str(row[col_map["payment_cycle"]]).strip() if col_map.get("payment_cycle") and row.get(col_map["payment_cycle"]) else "月付",
                    created_by=operator,
                    updated_by=operator,
                )

                self.db.add(contract)
                self.db.flush()
                imported_ids.append(contract.id)
                success_count += 1

                self.audit_service.log_operation(
                    operation_type=OperationType.CREATE.value,
                    operator=operator,
                    table_name="contracts",
                    record_id=contract.id,
                    new_values=row_data,
                    change_reason="导入合同",
                )

            except Exception as e:
                error_count += 1
                continue

        return imported_ids, success_count, error_count, warning_count

    def _import_rent_plans(
        self, df: pd.DataFrame, operator: str
    ) -> Tuple[List[int], int, int, int]:
        imported_ids = []
        success_count = 0
        error_count = 0
        warning_count = 0

        col_map = {
            "contract_no": DataCleaner.find_column(df, ["合同编号", "合同号", "合同编好"]),
            "period_start": DataCleaner.find_column(df, ["计费开始日期", "周期开始", "起始日期", "费用期间起", "开始日期", "起期"]),
            "period_end": DataCleaner.find_column(df, ["计费结束日期", "周期结束", "结束日期", "费用期间止", "结束日期", "止期"]),
            "base_rent": DataCleaner.find_column(df, ["基本租金", "租金", "基础租金", "月租金标准", "月租金", "租金标准"]),
            "service_fee": DataCleaner.find_column(df, ["物业费", "服务费", "物业服务费"]),
            "promotion_fee": DataCleaner.find_column(df, ["推广费", "市场推广费"]),
            "other_fees": DataCleaner.find_column(df, ["其他费用", "其他"]),
            "total_amount": DataCleaner.find_column(df, ["合计", "总额", "总金额"]),
            "due_date": DataCleaner.find_column(df, ["缴费日期", "应付日期", "到期日期"]),
        }

        for idx, row in df.iterrows():
            try:
                if not col_map.get("contract_no") or pd.isna(row.get(col_map["contract_no"])):
                    error_count += 1
                    continue

                contract_no = str(row[col_map["contract_no"]]).strip()
                contract = self.db.query(Contract).filter(
                    Contract.contract_no == contract_no,
                    Contract.is_active == True
                ).first()

                if not contract:
                    error_count += 1
                    continue

                period_start = DataCleaner.parse_date(row.get(col_map.get("period_start")))
                period_end = DataCleaner.parse_date(row.get(col_map.get("period_end")))

                if not period_start or not period_end:
                    error_count += 1
                    continue

                base_rent = DataCleaner.parse_decimal(row.get(col_map.get("base_rent"))) or Decimal("0")
                service_fee = DataCleaner.parse_decimal(row.get(col_map.get("service_fee"))) or Decimal("0")
                promotion_fee = DataCleaner.parse_decimal(row.get(col_map.get("promotion_fee"))) or Decimal("0")
                other_fees = DataCleaner.parse_decimal(row.get(col_map.get("other_fees"))) or Decimal("0")
                total_amount = DataCleaner.parse_decimal(row.get(col_map.get("total_amount"))) or (base_rent + service_fee + promotion_fee + other_fees)

                existing = self.db.query(RentPlan).filter(
                    RentPlan.contract_id == contract.id,
                    RentPlan.period_start == period_start,
                    RentPlan.period_end == period_end,
                ).first()

                if existing:
                    warning_count += 1
                    continue

                rent_plan = RentPlan(
                    contract_id=contract.id,
                    period_start=period_start,
                    period_end=period_end,
                    base_rent=base_rent,
                    service_fee=service_fee,
                    promotion_fee=promotion_fee,
                    other_fees=other_fees,
                    total_amount=total_amount,
                    due_date=DataCleaner.parse_date(row.get(col_map.get("due_date"))),
                    created_by=operator,
                    updated_by=operator,
                )

                self.db.add(rent_plan)
                self.db.flush()
                imported_ids.append(rent_plan.id)
                success_count += 1

            except Exception as e:
                error_count += 1
                continue

        return imported_ids, success_count, error_count, warning_count

    def _import_reduction_applications(
        self, df: pd.DataFrame, operator: str
    ) -> Tuple[List[int], int, int, int]:
        imported_ids = []
        success_count = 0
        error_count = 0
        warning_count = 0

        col_map = {
            "application_no": DataCleaner.find_column(df, ["申请编号", "减免编号", "申请单号"]),
            "contract_no": DataCleaner.find_column(df, ["合同编号", "合同号", "合同编好"]),
            "tenant_name": DataCleaner.find_column(df, ["租户名称", "商户名称", "租户", "阻户名称", "组户名称"]),
            "store_code": DataCleaner.find_column(df, ["铺位编号", "店铺编号"]),
            "reduction_reason": DataCleaner.find_column(df, ["减免原因", "申请原因", "闭店原因"]),
            "closure_start_date": DataCleaner.find_column(df, ["闭店开始日期", "停业开始", "起始日期", "闭店开始", "开始日期"]),
            "closure_end_date": DataCleaner.find_column(df, ["闭店结束日期", "停业结束", "结束日期", "闭店结束", "结束日期"]),
            "applied_days": DataCleaner.find_column(df, ["申请天数", "闭店天数", "天数", "申请减勉天数", "申请减免天数"]),
            "reduction_ratio": DataCleaner.find_column(df, ["减免比例", "折扣比例", "减免率", "减兔比例(%)", "减免比例(%)"]),
        }

        for idx, row in df.iterrows():
            try:
                row_data = row.to_dict()

                required_fields = ["contract_no", "closure_start_date", "closure_end_date"]
                missing_fields = [f for f in required_fields if not col_map.get(f) or pd.isna(row.get(col_map[f]))]
                if missing_fields:
                    error_count += 1
                    continue

                contract_no = str(row[col_map["contract_no"]]).strip()
                contract = self.db.query(Contract).filter(
                    Contract.contract_no == contract_no,
                    Contract.is_active == True
                ).first()

                if not contract:
                    error_count += 1
                    continue

                application_no = row.get(col_map.get("application_no"))
                if not application_no or pd.isna(application_no):
                    application_no = f"JM{date.today().strftime('%Y%m%d')}{str(uuid4().int)[:6]}"
                else:
                    application_no = str(application_no).strip()
                    existing = self.db.query(ReductionApplication).filter(
                        ReductionApplication.application_no == application_no
                    ).first()
                    if existing:
                        warning_count += 1
                        continue

                closure_start = DataCleaner.parse_date(row[col_map["closure_start_date"]])
                closure_end = DataCleaner.parse_date(row[col_map["closure_end_date"]])

                if not closure_start or not closure_end:
                    error_count += 1
                    continue

                applied_days = DataCleaner.parse_int(row.get(col_map.get("applied_days")))
                if not applied_days:
                    applied_days = (closure_end - closure_start).days + 1

                tenant_name = str(row[col_map["tenant_name"]]).strip() if col_map.get("tenant_name") and row.get(col_map["tenant_name"]) else contract.tenant_name

                reduction_ratio = DataCleaner.parse_decimal(row.get(col_map.get("reduction_ratio")))
                if reduction_ratio:
                    if reduction_ratio > 1:
                        reduction_ratio = reduction_ratio / 100
                else:
                    reduction_ratio = Decimal("1.0")

                application = ReductionApplication(
                    application_no=application_no,
                    contract_id=contract.id,
                    tenant_name=tenant_name,
                    store_code=str(row[col_map["store_code"]]).strip() if col_map.get("store_code") and row.get(col_map["store_code"]) else contract.store_code,
                    reduction_reason=str(row[col_map["reduction_reason"]]).strip() if col_map.get("reduction_reason") and row.get(col_map["reduction_reason"]) else "闭店减免",
                    closure_start_date=closure_start,
                    closure_end_date=closure_end,
                    applied_days=applied_days,
                    reduction_ratio=reduction_ratio,
                    monthly_rent_standard=contract.monthly_rent,
                    monthly_service_fee_standard=contract.monthly_service_fee,
                    created_by=operator,
                    updated_by=operator,
                )

                self.db.add(application)
                self.db.flush()
                imported_ids.append(application.id)
                success_count += 1

                self.audit_service.log_operation(
                    operation_type=OperationType.CREATE.value,
                    operator=operator,
                    table_name="reduction_applications",
                    record_id=application.id,
                    new_values=row_data,
                    change_reason="导入减免申请",
                )

            except Exception as e:
                error_count += 1
                continue

        return imported_ids, success_count, error_count, warning_count

    def _import_closure_proofs(
        self, df: pd.DataFrame, operator: str
    ) -> Tuple[List[int], int, int, int]:
        imported_ids = []
        success_count = 0
        error_count = 0
        warning_count = 0

        col_map = {
            "application_no": DataCleaner.find_column(df, ["申请编号", "减免编号"]),
            "contract_no": DataCleaner.find_column(df, ["合同编号", "合同号", "合同编好"]),
            "proof_no": DataCleaner.find_column(df, ["证明编号", "闭店证明号"]),
            "closure_reason": DataCleaner.find_column(df, ["闭店原因", "停业原因"]),
            "actual_closure_date": DataCleaner.find_column(df, ["实际闭店日期", "闭店日期", "闭店开始", "开始日期"]),
            "actual_reopen_date": DataCleaner.find_column(df, ["实际复业日期", "复业日期", "闭店结束", "结束日期"]),
            "actual_closure_days": DataCleaner.find_column(df, ["实际闭店天数", "实际天数", "核实闭店天数", "闭店天数"]),
            "verified_by": DataCleaner.find_column(df, ["核实人", "审核人"]),
            "verification_date": DataCleaner.find_column(df, ["核实日期", "审核日期", "证明开具日期"]),
            "verification_status": DataCleaner.find_column(df, ["核实状态", "审核状态"]),
        }

        for idx, row in df.iterrows():
            try:
                application = None
                
                if col_map.get("application_no") and not pd.isna(row.get(col_map["application_no"])):
                    application_no = str(row[col_map["application_no"]]).strip()
                    application = self.db.query(ReductionApplication).filter(
                        ReductionApplication.application_no == application_no
                    ).first()
                
                if not application and col_map.get("contract_no") and not pd.isna(row.get(col_map["contract_no"])):
                    contract_no = str(row[col_map["contract_no"]]).strip()
                    closure_start = DataCleaner.parse_date(row.get(col_map.get("actual_closure_date")))
                    
                    if closure_start:
                        application = self.db.query(ReductionApplication).filter(
                            ReductionApplication.contract.has(contract_no=contract_no),
                            ReductionApplication.closure_start_date == closure_start
                        ).first()
                
                if not application and col_map.get("contract_no") and not pd.isna(row.get(col_map["contract_no"])):
                    contract_no = str(row[col_map["contract_no"]]).strip()
                    applications = self.db.query(ReductionApplication).filter(
                        ReductionApplication.contract.has(contract_no=contract_no)
                    ).order_by(ReductionApplication.created_at.desc()).all()
                    if applications:
                        application = applications[0]
                
                if not application:
                    error_count += 1
                    continue

                actual_closure_date = DataCleaner.parse_date(row.get(col_map.get("actual_closure_date")))
                actual_reopen_date = DataCleaner.parse_date(row.get(col_map.get("actual_reopen_date")))
                actual_closure_days = DataCleaner.parse_int(row.get(col_map.get("actual_closure_days")))

                if actual_closure_date and actual_reopen_date and not actual_closure_days:
                    actual_closure_days = (actual_reopen_date - actual_closure_date).days + 1

                proof = StoreClosureProof(
                    application_id=application.id,
                    proof_no=str(row[col_map["proof_no"]]).strip() if col_map.get("proof_no") and row.get(col_map["proof_no"]) else None,
                    closure_reason=str(row[col_map["closure_reason"]]).strip() if col_map.get("closure_reason") and row.get(col_map["closure_reason"]) else None,
                    actual_closure_date=actual_closure_date,
                    actual_reopen_date=actual_reopen_date,
                    actual_closure_days=actual_closure_days,
                    verified_by=str(row[col_map["verified_by"]]).strip() if col_map.get("verified_by") and row.get(col_map["verified_by"]) else None,
                    verification_date=DataCleaner.parse_date(row.get(col_map.get("verification_date"))),
                    verification_status=str(row[col_map["verification_status"]]).strip() if col_map.get("verification_status") and row.get(col_map["verification_status"]) else "未核实",
                    created_by=operator,
                    updated_by=operator,
                )

                self.db.add(proof)
                self.db.flush()
                imported_ids.append(proof.id)
                success_count += 1

            except Exception as e:
                error_count += 1
                continue

        return imported_ids, success_count, error_count, warning_count

    def _import_supplementary_agreements(
        self, df: pd.DataFrame, operator: str
    ) -> Tuple[List[int], int, int, int]:
        imported_ids = []
        success_count = 0
        error_count = 0
        warning_count = 0

        col_map = {
            "agreement_no": DataCleaner.find_column(df, ["补充协议编号", "协议编号"]),
            "contract_no": DataCleaner.find_column(df, ["合同编号", "合同号"]),
            "application_no": DataCleaner.find_column(df, ["申请编号", "减免编号"]),
            "version": DataCleaner.find_column(df, ["版本", "版本号"]),
            "sign_date": DataCleaner.find_column(df, ["签署日期", "签订日期"]),
            "effective_date": DataCleaner.find_column(df, ["生效日期"]),
            "reduction_amount": DataCleaner.find_column(df, ["减免金额", "优惠金额"]),
            "reduction_days": DataCleaner.find_column(df, ["减免天数"]),
            "payment_method": DataCleaner.find_column(df, ["支付方式", "结算方式"]),
            "signed_by_party_a": DataCleaner.find_column(df, ["甲方签署人", "甲方"]),
            "signed_by_party_b": DataCleaner.find_column(df, ["乙方签署人", "乙方"]),
            "status": DataCleaner.find_column(df, ["状态", "协议状态"]),
        }

        for idx, row in df.iterrows():
            try:
                application = None
                
                if col_map.get("application_no") and not pd.isna(row.get(col_map["application_no"])):
                    application_no = str(row[col_map["application_no"]]).strip()
                    application = self.db.query(ReductionApplication).filter(
                        ReductionApplication.application_no == application_no
                    ).first()
                
                if not application and col_map.get("contract_no") and not pd.isna(row.get(col_map["contract_no"])):
                    contract_no = str(row[col_map["contract_no"]]).strip()
                    applications = self.db.query(ReductionApplication).filter(
                        ReductionApplication.contract.has(contract_no=contract_no)
                    ).order_by(ReductionApplication.created_at.desc()).all()
                    if applications:
                        application = applications[0]
                
                if not application:
                    error_count += 1
                    continue
                
                if not col_map.get("agreement_no") or pd.isna(row.get(col_map["agreement_no"])):
                    error_count += 1
                    continue

                agreement_no = str(row[col_map["agreement_no"]]).strip()
                existing = self.db.query(SupplementaryAgreement).filter(
                    SupplementaryAgreement.agreement_no == agreement_no
                ).first()

                if existing:
                    warning_count += 1
                    continue

                contract = None
                if col_map.get("contract_no") and row.get(col_map["contract_no"]):
                    contract_no = str(row[col_map["contract_no"]]).strip()
                    contract = self.db.query(Contract).filter(
                        Contract.contract_no == contract_no,
                        Contract.is_active == True
                    ).first()
                
                if not contract and application:
                    contract = application.contract

                if not contract:
                    error_count += 1
                    continue

                agreement = SupplementaryAgreement(
                    agreement_no=agreement_no,
                    contract_id=contract.id,
                    application_id=application.id if application else None,
                    version=DataCleaner.parse_int(row.get(col_map.get("version"))) or 1,
                    sign_date=DataCleaner.parse_date(row.get(col_map.get("sign_date"))),
                    effective_date=DataCleaner.parse_date(row.get(col_map.get("effective_date"))),
                    reduction_amount=DataCleaner.parse_decimal(row.get(col_map.get("reduction_amount"))) or Decimal("0"),
                    reduction_days=DataCleaner.parse_int(row.get(col_map.get("reduction_days"))),
                    payment_method=str(row[col_map["payment_method"]]).strip() if col_map.get("payment_method") and row.get(col_map["payment_method"]) else None,
                    signed_by_party_a=str(row[col_map["signed_by_party_a"]]).strip() if col_map.get("signed_by_party_a") and row.get(col_map["signed_by_party_a"]) else None,
                    signed_by_party_b=str(row[col_map["signed_by_party_b"]]).strip() if col_map.get("signed_by_party_b") and row.get(col_map["signed_by_party_b"]) else None,
                    status=str(row[col_map["status"]]).strip() if col_map.get("status") and row.get(col_map["status"]) else "草稿",
                    created_by=operator,
                    updated_by=operator,
                )

                self.db.add(agreement)
                self.db.flush()
                imported_ids.append(agreement.id)
                success_count += 1

            except Exception as e:
                error_count += 1
                continue

        return imported_ids, success_count, error_count, warning_count

    def preview_import(
        self,
        file_content: bytes,
        file_name: str,
        sheet_name: Optional[str] = None,
        n_rows: int = 10,
    ) -> Dict[str, Any]:
        df, read_stats = ExcelReader.read_file(file_content, file_name, sheet_name)
        df, clean_stats = DataCleaner.clean_dataframe(df)

        return {
            "columns": list(df.columns),
            "preview_data": ExcelReader.preview_data(df, n_rows),
            "total_rows": read_stats["total_rows"],
            "empty_columns_removed": clean_stats["empty_columns_removed"],
            "duplicate_rows_removed": clean_stats["duplicate_rows_removed"],
            "warnings": clean_stats["warnings"],
            "sheet_name": read_stats["sheet_name"],
        }

    def get_sheet_names(self, file_content: bytes, file_name: str) -> List[str]:
        return ExcelReader.get_sheet_names(file_content, file_name)
