import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import asdict

from models import SLOBudget, ReleaseBatch, ServiceSLO, ReleaseStatus, DecisionType


class JSONStorage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.budgets_file = os.path.join(data_dir, "budgets.json")
        self.batches_file = os.path.join(data_dir, "batches.json")
        self.services_file = os.path.join(data_dir, "services.json")
        self._init_storage()

    def _init_storage(self):
        os.makedirs(self.data_dir, exist_ok=True)
        for f in [self.budgets_file, self.batches_file, self.services_file]:
            if not os.path.exists(f):
                with open(f, "w") as fp:
                    json.dump([], fp)

    def _read_json(self, filepath: str) -> List[Dict]:
        with open(filepath, "r") as fp:
            return json.load(fp)

    def _write_json(self, filepath: str, data: List[Dict]):
        with open(filepath, "w") as fp:
            json.dump(data, fp, indent=2, ensure_ascii=False)

    def save_budget(self, budget: SLOBudget) -> SLOBudget:
        budgets = self._read_json(self.budgets_file)
        budget.updated_at = datetime.now().isoformat()
        budget_dict = asdict(budget)
        
        existing = next((i for i, b in enumerate(budgets) if b["id"] == budget.id), None)
        if existing is not None:
            budgets[existing] = budget_dict
        else:
            budgets.append(budget_dict)
        
        self._write_json(self.budgets_file, budgets)
        return budget

    def get_budget(self, service_name: str, slo_name: str) -> Optional[SLOBudget]:
        budgets = self._read_json(self.budgets_file)
        for b in budgets:
            if b["service_name"] == service_name and b["slo_name"] == slo_name:
                return SLOBudget(**b)
        return None

    def get_budget_by_id(self, budget_id: str) -> Optional[SLOBudget]:
        budgets = self._read_json(self.budgets_file)
        for b in budgets:
            if b["id"] == budget_id:
                return SLOBudget(**b)
        return None

    def list_budgets(self, service_name: Optional[str] = None) -> List[SLOBudget]:
        budgets = self._read_json(self.budgets_file)
        if service_name:
            budgets = [b for b in budgets if b["service_name"] == service_name]
        return [SLOBudget(**b) for b in budgets]

    def save_batch(self, batch: ReleaseBatch) -> ReleaseBatch:
        batches = self._read_json(self.batches_file)
        batch.updated_at = datetime.now().isoformat()
        batch_dict = asdict(batch)
        batch_dict["status"] = batch.status.value
        batch_dict["decision_type"] = batch.decision_type.value
        
        existing = next((i for i, b in enumerate(batches) if b["id"] == batch.id), None)
        if existing is not None:
            batches[existing] = batch_dict
        else:
            batches.append(batch_dict)
        
        self._write_json(self.batches_file, batches)
        return batch

    def get_batch(self, batch_id: str) -> Optional[ReleaseBatch]:
        batches = self._read_json(self.batches_file)
        for b in batches:
            b["status"] = ReleaseStatus(b["status"])
            b["decision_type"] = DecisionType(b["decision_type"])
            if b["id"] == batch_id:
                return ReleaseBatch(**b)
        return None

    def list_batches(self, service_name: Optional[str] = None, status: Optional[ReleaseStatus] = None) -> List[ReleaseBatch]:
        batches = self._read_json(self.batches_file)
        results = []
        for b in batches:
            b["status"] = ReleaseStatus(b["status"])
            b["decision_type"] = DecisionType(b["decision_type"])
            if service_name and b["service_name"] != service_name:
                continue
            if status and b["status"] != status:
                continue
            results.append(ReleaseBatch(**b))
        return results

    def save_service_slo(self, service_slo: ServiceSLO) -> ServiceSLO:
        services = self._read_json(self.services_file)
        service_dict = asdict(service_slo)
        
        existing = next((i for i, s in enumerate(services) 
                        if s["service_name"] == service_slo.service_name 
                        and s["slo_name"] == service_slo.slo_name), None)
        if existing is not None:
            services[existing] = service_dict
        else:
            services.append(service_dict)
        
        self._write_json(self.services_file, services)
        return service_slo

    def list_service_slos(self, service_name: Optional[str] = None) -> List[ServiceSLO]:
        services = self._read_json(self.services_file)
        if service_name:
            services = [s for s in services if s["service_name"] == service_name and s["is_active"]]
        return [ServiceSLO(**s) for s in services]
