import os
import json
from datetime import datetime
from typing import Dict, Optional
from .models import Parameter, ParameterVersion, generate_id


class ParameterManager:
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        self.versions_file = os.path.join(storage_dir, "parameter_versions.json")
        self._ensure_storage()

    def _ensure_storage(self):
        os.makedirs(self.storage_dir, exist_ok=True)
        if not os.path.exists(self.versions_file):
            self._save_versions([])

    def _load_versions(self) -> list:
        if os.path.exists(self.versions_file):
            with open(self.versions_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def _save_versions(self, versions: list):
        with open(self.versions_file, "w", encoding="utf-8") as f:
            json.dump(versions, f, ensure_ascii=False, indent=2)

    def _dict_to_parameter_version(self, data: dict) -> ParameterVersion:
        parameters = {}
        for name, param_data in data["parameters"].items():
            parameters[name] = Parameter(**param_data)
        return ParameterVersion(
            version_id=data["version_id"],
            parameters=parameters,
            created_at=data["created_at"],
            created_by=data["created_by"],
            note=data.get("note", ""),
            is_active=data.get("is_active", True),
        )

    def get_default_parameters(self) -> Dict[str, Parameter]:
        return {
            "rate_sensitivity": Parameter(
                name="rate_sensitivity",
                value=0.35,
                weight=0.30,
                description="利率变动对提前还款的影响系数",
                source="default",
            ),
            "term_sensitivity": Parameter(
                name="term_sensitivity",
                value=0.25,
                weight=0.20,
                description="剩余期限对提前还款的影响系数",
                source="default",
            ),
            "fico_sensitivity": Parameter(
                name="fico_sensitivity",
                value=0.20,
                weight=0.15,
                description="FICO评分对提前还款的影响系数",
                source="default",
            ),
            "dti_sensitivity": Parameter(
                name="dti_sensitivity",
                value=0.15,
                weight=0.15,
                description="DTI比率对提前还款的影响系数",
                source="default",
            ),
            "ltv_sensitivity": Parameter(
                name="ltv_sensitivity",
                value=0.10,
                weight=0.10,
                description="LTV比率对提前还款的影响系数",
                source="default",
            ),
            "history_sensitivity": Parameter(
                name="history_sensitivity",
                value=0.30,
                weight=0.10,
                description="提前还款历史的影响系数",
                source="default",
            ),
            "age_sensitivity": Parameter(
                name="age_sensitivity",
                value=0.15,
                weight=0.10,
                description="借款人年龄对提前还款的影响系数",
                source="default",
            ),
            "high_risk_threshold": Parameter(
                name="high_risk_threshold",
                value=0.70,
                weight=0.0,
                description="高风险判定阈值",
                source="default",
            ),
            "medium_risk_threshold": Parameter(
                name="medium_risk_threshold",
                value=0.40,
                weight=0.0,
                description="中风险判定阈值",
                source="default",
            ),
        }

    def get_latest_version(self) -> Optional[ParameterVersion]:
        versions = self._load_versions()
        if not versions:
            return None
        active_versions = [v for v in versions if v.get("is_active", True)]
        if not active_versions:
            return None
        latest = sorted(active_versions, key=lambda v: v["created_at"], reverse=True)[0]
        return self._dict_to_parameter_version(latest)

    def get_version(self, version_id: str) -> Optional[ParameterVersion]:
        versions = self._load_versions()
        for v in versions:
            if v["version_id"] == version_id:
                return self._dict_to_parameter_version(v)
        return None

    def list_all_versions(self) -> list:
        versions = self._load_versions()
        return [self._dict_to_parameter_version(v) for v in versions]

    def create_initial_version(self) -> ParameterVersion:
        existing = self._load_versions()
        if existing:
            raise ValueError("初始版本已存在，请使用 update_parameters 进行修改")

        params = self.get_default_parameters()
        version = ParameterVersion(
            version_id=generate_id("PARAM"),
            parameters=params,
            created_at=datetime.now().isoformat(),
            created_by="system",
            note="初始默认参数版本",
            is_active=True,
        )
        versions = self._load_versions()
        versions.append(version.to_dict())
        self._save_versions(versions)
        return version

    def update_parameters(
        self,
        updates: Dict[str, Dict[str, float]],
        modified_by: str,
        note: str = "",
    ) -> ParameterVersion:
        latest = self.get_latest_version()
        if latest is None:
            latest = self.create_initial_version()

        new_params = {}
        for name, param in latest.parameters.items():
            if name in updates:
                update = updates[name]
                new_params[name] = Parameter(
                    name=name,
                    value=update.get("value", param.value),
                    weight=update.get("weight", param.weight),
                    description=param.description,
                    source="manual",
                    last_modified=datetime.now().isoformat(),
                    modified_by=modified_by,
                )
            else:
                new_params[name] = Parameter(
                    name=name,
                    value=param.value,
                    weight=param.weight,
                    description=param.description,
                    source=param.source,
                    last_modified=param.last_modified,
                    modified_by=param.modified_by,
                )

        version = ParameterVersion(
            version_id=generate_id("PARAM"),
            parameters=new_params,
            created_at=datetime.now().isoformat(),
            created_by=modified_by,
            note=note,
            is_active=True,
        )

        versions = self._load_versions()
        for v in versions:
            if v["version_id"] == latest.version_id:
                v["is_active"] = False
        versions.append(version.to_dict())
        self._save_versions(versions)

        return version

    def get_parameters_for_calculation(self) -> Dict[str, float]:
        latest = self.get_latest_version()
        if latest is None:
            latest = self.create_initial_version()

        result = {}
        for name, param in latest.parameters.items():
            result[f"{name}_value"] = param.value
            result[f"{name}_weight"] = param.weight
        return result

    def get_active_version_id(self) -> str:
        latest = self.get_latest_version()
        if latest is None:
            latest = self.create_initial_version()
        return latest.version_id

    def rollback_to_version(self, version_id: str, modified_by: str) -> ParameterVersion:
        target = self.get_version(version_id)
        if target is None:
            raise ValueError(f"版本 {version_id} 不存在")

        param_updates = {}
        for name, param in target.parameters.items():
            param_updates[name] = {"value": param.value, "weight": param.weight}

        return self.update_parameters(
            param_updates,
            modified_by=modified_by,
            note=f"回滚到版本 {version_id}",
        )

    def compare_versions(self, version_id1: str, version_id2: str) -> Dict:
        v1 = self.get_version(version_id1)
        v2 = self.get_version(version_id2)
        if v1 is None or v2 is None:
            raise ValueError("指定的版本不存在")

        differences = {}
        all_names = set(v1.parameters.keys()) | set(v2.parameters.keys())
        for name in all_names:
            p1 = v1.parameters.get(name)
            p2 = v2.parameters.get(name)
            if p1 is None or p2 is None:
                differences[name] = {"status": "parameter_added_or_removed"}
            elif p1.value != p2.value or p1.weight != p2.weight:
                differences[name] = {
                    "old_value": p1.value,
                    "new_value": p2.value,
                    "old_weight": p1.weight,
                    "new_weight": p2.weight,
                    "modified_by": p2.modified_by,
                    "modified_at": p2.last_modified,
                }
        return differences
