from datetime import datetime
from typing import List, Optional, Tuple
from uuid import uuid4

from .models import (
    Enterprise,
    EmissionData,
    QuotaAllocation,
    Transaction,
    Revision,
    ImportBatch,
    ComplianceStatus,
    TransactionStatus,
    EmissionSource,
)
from .store import CarbonStore


class CarbonAccountingError(Exception):
    pass


class EnterpriseNotFoundError(CarbonAccountingError):
    pass


class InsufficientQuotaError(CarbonAccountingError):
    pass


class InvalidTransactionError(CarbonAccountingError):
    pass


class DuplicateImportError(CarbonAccountingError):
    pass


class CarbonAccountingService:
    def __init__(self, store: Optional[CarbonStore] = None):
        self.store = store or CarbonStore()

    def register_enterprise(self, name: str, compliance_year: int, enterprise_id: Optional[str] = None) -> Enterprise:
        ent_id = enterprise_id or str(uuid4())
        enterprise = Enterprise(id=ent_id, name=name, compliance_year=compliance_year)
        self.store.add_enterprise(enterprise)
        return enterprise

    def _validate_enterprise(self, enterprise_id: str) -> Enterprise:
        enterprise = self.store.get_enterprise(enterprise_id)
        if not enterprise:
            raise EnterpriseNotFoundError(f"企业不存在: {enterprise_id}")
        return enterprise

    def import_emissions(
        self,
        enterprise_id: str,
        period: str,
        emissions_data: List[Tuple[EmissionSource, float]],
        batch_id: Optional[str] = None,
        remark: Optional[str] = None,
    ) -> ImportBatch:
        self._validate_enterprise(enterprise_id)

        effective_batch_id = batch_id or str(uuid4())

        existing_batch = self.store.get_import_batch(effective_batch_id)
        if existing_batch:
            if existing_batch.status == "completed":
                return existing_batch
            raise DuplicateImportError(f"导入批次已存在且未完成: {effective_batch_id}")

        batch = ImportBatch(
            id=effective_batch_id,
            enterprise_id=enterprise_id,
            period=period,
            status="processing",
            record_count=len(emissions_data),
        )
        self.store.add_import_batch(batch)

        for source, amount in emissions_data:
            if amount < 0:
                batch.status = "failed"
                raise CarbonAccountingError(f"排放量不能为负数: {source.value} = {amount}")

            latest_version = self.store.get_latest_version(enterprise_id, period, source)
            new_version = latest_version + 1

            if latest_version > 0:
                previous_emissions = self.store.get_emission_versions(enterprise_id, period, source)
                for prev in previous_emissions:
                    if prev.is_active:
                        prev.is_active = False
                        prev.updated_at = datetime.now()

            emission = EmissionData(
                id=str(uuid4()),
                enterprise_id=enterprise_id,
                period=period,
                source=source,
                amount=amount,
                version=new_version,
                is_active=True,
                import_batch_id=effective_batch_id,
                remark=remark,
            )
            self.store.add_emission(emission)

            if new_version > 1:
                revision = Revision(
                    id=str(uuid4()),
                    enterprise_id=enterprise_id,
                    period=period,
                    version=new_version,
                    previous_version=latest_version,
                    change_type="emission_correction",
                    change_description=f"{source.value} 排放量修正: 版本 {latest_version} -> {new_version}",
                )
                self.store.add_revision(revision)

        batch.status = "completed"
        batch.completed_at = datetime.now()
        return batch

    def allocate_quota(
        self,
        enterprise_id: str,
        period: str,
        amount: float,
        remark: Optional[str] = None,
        allow_negative: bool = False,
    ) -> QuotaAllocation:
        self._validate_enterprise(enterprise_id)

        if not allow_negative and amount < 0:
            raise CarbonAccountingError("配额分配量不能为负数")

        quota = QuotaAllocation(
            id=str(uuid4()),
            enterprise_id=enterprise_id,
            period=period,
            amount=amount,
            remark=remark,
        )
        self.store.add_quota_allocation(quota)
        return quota

    def get_total_emission(self, enterprise_id: str, period: Optional[str] = None) -> float:
        emissions = self.store.get_active_emissions(enterprise_id, period)
        return sum(e.amount for e in emissions)

    def get_total_quota(self, enterprise_id: str, period: Optional[str] = None) -> float:
        quotas = self.store.get_quotas(enterprise_id, period)
        return sum(q.amount for q in quotas)

    def get_frozen_quota(self, enterprise_id: str) -> float:
        transactions = self.store.get_transactions(enterprise_id, TransactionStatus.FROZEN)
        return sum(t.frozen_amount for t in transactions)

    def get_available_quota(self, enterprise_id: str, period: Optional[str] = None) -> float:
        total_quota = self.get_total_quota(enterprise_id, period)
        frozen_quota = self.get_frozen_quota(enterprise_id)
        return total_quota - frozen_quota

    def create_transaction(
        self,
        enterprise_id: str,
        counterparty_id: str,
        amount: float,
        price: float,
        remark: Optional[str] = None,
    ) -> Transaction:
        self._validate_enterprise(enterprise_id)

        if amount <= 0:
            raise InvalidTransactionError("交易数量必须大于0")
        if price < 0:
            raise InvalidTransactionError("交易价格不能为负数")

        transaction = Transaction(
            id=str(uuid4()),
            enterprise_id=enterprise_id,
            counterparty_id=counterparty_id,
            amount=amount,
            price=price,
            status=TransactionStatus.PENDING,
            remark=remark,
        )
        self.store.add_transaction(transaction)
        return transaction

    def freeze_transaction(self, transaction_id: str) -> Transaction:
        transaction = self.store.get_transaction(transaction_id)
        if not transaction:
            raise InvalidTransactionError(f"交易不存在: {transaction_id}")

        if transaction.status != TransactionStatus.PENDING:
            raise InvalidTransactionError(f"只能冻结待处理的交易，当前状态: {transaction.status.value}")

        available = self.get_available_quota(transaction.enterprise_id)
        if available < transaction.amount:
            raise InsufficientQuotaError(
                f"可用配额不足: 可用 {available}, 需要 {transaction.amount}"
            )

        transaction.status = TransactionStatus.FROZEN
        transaction.frozen_amount = transaction.amount
        transaction.updated_at = datetime.now()

        return transaction

    def complete_transaction(self, transaction_id: str) -> Transaction:
        transaction = self.store.get_transaction(transaction_id)
        if not transaction:
            raise InvalidTransactionError(f"交易不存在: {transaction_id}")

        if transaction.status != TransactionStatus.FROZEN:
            raise InvalidTransactionError(f"只能完成已冻结的交易，当前状态: {transaction.status.value}")

        transaction.status = TransactionStatus.COMPLETED
        transaction.updated_at = datetime.now()
        transaction.completed_at = datetime.now()

        self.allocate_quota(
            enterprise_id=transaction.enterprise_id,
            period="transaction",
            amount=-transaction.amount,
            remark=f"交易完成扣减: {transaction_id}",
            allow_negative=True,
        )

        self.allocate_quota(
            enterprise_id=transaction.counterparty_id,
            period="transaction",
            amount=transaction.amount,
            remark=f"交易完成增加: {transaction_id}",
            allow_negative=True,
        )

        return transaction

    def cancel_transaction(self, transaction_id: str) -> Transaction:
        transaction = self.store.get_transaction(transaction_id)
        if not transaction:
            raise InvalidTransactionError(f"交易不存在: {transaction_id}")

        if transaction.status not in [TransactionStatus.PENDING, TransactionStatus.FROZEN]:
            raise InvalidTransactionError(
                f"只能取消待处理或已冻结的交易，当前状态: {transaction.status.value}"
            )

        transaction.status = TransactionStatus.CANCELLED
        transaction.frozen_amount = 0.0
        transaction.updated_at = datetime.now()

        return transaction

    def calculate_compliance_status(
        self,
        enterprise_id: str,
        warning_threshold: float = 0.1,
        critical_threshold: float = 0.2,
    ) -> ComplianceStatus:
        enterprise = self._validate_enterprise(enterprise_id)

        year_prefix = str(enterprise.compliance_year)
        total_emission = self.get_total_emission(enterprise_id)
        total_quota = self.get_total_quota(enterprise_id)
        frozen_quota = self.get_frozen_quota(enterprise_id)
        available_quota = total_quota - frozen_quota

        deficit = max(0.0, total_emission - available_quota)

        if total_emission > 0:
            buffer_ratio = (available_quota - total_emission) / total_emission
        else:
            buffer_ratio = float('inf')

        if deficit > 0:
            if total_emission > 0:
                deficit_ratio = deficit / total_emission
            else:
                deficit_ratio = 0.0
            if deficit_ratio >= critical_threshold:
                warning_level = "critical"
            else:
                warning_level = "warning"
        elif buffer_ratio <= warning_threshold:
            warning_level = "warning"
        else:
            warning_level = "normal"

        is_compliant = available_quota >= total_emission

        return ComplianceStatus(
            enterprise_id=enterprise_id,
            compliance_year=enterprise.compliance_year,
            total_emission=total_emission,
            total_quota=total_quota,
            frozen_quota=frozen_quota,
            available_quota=available_quota,
            deficit=deficit,
            warning_level=warning_level,
            is_compliant=is_compliant,
            report_generated_at=datetime.now(),
        )

    def get_revision_history(
        self,
        enterprise_id: str,
        period: Optional[str] = None,
    ) -> List[Revision]:
        return self.store.get_revisions(enterprise_id, period)
