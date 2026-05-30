from typing import Dict, Any, List, Optional, Tuple
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
import json

from app.config import settings
from app.models import (
    ReductionApplication,
    Contract,
    ReductionCalculation,
    StoreClosureProof,
    ApplicationStatus,
    OperationType,
)
from app.schemas.reduction import ReductionTrialCalcResult
from app.services.audit_service import AuditService
from app.services.anomaly_service import AnomalyService


class CalculationService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
        self.anomaly_service = AnomalyService(db)

    def calculate_reduction(
        self, application_id: int, operator: str = "system", is_manual_override: bool = False
    ) -> ReductionTrialCalcResult:
        application = (
            self.db.query(ReductionApplication)
            .filter(ReductionApplication.id == application_id)
            .first()
        )

        if not application:
            raise ValueError(f"减免申请 {application_id} 不存在")

        contract = (
            self.db.query(Contract)
            .filter(Contract.id == application.contract_id)
            .first()
        )

        if not contract:
            raise ValueError(f"合同 {application.contract_id} 不存在")

        monthly_rent = application.monthly_rent_standard or contract.monthly_rent
        monthly_service_fee = application.monthly_service_fee_standard or contract.monthly_service_fee

        daily_rent = (monthly_rent / Decimal("30")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        daily_service_fee = (monthly_service_fee / Decimal("30")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        actual_reduction_days = self._calculate_actual_days(application, contract)

        rent_reduction = (daily_rent * Decimal(actual_reduction_days) * application.reduction_ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        service_fee_reduction = (daily_service_fee * Decimal(actual_reduction_days) * application.reduction_ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_reduction = (rent_reduction + service_fee_reduction).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        calculation_details = self._build_calculation_details(
            application=application,
            contract=contract,
            daily_rent=daily_rent,
            daily_service_fee=daily_service_fee,
            actual_reduction_days=actual_reduction_days,
            rent_reduction=rent_reduction,
            service_fee_reduction=service_fee_reduction,
            total_reduction=total_reduction,
        )

        old_calculations = (
            self.db.query(ReductionCalculation)
            .filter(
                ReductionCalculation.application_id == application_id,
                ReductionCalculation.is_current == True,
            )
            .all()
        )
        for calc in old_calculations:
            calc.is_current = False

        max_version = (
            self.db.query(ReductionCalculation)
            .filter(ReductionCalculation.application_id == application_id)
            .count()
        ) + 1

        calculation = ReductionCalculation(
            application_id=application_id,
            calculation_version=max_version,
            is_current=True,
            calculation_method="标准计算法: 日租金 × 减免天数 × 减免比例",
            daily_rent=daily_rent,
            daily_service_fee=daily_service_fee,
            actual_reduction_days=actual_reduction_days,
            rent_reduction=rent_reduction,
            service_fee_reduction=service_fee_reduction,
            total_reduction=total_reduction,
            reduction_ratio_applied=application.reduction_ratio,
            calculation_details=calculation_details,
            is_manual_override=is_manual_override,
            override_reason=application.manual_override_reason if is_manual_override else None,
            override_by=operator if is_manual_override else None,
        )

        self.db.add(calculation)

        application.calculated_rent_reduction = rent_reduction
        application.calculated_service_fee_reduction = service_fee_reduction
        application.total_reduction_amount = total_reduction
        application.approved_days = actual_reduction_days
        application.reduction_start_date = application.closure_start_date
        application.reduction_end_date = application.closure_end_date
        application.trial_calc_result = calculation_details
        application.current_step = "减免试算"
        application.status = ApplicationStatus.TRIAL_CALCULATED.value

        self.db.flush()

        anomalies = self.anomaly_service.detect_all_anomalies(application_id)

        anomalies_info = []
        for anomaly in anomalies:
            anomalies_info.append({
                "id": anomaly.id,
                "type": anomaly.anomaly_type,
                "severity": anomaly.severity,
                "description": anomaly.description,
                "field": anomaly.field_name,
            })

        if not anomalies:
            application.current_step = "审批状态"
            application.status = ApplicationStatus.TRIAL_CALCULATED.value

        self.audit_service.log_operation(
            operation_type=OperationType.CALCULATE.value,
            operator=operator,
            table_name="reduction_calculations",
            record_id=calculation.id,
            new_values={
                "actual_reduction_days": actual_reduction_days,
                "total_reduction": str(total_reduction),
                "rent_reduction": str(rent_reduction),
                "service_fee_reduction": str(service_fee_reduction),
            },
            change_reason="执行减免试算",
            application_id=application_id,
        )

        self.db.commit()

        contract_version_valid, contract_version_info = self._validate_contract_version(contract)

        return ReductionTrialCalcResult(
            application_id=application_id,
            application_no=application.application_no,
            tenant_name=application.tenant_name,
            daily_rent=daily_rent,
            daily_service_fee=daily_service_fee,
            applied_days=application.applied_days,
            actual_reduction_days=actual_reduction_days,
            rent_reduction=rent_reduction,
            service_fee_reduction=service_fee_reduction,
            total_reduction=total_reduction,
            reduction_ratio=application.reduction_ratio,
            calculation_details=calculation_details,
            anomalies=anomalies_info,
            contract_version_valid=contract_version_valid,
            contract_version_info=contract_version_info,
        )

    def _calculate_actual_days(
        self, application: ReductionApplication, contract: Contract
    ) -> int:
        closure_start = application.closure_start_date
        closure_end = application.closure_end_date

        effective_start = max(closure_start, contract.start_date)
        effective_end = min(closure_end, contract.end_date)

        if effective_start > effective_end:
            return 0

        closure_proofs = (
            self.db.query(StoreClosureProof)
            .filter(
                StoreClosureProof.application_id == application.id,
                StoreClosureProof.verification_status == "已核实",
            )
            .all()
        )

        if closure_proofs:
            total_verified_days = 0
            for proof in closure_proofs:
                if proof.actual_closure_date and proof.actual_reopen_date:
                    proof_start = max(proof.actual_closure_date, contract.start_date)
                    proof_end = min(proof.actual_reopen_date, contract.end_date)
                    if proof_start <= proof_end:
                        proof_days = (proof_end - proof_start).days + 1
                        if proof.actual_closure_days:
                            proof_days = min(proof_days, proof.actual_closure_days)
                        total_verified_days += proof_days

            if total_verified_days > 0:
                actual_days = (effective_end - effective_start).days + 1
                return min(actual_days, total_verified_days)

        actual_days = (effective_end - effective_start).days + 1

        if application.approved_days and application.approved_days > 0:
            actual_days = min(actual_days, application.approved_days)

        return max(0, actual_days)

    def _validate_contract_version(self, contract: Contract) -> Tuple[bool, str]:
        if contract.status != "生效中":
            return False, f"合同状态为 {contract.status}，非生效状态"

        latest_contract = (
            self.db.query(Contract)
            .filter(
                Contract.contract_no == contract.contract_no,
                Contract.id != contract.id,
                Contract.is_active == True,
            )
            .order_by(Contract.version.desc())
            .first()
        )

        if latest_contract and latest_contract.version > contract.version:
            return False, f"存在更新版本 V{latest_contract.version} (当前使用 V{contract.version})"

        return True, f"合同版本 V{contract.version} 有效"

    def _build_calculation_details(
        self,
        application: ReductionApplication,
        contract: Contract,
        daily_rent: Decimal,
        daily_service_fee: Decimal,
        actual_reduction_days: int,
        rent_reduction: Decimal,
        service_fee_reduction: Decimal,
        total_reduction: Decimal,
    ) -> str:
        details = {
            "合同信息": {
                "合同编号": contract.contract_no,
                "合同版本": f"V{contract.version}",
                "合同期限": f"{contract.start_date} 至 {contract.end_date}",
            },
            "减免申请信息": {
                "申请编号": application.application_no,
                "闭店日期": f"{application.closure_start_date} 至 {application.closure_end_date}",
                "申请天数": application.applied_days,
                "减免原因": application.reduction_reason,
                "减免比例": f"{float(application.reduction_ratio * 100):.2f}%",
            },
            "计算依据": {
                "月租金标准": f"{float(application.monthly_rent_standard or contract.monthly_rent):.2f} 元",
                "月物业费标准": f"{float(application.monthly_service_fee_standard or contract.monthly_service_fee):.2f} 元",
                "日租金": f"{float(daily_rent):.2f} 元",
                "日物业费": f"{float(daily_service_fee):.2f} 元",
                "实际减免天数": f"{actual_reduction_days} 天",
            },
            "计算结果": {
                "租金减免": f"{float(rent_reduction):.2f} 元",
                "物业费减免": f"{float(service_fee_reduction):.2f} 元",
                "减免合计": f"{float(total_reduction):.2f} 元",
            },
            "计算公式": [
                f"租金减免 = 日租金({float(daily_rent):.2f}) × 减免天数({actual_reduction_days}) × 减免比例({float(application.reduction_ratio * 100):.2f}%) = {float(rent_reduction):.2f} 元",
                f"物业费减免 = 日物业费({float(daily_service_fee):.2f}) × 减免天数({actual_reduction_days}) × 减免比例({float(application.reduction_ratio * 100):.2f}%) = {float(service_fee_reduction):.2f} 元",
                f"减免合计 = 租金减免 + 物业费减免 = {float(total_reduction):.2f} 元",
            ],
        }

        return json.dumps(details, ensure_ascii=False, indent=2)

    def get_calculation_history(
        self, application_id: int
    ) -> List[Dict[str, Any]]:
        calculations = (
            self.db.query(ReductionCalculation)
            .filter(ReductionCalculation.application_id == application_id)
            .order_by(ReductionCalculation.calculation_version.desc())
            .all()
        )

        history = []
        for calc in calculations:
            history.append({
                "version": calc.calculation_version,
                "is_current": calc.is_current,
                "actual_reduction_days": calc.actual_reduction_days,
                "daily_rent": float(calc.daily_rent) if calc.daily_rent else 0,
                "daily_service_fee": float(calc.daily_service_fee) if calc.daily_service_fee else 0,
                "rent_reduction": float(calc.rent_reduction) if calc.rent_reduction else 0,
                "service_fee_reduction": float(calc.service_fee_reduction) if calc.service_fee_reduction else 0,
                "total_reduction": float(calc.total_reduction) if calc.total_reduction else 0,
                "is_manual_override": calc.is_manual_override,
                "override_reason": calc.override_reason,
                "override_by": calc.override_by,
                "created_at": calc.created_at,
            })

        return history

    def recalculate_with_override(
        self,
        application_id: int,
        override_fields: Dict[str, Any],
        operator: str,
        reason: str,
    ) -> ReductionTrialCalcResult:
        application = (
            self.db.query(ReductionApplication)
            .filter(ReductionApplication.id == application_id)
            .first()
        )

        if not application:
            raise ValueError(f"减免申请 {application_id} 不存在")

        old_values = {}
        for field, value in override_fields.items():
            if hasattr(application, field):
                old_values[field] = getattr(application, field)
                setattr(application, field, value)

        application.manual_override = True
        application.manual_override_reason = reason
        application.manual_override_by = operator

        self.audit_service.log_manual_override(
            application_id=application_id,
            old_values=old_values,
            new_values=override_fields,
            operator=operator,
            reason=reason,
        )

        self.db.flush()

        return self.calculate_reduction(application_id, operator, is_manual_override=True)
