from typing import Dict, Any, List, Optional, Tuple
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.config import settings
from app.models import (
    ReductionApplication,
    AnomalyFlag,
    Contract,
    AnomalyType,
    AnomalySeverity,
    AnomalyStatus,
    OperationType,
)
from app.services.audit_service import AuditService


class AnomalyService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)

    def detect_all_anomalies(self, application_id: int) -> List[AnomalyFlag]:
        application = (
            self.db.query(ReductionApplication)
            .filter(ReductionApplication.id == application_id)
            .first()
        )

        if not application:
            return []

        anomalies = []

        contract_anomalies = self._check_contract_version(application)
        anomalies.extend(contract_anomalies)

        days_anomalies = self._check_reduction_days(application)
        anomalies.extend(days_anomalies)

        duplicate_anomalies = self._check_duplicate_application(application)
        anomalies.extend(duplicate_anomalies)

        data_anomalies = self._check_data_consistency(application)
        anomalies.extend(data_anomalies)

        calc_anomalies = self._check_calculation(application)
        anomalies.extend(calc_anomalies)

        if anomalies:
            application.has_anomaly = True
            application.anomaly_description = "; ".join([a.description for a in anomalies[:3]])
            application.current_step = "异常解释"
            application.status = "异常待处理"

            self.audit_service.log_operation(
                operation_type=OperationType.ANOMALY_MARK.value,
                operator="system",
                table_name="reduction_applications",
                record_id=application_id,
                new_values={"anomaly_count": len(anomalies)},
                change_reason=f"检测到 {len(anomalies)} 个异常",
                application_id=application_id,
            )

        self.db.commit()

        return anomalies

    def _check_contract_version(self, application: ReductionApplication) -> List[AnomalyFlag]:
        anomalies = []

        contract = (
            self.db.query(Contract)
            .filter(Contract.id == application.contract_id)
            .first()
        )

        if not contract:
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.CONTRACT_VERSION_ERROR.value,
                severity=AnomalySeverity.CRITICAL.value,
                status=AnomalyStatus.OPEN.value,
                field_name="contract_id",
                expected_value="有效合同",
                description=f"合同ID {application.contract_id} 不存在",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)
            return anomalies

        if contract.status != "生效中":
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.CONTRACT_VERSION_ERROR.value,
                severity=AnomalySeverity.HIGH.value,
                status=AnomalyStatus.OPEN.value,
                field_name="contract_status",
                old_value=contract.status,
                expected_value="生效中",
                description=f"合同状态为 '{contract.status}'，不是生效状态",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        if application.closure_start_date < contract.start_date:
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.CONTRACT_VERSION_ERROR.value,
                severity=AnomalySeverity.HIGH.value,
                status=AnomalyStatus.OPEN.value,
                field_name="closure_start_date",
                old_value=str(application.closure_start_date),
                expected_value=str(contract.start_date),
                description=f"闭店开始日期 {application.closure_start_date} 早于合同起始日期 {contract.start_date}",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        if application.closure_end_date > contract.end_date:
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.CONTRACT_VERSION_ERROR.value,
                severity=AnomalySeverity.HIGH.value,
                status=AnomalyStatus.OPEN.value,
                field_name="closure_end_date",
                old_value=str(application.closure_end_date),
                expected_value=str(contract.end_date),
                description=f"闭店结束日期 {application.closure_end_date} 晚于合同结束日期 {contract.end_date}",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

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
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.CONTRACT_VERSION_ERROR.value,
                severity=AnomalySeverity.HIGH.value,
                status=AnomalyStatus.OPEN.value,
                field_name="contract_version",
                old_value=str(contract.version),
                expected_value=str(latest_contract.version),
                description=f"存在更新版本的合同 (V{latest_contract.version})，当前使用的是 V{contract.version}",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        return anomalies

    def _check_reduction_days(self, application: ReductionApplication) -> List[AnomalyFlag]:
        anomalies = []

        actual_days = (application.closure_end_date - application.closure_start_date).days + 1

        if application.applied_days != actual_days:
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.DAYS_EXCEEDED.value,
                severity=AnomalySeverity.MEDIUM.value,
                status=AnomalyStatus.OPEN.value,
                field_name="applied_days",
                old_value=str(application.applied_days),
                expected_value=str(actual_days),
                description=f"申请天数 {application.applied_days} 与实际闭店天数 {actual_days} 不一致",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        max_days = settings.MAX_REDUCTION_DAYS

        if actual_days > max_days:
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.DAYS_EXCEEDED.value,
                severity=AnomalySeverity.HIGH.value,
                status=AnomalyStatus.OPEN.value,
                field_name="applied_days",
                old_value=str(actual_days),
                expected_value=str(max_days),
                description=f"减免天数 {actual_days} 天超过最大限制 {max_days} 天",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        if application.approved_days and application.approved_days > actual_days:
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.DAYS_EXCEEDED.value,
                severity=AnomalySeverity.HIGH.value,
                status=AnomalyStatus.OPEN.value,
                field_name="approved_days",
                old_value=str(application.approved_days),
                expected_value=str(actual_days),
                description=f"核定天数 {application.approved_days} 超过实际闭店天数 {actual_days}",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        return anomalies

    def _check_duplicate_application(self, application: ReductionApplication) -> List[AnomalyFlag]:
        anomalies = []

        overlapping = (
            self.db.query(ReductionApplication)
            .filter(
                ReductionApplication.id != application.id,
                ReductionApplication.contract_id == application.contract_id,
                ReductionApplication.is_active == True,
                or_(
                    and_(
                        ReductionApplication.closure_start_date <= application.closure_end_date,
                        ReductionApplication.closure_end_date >= application.closure_start_date,
                    )
                ),
            )
            .all()
        )

        for app in overlapping:
            overlap_start = max(app.closure_start_date, application.closure_start_date)
            overlap_end = min(app.closure_end_date, application.closure_end_date)
            overlap_days = (overlap_end - overlap_start).days + 1

            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.DUPLICATE_APPLICATION.value,
                severity=AnomalySeverity.HIGH.value,
                status=AnomalyStatus.OPEN.value,
                field_name="closure_date_range",
                old_value=f"{application.closure_start_date} ~ {application.closure_end_date}",
                expected_value="无重叠",
                description=f"与申请 {app.application_no} 存在日期重叠，重叠 {overlap_days} 天 ({overlap_start} ~ {overlap_end})",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        return anomalies

    def _check_data_consistency(self, application: ReductionApplication) -> List[AnomalyFlag]:
        anomalies = []

        contract = (
            self.db.query(Contract)
            .filter(Contract.id == application.contract_id)
            .first()
        )

        if contract:
            if application.tenant_name != contract.tenant_name:
                anomaly = AnomalyFlag(
                    application_id=application.id,
                    anomaly_type=AnomalyType.DATA_INCONSISTENCY.value,
                    severity=AnomalySeverity.MEDIUM.value,
                    status=AnomalyStatus.OPEN.value,
                    field_name="tenant_name",
                    old_value=application.tenant_name,
                    expected_value=contract.tenant_name,
                    description=f"租户名称 '{application.tenant_name}' 与合同 '{contract.tenant_name}' 不一致",
                    detected_by="system",
                    detected_at=date.today(),
                )
                self.db.add(anomaly)
                anomalies.append(anomaly)

            if application.store_code and contract.store_code and application.store_code != contract.store_code:
                anomaly = AnomalyFlag(
                    application_id=application.id,
                    anomaly_type=AnomalyType.DATA_INCONSISTENCY.value,
                    severity=AnomalySeverity.LOW.value,
                    status=AnomalyStatus.OPEN.value,
                    field_name="store_code",
                    old_value=application.store_code,
                    expected_value=contract.store_code,
                    description=f"铺位编号 '{application.store_code}' 与合同 '{contract.store_code}' 不一致",
                    detected_by="system",
                    detected_at=date.today(),
                )
                self.db.add(anomaly)
                anomalies.append(anomaly)

            monthly_rent = application.monthly_rent_standard or contract.monthly_rent
            if application.monthly_rent_standard and application.monthly_rent_standard != contract.monthly_rent:
                anomaly = AnomalyFlag(
                    application_id=application.id,
                    anomaly_type=AnomalyType.DATA_INCONSISTENCY.value,
                    severity=AnomalySeverity.MEDIUM.value,
                    status=AnomalyStatus.OPEN.value,
                    field_name="monthly_rent_standard",
                    old_value=str(application.monthly_rent_standard),
                    expected_value=str(contract.monthly_rent),
                    description=f"月租金标准 {application.monthly_rent_standard} 与合同 {contract.monthly_rent} 不一致",
                    detected_by="system",
                    detected_at=date.today(),
                )
                self.db.add(anomaly)
                anomalies.append(anomaly)

        if application.closure_start_date > application.closure_end_date:
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.INVALID_DATA.value,
                severity=AnomalySeverity.CRITICAL.value,
                status=AnomalyStatus.OPEN.value,
                field_name="closure_date_range",
                old_value=f"{application.closure_start_date} ~ {application.closure_end_date}",
                expected_value="开始日期 <= 结束日期",
                description="闭店开始日期晚于结束日期",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        if application.reduction_ratio < 0 or application.reduction_ratio > 1:
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.INVALID_DATA.value,
                severity=AnomalySeverity.HIGH.value,
                status=AnomalyStatus.OPEN.value,
                field_name="reduction_ratio",
                old_value=str(application.reduction_ratio),
                expected_value="0 ~ 1",
                description=f"减免比例 {application.reduction_ratio} 超出有效范围 (0 ~ 1)",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        return anomalies

    def _check_calculation(self, application: ReductionApplication) -> List[AnomalyFlag]:
        anomalies = []

        if application.approved_days and application.monthly_rent_standard:
            daily_rent = application.monthly_rent_standard / Decimal("30")
            expected_rent_reduction = daily_rent * Decimal(application.approved_days) * application.reduction_ratio

            if abs(expected_rent_reduction - application.calculated_rent_reduction) > Decimal("0.01"):
                anomaly = AnomalyFlag(
                    application_id=application.id,
                    anomaly_type=AnomalyType.CALCULATION_ERROR.value,
                    severity=AnomalySeverity.HIGH.value,
                    status=AnomalyStatus.OPEN.value,
                    field_name="calculated_rent_reduction",
                    old_value=str(application.calculated_rent_reduction),
                    expected_value=str(expected_rent_reduction.quantize(Decimal("0.01"))),
                    description=f"租金减免计算结果 {application.calculated_rent_reduction} 与预期 {expected_rent_reduction.quantize(Decimal('0.01'))} 不一致",
                    detected_by="system",
                    detected_at=date.today(),
                )
                self.db.add(anomaly)
                anomalies.append(anomaly)

        if application.approved_days and application.monthly_service_fee_standard:
            daily_service_fee = application.monthly_service_fee_standard / Decimal("30")
            expected_service_reduction = daily_service_fee * Decimal(application.approved_days) * application.reduction_ratio

            if abs(expected_service_reduction - application.calculated_service_fee_reduction) > Decimal("0.01"):
                anomaly = AnomalyFlag(
                    application_id=application.id,
                    anomaly_type=AnomalyType.CALCULATION_ERROR.value,
                    severity=AnomalySeverity.HIGH.value,
                    status=AnomalyStatus.OPEN.value,
                    field_name="calculated_service_fee_reduction",
                    old_value=str(application.calculated_service_fee_reduction),
                    expected_value=str(expected_service_reduction.quantize(Decimal("0.01"))),
                    description=f"物业费减免计算结果 {application.calculated_service_fee_reduction} 与预期 {expected_service_reduction.quantize(Decimal('0.01'))} 不一致",
                    detected_by="system",
                    detected_at=date.today(),
                )
                self.db.add(anomaly)
                anomalies.append(anomaly)

        expected_total = application.calculated_rent_reduction + application.calculated_service_fee_reduction
        if abs(expected_total - application.total_reduction_amount) > Decimal("0.01"):
            anomaly = AnomalyFlag(
                application_id=application.id,
                anomaly_type=AnomalyType.CALCULATION_ERROR.value,
                severity=AnomalySeverity.MEDIUM.value,
                status=AnomalyStatus.OPEN.value,
                field_name="total_reduction_amount",
                old_value=str(application.total_reduction_amount),
                expected_value=str(expected_total.quantize(Decimal("0.01"))),
                description=f"减免总额 {application.total_reduction_amount} 与分项合计 {expected_total.quantize(Decimal('0.01'))} 不一致",
                detected_by="system",
                detected_at=date.today(),
            )
            self.db.add(anomaly)
            anomalies.append(anomaly)

        return anomalies

    def resolve_anomaly(
        self,
        anomaly_id: int,
        resolution: str,
        resolved_by: str,
        new_value: Optional[str] = None,
        status: str = AnomalyStatus.RESOLVED.value,
    ) -> Optional[AnomalyFlag]:
        anomaly = (
            self.db.query(AnomalyFlag)
            .filter(AnomalyFlag.id == anomaly_id)
            .first()
        )

        if not anomaly:
            return None

        anomaly.status = status
        anomaly.resolution = resolution
        anomaly.resolved_by = resolved_by
        anomaly.resolved_at = date.today()

        if new_value is not None:
            anomaly.new_value = new_value

        self.audit_service.log_operation(
            operation_type=OperationType.ANOMALY_RESOLVE.value,
            operator=resolved_by,
            table_name="anomaly_flags",
            record_id=anomaly_id,
            new_values={"status": status, "resolution": resolution},
            change_reason=resolution,
            application_id=anomaly.application_id,
        )

        application = (
            self.db.query(ReductionApplication)
            .filter(ReductionApplication.id == anomaly.application_id)
            .first()
        )

        if application:
            open_anomalies = (
                self.db.query(AnomalyFlag)
                .filter(
                    AnomalyFlag.application_id == application.id,
                    AnomalyFlag.status == AnomalyStatus.OPEN.value,
                )
                .count()
            )

            if open_anomalies == 0:
                application.has_anomaly = False
                application.anomaly_description = None
                if application.status == "异常待处理":
                    application.status = "已试算"
                    application.current_step = "审批状态"

        self.db.commit()

        return anomaly

    def get_application_anomalies(
        self, application_id: int, status: Optional[str] = None
    ) -> List[AnomalyFlag]:
        query = self.db.query(AnomalyFlag).filter(AnomalyFlag.application_id == application_id)

        if status:
            query = query.filter(AnomalyFlag.status == status)

        return query.order_by(AnomalyFlag.severity.desc(), AnomalyFlag.created_at.desc()).all()

    def acknowledge_anomaly(self, anomaly_id: int, acknowledged_by: str) -> Optional[AnomalyFlag]:
        anomaly = (
            self.db.query(AnomalyFlag)
            .filter(AnomalyFlag.id == anomaly_id)
            .first()
        )

        if not anomaly:
            return None

        anomaly.status = AnomalyStatus.ACKNOWLEDGED.value

        self.audit_service.log_operation(
            operation_type=OperationType.ANOMALY_MARK.value,
            operator=acknowledged_by,
            table_name="anomaly_flags",
            record_id=anomaly_id,
            new_values={"status": AnomalyStatus.ACKNOWLEDGED.value},
            change_reason="已确认异常",
            application_id=anomaly.application_id,
        )

        self.db.commit()

        return anomaly

    def ignore_anomaly(self, anomaly_id: int, ignored_by: str, reason: str) -> Optional[AnomalyFlag]:
        return self.resolve_anomaly(
            anomaly_id=anomaly_id,
            resolution=f"忽略异常: {reason}",
            resolved_by=ignored_by,
            status=AnomalyStatus.IGNORED.value,
        )
