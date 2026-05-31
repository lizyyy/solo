import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from models import (
    FaultRecord, OrbitElements, VerificationRecord, VerificationItem, TaskBriefing,
    MaterialBatch, EvidenceLink, VersionEntry
)


class PersistentStorage:
    def __init__(self, base_dir: str = "data"):
        self.base_dir = base_dir
        self._ensure_directories()

    def _ensure_directories(self):
        for subdir in ["faults", "orbits", "verifications", "briefings", "batches", "evidence"]:
            os.makedirs(os.path.join(self.base_dir, subdir), exist_ok=True)

    def _save_json(self, path: str, data: Dict[str, Any]) -> None:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_json(self, path: str) -> Optional[Dict[str, Any]]:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None

    def save_fault(self, fault: FaultRecord) -> None:
        path = os.path.join(self.base_dir, "faults", f"{fault.fault_id}.json")
        self._save_json(path, fault.to_dict())

    def load_fault(self, fault_id: str) -> Optional[FaultRecord]:
        path = os.path.join(self.base_dir, "faults", f"{fault_id}.json")
        data = self._load_json(path)
        if not data:
            return None
        return self._dict_to_fault(data)

    def _dict_to_fault(self, data: Dict[str, Any]) -> FaultRecord:
        from models import FaultSeverity
        versions = [
            VersionEntry(
                version=v["version"],
                modified_by=v["modified_by"],
                modified_at=datetime.fromisoformat(v["modified_at"]),
                change_summary=v["change_summary"],
                diff=v["diff"]
            ) for v in data.get("versions", [])
        ]
        return FaultRecord(
            fault_id=data["fault_id"],
            fault_type=data["fault_type"],
            description=data["description"],
            severity=FaultSeverity(data["severity"]),
            telemetry_segment_id=data["telemetry_segment_id"],
            orbit_id=data.get("orbit_id"),
            antenna_pointing_error=data.get("antenna_pointing_error"),
            detected_at=data["detected_at"],
            reported_by=data["reported_by"],
            confirmed=data.get("confirmed", False),
            confirmed_by=data.get("confirmed_by"),
            confirmed_at=datetime.fromisoformat(data["confirmed_at"]) if data.get("confirmed_at") else None,
            versions=versions,
            current_version=data.get("current_version", 1),
            created_at=datetime.fromisoformat(data["created_at"])
        )

    def save_orbit(self, orbit: OrbitElements) -> None:
        path = os.path.join(self.base_dir, "orbits", f"{orbit.orbit_id}.json")
        self._save_json(path, orbit.to_dict())

    def load_orbit(self, orbit_id: str) -> Optional[OrbitElements]:
        path = os.path.join(self.base_dir, "orbits", f"{orbit_id}.json")
        data = self._load_json(path)
        if not data:
            return None
        return OrbitElements(
            orbit_id=data["orbit_id"],
            semi_major_axis=data["semi_major_axis"],
            eccentricity=data["eccentricity"],
            inclination=data["inclination"],
            raan=data["raan"],
            argument_of_perigee=data["argument_of_perigee"],
            true_anomaly=data["true_anomaly"],
            epoch=data["epoch"],
            source=data["source"],
            created_at=datetime.fromisoformat(data["created_at"])
        )

    def save_verification(self, verification: VerificationRecord) -> None:
        path = os.path.join(self.base_dir, "verifications", f"{verification.verification_id}.json")
        self._save_json(path, verification.to_dict())

    def load_verification(self, verification_id: str) -> Optional[VerificationRecord]:
        from models import VerificationStatus
        path = os.path.join(self.base_dir, "verifications", f"{verification_id}.json")
        data = self._load_json(path)
        if not data:
            return None

        items = []
        for item_data in data["items"]:
            evidence = [
                EvidenceLink(**e) for e in item_data.get("evidence", [])
            ]
            items.append(VerificationItem(
                fault_id=item_data["fault_id"],
                orbit_id=item_data.get("orbit_id"),
                status=VerificationStatus(item_data["status"]),
                error_details=item_data.get("error_details"),
                pointing_accuracy=item_data.get("pointing_accuracy"),
                expected_accuracy=item_data["expected_accuracy"],
                evidence=evidence
            ))

        return VerificationRecord(
            verification_id=data["verification_id"],
            material_batch_id=data["material_batch_id"],
            material_content_hash=data["material_content_hash"],
            status=VerificationStatus(data["status"]),
            items=items,
            started_at=datetime.fromisoformat(data["started_at"]),
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
            summary=data["summary"],
            is_re_run=data.get("is_re_run", False),
            previous_verification_id=data.get("previous_verification_id")
        )

    def find_verification_by_hash(self, content_hash: str) -> Optional[VerificationRecord]:
        verifications_dir = os.path.join(self.base_dir, "verifications")
        for filename in os.listdir(verifications_dir):
            if filename.endswith(".json"):
                data = self._load_json(os.path.join(verifications_dir, filename))
                if data and data.get("material_content_hash") == content_hash:
                    return self.load_verification(data["verification_id"])
        return None

    def save_briefing(self, briefing: TaskBriefing) -> None:
        path = os.path.join(self.base_dir, "briefings", f"{briefing.briefing_id}.json")
        self._save_json(path, briefing.to_dict())

    def load_briefing(self, briefing_id: str) -> Optional[TaskBriefing]:
        from models import VerificationStatus
        path = os.path.join(self.base_dir, "briefings", f"{briefing_id}.json")
        data = self._load_json(path)
        if not data:
            return None
        return TaskBriefing(
            briefing_id=data["briefing_id"],
            verification_id=data["verification_id"],
            material_batch_id=data["material_batch_id"],
            generated_at=datetime.fromisoformat(data["generated_at"]),
            generated_by=data["generated_by"],
            overall_status=VerificationStatus(data["overall_status"]),
            total_faults=data["total_faults"],
            passed_count=data["passed_count"],
            failed_count=data["failed_count"],
            pending_count=data["pending_count"],
            critical_issues=data["critical_issues"],
            warnings=data["warnings"],
            evidence_summary=data["evidence_summary"],
            recommendations=data["recommendations"],
            raw_data_path=data.get("raw_data_path")
        )

    def save_batch(self, batch: MaterialBatch) -> None:
        path = os.path.join(self.base_dir, "batches", f"{batch.batch_id}.json")
        self._save_json(path, batch.to_dict())

    def load_batch(self, batch_id: str) -> Optional[MaterialBatch]:
        path = os.path.join(self.base_dir, "batches", f"{batch_id}.json")
        data = self._load_json(path)
        if not data:
            return None

        faults = [self._dict_to_fault(f) for f in data["faults"]]
        orbits = [
            OrbitElements(
                orbit_id=o["orbit_id"],
                semi_major_axis=o["semi_major_axis"],
                eccentricity=o["eccentricity"],
                inclination=o["inclination"],
                raan=o["raan"],
                argument_of_perigee=o["argument_of_perigee"],
                true_anomaly=o["true_anomaly"],
                epoch=o["epoch"],
                source=o["source"],
                created_at=datetime.fromisoformat(o["created_at"])
            ) for o in data["orbits"]
        ]
        return MaterialBatch(
            batch_id=data["batch_id"],
            faults=faults,
            orbits=orbits,
            received_at=datetime.fromisoformat(data["received_at"])
        )

    def list_faults(self) -> List[str]:
        faults_dir = os.path.join(self.base_dir, "faults")
        return [f.replace(".json", "") for f in os.listdir(faults_dir) if f.endswith(".json")]

    def list_verifications(self) -> List[str]:
        verifications_dir = os.path.join(self.base_dir, "verifications")
        return [v.replace(".json", "") for v in os.listdir(verifications_dir) if v.endswith(".json")]

    def get_fault_version_history(self, fault_id: str) -> List[Dict[str, Any]]:
        fault = self.load_fault(fault_id)
        if not fault:
            return []
        return [v.to_dict() for v in fault.versions]

    def save_evidence_link(self, evidence: EvidenceLink, verification_id: str) -> None:
        evidence_dir = os.path.join(self.base_dir, "evidence", verification_id)
        os.makedirs(evidence_dir, exist_ok=True)
        filename = f"{evidence.from_type}_{evidence.from_id}_{evidence.to_type}_{evidence.to_id}.json"
        path = os.path.join(evidence_dir, filename)
        self._save_json(path, evidence.to_dict())
