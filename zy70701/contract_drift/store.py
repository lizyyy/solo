import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set

from .models import (
    Contract,
    Sample,
    Consumer,
    ConfirmationRecord,
    ConfirmationStatus,
    ImportResult,
)


class DataStore:
    def __init__(self, storage_path: Optional[str] = None):
        if storage_path:
            self.storage_path = Path(storage_path)
        else:
            self.storage_path = Path.cwd() / ".contract-drift"
        self.storage_path.mkdir(parents=True, exist_ok=True)

        self.contracts: Dict[str, Contract] = {}
        self.samples: Dict[str, Sample] = {}
        self.consumers: Dict[str, Consumer] = {}
        self.confirmations: Dict[str, ConfirmationRecord] = {}

        self._sample_hashes: Set[str] = set()
        self._contract_hashes: Set[str] = set()

        self._load_from_disk()

    def _load_from_disk(self):
        contracts_file = self.storage_path / "contracts.json"
        if contracts_file.exists():
            data = json.loads(contracts_file.read_text(encoding="utf-8"))
            for item in data:
                contract = Contract(**item)
                self.contracts[contract.id] = contract
                self._contract_hashes.add(self._compute_contract_hash(contract))

        samples_file = self.storage_path / "samples.json"
        if samples_file.exists():
            data = json.loads(samples_file.read_text(encoding="utf-8"))
            for item in data:
                sample = Sample(**item)
                self.samples[sample.id] = sample
                self._sample_hashes.add(sample.import_hash)

        consumers_file = self.storage_path / "consumers.json"
        if consumers_file.exists():
            data = json.loads(consumers_file.read_text(encoding="utf-8"))
            for item in data:
                consumer = Consumer(**item)
                self.consumers[consumer.id] = consumer

        confirmations_file = self.storage_path / "confirmations.json"
        if confirmations_file.exists():
            data = json.loads(confirmations_file.read_text(encoding="utf-8"))
            for item in data:
                confirmation = ConfirmationRecord(**item)
                self.confirmations[confirmation.id] = confirmation

    def _save_to_disk(self):
        contracts_data = [c.model_dump() for c in self.contracts.values()]
        (self.storage_path / "contracts.json").write_text(
            json.dumps(contracts_data, default=str, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        samples_data = [s.model_dump() for s in self.samples.values()]
        (self.storage_path / "samples.json").write_text(
            json.dumps(samples_data, default=str, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        consumers_data = [c.model_dump() for c in self.consumers.values()]
        (self.storage_path / "consumers.json").write_text(
            json.dumps(consumers_data, default=str, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        confirmations_data = [c.model_dump() for c in self.confirmations.values()]
        (self.storage_path / "confirmations.json").write_text(
            json.dumps(confirmations_data, default=str, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def _compute_contract_hash(self, contract: Contract) -> str:
        fields_json = json.dumps(
            [f.model_dump() for f in contract.fields], sort_keys=True
        )
        key = f"{contract.api_path}:{contract.method}:{contract.version}:{fields_json}"
        return hashlib.sha256(key.encode()).hexdigest()

    def import_contract(self, contract: Contract) -> ImportResult:
        contract_hash = self._compute_contract_hash(contract)

        if contract_hash in self._contract_hashes:
            return ImportResult(
                success=True,
                imported_count=0,
                skipped_count=1,
                skipped_ids=[contract.id],
                errors=["Contract with same content already exists"],
            )

        self.contracts[contract.id] = contract
        self._contract_hashes.add(contract_hash)
        self._save_to_disk()

        return ImportResult(
            success=True,
            imported_count=1,
            skipped_count=0,
            imported_ids=[contract.id],
        )

    def import_sample(self, sample: Sample) -> ImportResult:
        if sample.import_hash in self._sample_hashes:
            return ImportResult(
                success=True,
                imported_count=0,
                skipped_count=1,
                skipped_ids=[sample.id],
                errors=["Sample with same content already exists"],
            )

        if sample.contract_id not in self.contracts:
            return ImportResult(
                success=False,
                imported_count=0,
                skipped_count=1,
                errors=[f"Contract {sample.contract_id} not found"],
            )

        self.samples[sample.id] = sample
        self._sample_hashes.add(sample.import_hash)
        self._save_to_disk()

        return ImportResult(
            success=True,
            imported_count=1,
            skipped_count=0,
            imported_ids=[sample.id],
        )

    def import_contracts(self, contracts: List[Contract]) -> ImportResult:
        imported_ids = []
        skipped_ids = []
        errors = []

        for contract in contracts:
            result = self.import_contract(contract)
            if result.imported_count > 0:
                imported_ids.extend(result.imported_ids)
            elif result.skipped_count > 0:
                skipped_ids.extend(result.skipped_ids)
            errors.extend(result.errors)

        return ImportResult(
            success=True,
            imported_count=len(imported_ids),
            skipped_count=len(skipped_ids),
            imported_ids=sorted(imported_ids),
            skipped_ids=sorted(skipped_ids),
            errors=errors,
        )

    def import_samples(self, samples: List[Sample]) -> ImportResult:
        imported_ids = []
        skipped_ids = []
        errors = []

        for sample in samples:
            result = self.import_sample(sample)
            if result.imported_count > 0:
                imported_ids.extend(result.imported_ids)
            elif result.skipped_count > 0:
                skipped_ids.extend(result.skipped_ids)
            errors.extend(result.errors)

        return ImportResult(
            success=True,
            imported_count=len(imported_ids),
            skipped_count=len(skipped_ids),
            imported_ids=sorted(imported_ids),
            skipped_ids=sorted(skipped_ids),
            errors=errors,
        )

    def register_consumer(self, consumer: Consumer) -> Consumer:
        self.consumers[consumer.id] = consumer
        self._save_to_disk()
        return consumer

    def get_consumer(self, consumer_id: str) -> Optional[Consumer]:
        return self.consumers.get(consumer_id)

    def get_contract(self, contract_id: str) -> Optional[Contract]:
        return self.contracts.get(contract_id)

    def get_sample(self, sample_id: str) -> Optional[Sample]:
        return self.samples.get(sample_id)

    def get_samples_for_contract(self, contract_id: str) -> List[Sample]:
        return sorted(
            [s for s in self.samples.values() if s.contract_id == contract_id],
            key=lambda s: s.imported_at,
        )

    def add_confirmation(
        self,
        consumer_id: str,
        drift_id: str,
        contract_id: str,
        sample_id: str,
        field_path: str,
        status: ConfirmationStatus,
        comment: Optional[str] = None,
        confirmed_by: Optional[str] = None,
    ) -> ConfirmationRecord:
        record_id = self._generate_confirmation_id(
            consumer_id, drift_id, contract_id, sample_id, field_path
        )

        existing = self.confirmations.get(record_id)
        if existing:
            existing.status = status
            existing.comment = comment
            existing.confirmed_at = datetime.now()
            existing.confirmed_by = confirmed_by
            self._save_to_disk()
            return existing

        confirmation = ConfirmationRecord(
            id=record_id,
            consumer_id=consumer_id,
            drift_id=drift_id,
            contract_id=contract_id,
            sample_id=sample_id,
            field_path=field_path,
            status=status,
            comment=comment,
            confirmed_at=datetime.now(),
            confirmed_by=confirmed_by,
        )
        self.confirmations[record_id] = confirmation
        self._save_to_disk()
        return confirmation

    def _generate_confirmation_id(
        self,
        consumer_id: str,
        drift_id: str,
        contract_id: str,
        sample_id: str,
        field_path: str,
    ) -> str:
        key = f"{consumer_id}:{drift_id}:{contract_id}:{sample_id}:{field_path}"
        return hashlib.md5(key.encode()).hexdigest()[:16]

    def get_confirmations_for_drift(
        self, drift_id: str
    ) -> List[ConfirmationRecord]:
        return sorted(
            [c for c in self.confirmations.values() if c.drift_id == drift_id],
            key=lambda c: c.created_at,
        )

    def get_confirmations_for_consumer(
        self, consumer_id: str
    ) -> List[ConfirmationRecord]:
        return sorted(
            [
                c
                for c in self.confirmations.values()
                if c.consumer_id == consumer_id
            ],
            key=lambda c: c.created_at,
            reverse=True,
        )

    def list_contracts(self) -> List[Contract]:
        return sorted(
            self.contracts.values(), key=lambda c: (c.api_path, c.version)
        )

    def list_samples(self) -> List[Sample]:
        return sorted(self.samples.values(), key=lambda s: s.imported_at, reverse=True)

    def list_consumers(self) -> List[Consumer]:
        return sorted(
            self.consumers.values(), key=lambda c: c.registered_at, reverse=True
        )

    def clear(self):
        self.contracts.clear()
        self.samples.clear()
        self.consumers.clear()
        self.confirmations.clear()
        self._sample_hashes.clear()
        self._contract_hashes.clear()
        self._save_to_disk()
