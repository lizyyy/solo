from collections import defaultdict
from typing import Dict, List, Optional
from .models import (
    Enterprise,
    EmissionData,
    QuotaAllocation,
    Transaction,
    Revision,
    ImportBatch,
    TransactionStatus,
    EmissionSource,
)


class CarbonStore:
    def __init__(self):
        self.enterprises: Dict[str, Enterprise] = {}
        self.emissions: Dict[str, List[EmissionData]] = defaultdict(list)
        self.quotas: Dict[str, List[QuotaAllocation]] = defaultdict(list)
        self.transactions: Dict[str, Transaction] = {}
        self.transactions_by_enterprise: Dict[str, List[Transaction]] = defaultdict(list)
        self.revisions: Dict[str, List[Revision]] = defaultdict(list)
        self.import_batches: Dict[str, ImportBatch] = {}

    def add_enterprise(self, enterprise: Enterprise) -> None:
        self.enterprises[enterprise.id] = enterprise

    def get_enterprise(self, enterprise_id: str) -> Optional[Enterprise]:
        return self.enterprises.get(enterprise_id)

    def add_emission(self, emission: EmissionData) -> None:
        self.emissions[emission.enterprise_id].append(emission)

    def get_active_emissions(self, enterprise_id: str, period: Optional[str] = None) -> List[EmissionData]:
        emissions = [e for e in self.emissions[enterprise_id] if e.is_active]
        if period:
            emissions = [e for e in emissions if e.period == period]
        return emissions

    def get_emission_versions(self, enterprise_id: str, period: str, source: EmissionSource) -> List[EmissionData]:
        return [
            e
            for e in self.emissions[enterprise_id]
            if e.period == period and e.source == source
        ]

    def add_quota_allocation(self, quota: QuotaAllocation) -> None:
        self.quotas[quota.enterprise_id].append(quota)

    def get_quotas(self, enterprise_id: str, period: Optional[str] = None) -> List[QuotaAllocation]:
        quotas = self.quotas[enterprise_id]
        if period:
            quotas = [q for q in quotas if q.period == period]
        return quotas

    def add_transaction(self, transaction: Transaction) -> None:
        self.transactions[transaction.id] = transaction
        self.transactions_by_enterprise[transaction.enterprise_id].append(transaction)

    def get_transaction(self, transaction_id: str) -> Optional[Transaction]:
        return self.transactions.get(transaction_id)

    def get_transactions(self, enterprise_id: str, status: Optional[TransactionStatus] = None) -> List[Transaction]:
        transactions = self.transactions_by_enterprise[enterprise_id]
        if status:
            transactions = [t for t in transactions if t.status == status]
        return transactions

    def add_revision(self, revision: Revision) -> None:
        self.revisions[revision.enterprise_id].append(revision)

    def get_revisions(self, enterprise_id: str, period: Optional[str] = None) -> List[Revision]:
        revisions = self.revisions[enterprise_id]
        if period:
            revisions = [r for r in revisions if r.period == period]
        return revisions

    def add_import_batch(self, batch: ImportBatch) -> None:
        self.import_batches[batch.id] = batch

    def get_import_batch(self, batch_id: str) -> Optional[ImportBatch]:
        return self.import_batches.get(batch_id)

    def get_latest_version(self, enterprise_id: str, period: str, source: EmissionSource) -> int:
        versions = self.get_emission_versions(enterprise_id, period, source)
        if not versions:
            return 0
        return max(e.version for e in versions)
