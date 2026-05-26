import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from ..models.models import (
    Artifact,
    ArtifactGrade,
    InsurancePolicy,
    TransportNode,
    TransportRecord,
)


class DataImporter:
    def __init__(self):
        self.artifacts: Dict[str, Artifact] = {}
        self.transports: Dict[str, TransportRecord] = {}
        self.insurance_policies: Dict[str, InsurancePolicy] = {}
        self.import_batch = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._raw_csv_rows: List[dict] = []
        self._raw_transport: dict = {}
        self._raw_insurance: dict = {}

    def _parse_grade(self, grade_str: str) -> ArtifactGrade:
        grade_map = {
            "一级文物": ArtifactGrade.FIRST_CLASS,
            "二级文物": ArtifactGrade.SECOND_CLASS,
            "三级文物": ArtifactGrade.THIRD_CLASS,
            "一般文物": ArtifactGrade.GENERAL,
            "一级": ArtifactGrade.FIRST_CLASS,
            "二级": ArtifactGrade.SECOND_CLASS,
            "三级": ArtifactGrade.THIRD_CLASS,
            "一般": ArtifactGrade.GENERAL,
        }
        return grade_map.get(grade_str.strip(), ArtifactGrade.GENERAL)

    def import_artifacts_csv(self, file_path: str) -> List[Artifact]:
        artifacts = []
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文物清单文件不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                self._raw_csv_rows.append(dict(row))
                artifact_id = (
                    row.get("文物编号", "").strip()
                    or row.get("artifact_id", "").strip()
                    or row.get("ID", "").strip()
                )
                if not artifact_id:
                    continue

                previous_valuation = row.get("原估值", "").strip()
                artifact = Artifact(
                    artifact_id=artifact_id,
                    name=(
                        row.get("文物名称", "").strip()
                        or row.get("name", "").strip()
                    ),
                    grade=self._parse_grade(
                        row.get("文物等级", "").strip()
                        or row.get("grade", "").strip()
                    ),
                    category=(
                        row.get("文物类别", "").strip()
                        or row.get("category", "").strip()
                    ),
                    origin_museum=(
                        row.get("来源博物馆", "").strip()
                        or row.get("origin_museum", "").strip()
                    ),
                    current_valuation=float(
                        row.get("当前估值", "0").strip()
                        or row.get("valuation", "0").strip()
                    ),
                    previous_valuation=(
                        float(previous_valuation)
                        if previous_valuation
                        else None
                    ),
                    condition=(
                        row.get("保存状况", "").strip()
                        or row.get("condition", "完好").strip()
                    ),
                    last_condition_check=(
                        row.get("上次核查日期", "").strip()
                        or row.get("last_check", "").strip()
                    ),
                    remarks=(
                        row.get("备注", "").strip()
                        or row.get("remarks", "").strip()
                    ),
                    import_batch=self.import_batch,
                )
                self.artifacts[artifact_id] = artifact
                artifacts.append(artifact)

        return artifacts

    def import_transport_json(self, file_path: str) -> List[TransportRecord]:
        transports = []
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"运输记录文件不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._raw_transport = data
        transport_list = data.get("transports", data) if isinstance(data, dict) else data
        if isinstance(transport_list, dict):
            transport_list = [transport_list]

        for item in transport_list:
            transport_id = item.get("transport_id", "").strip()
            artifact_id = item.get("artifact_id", "").strip()
            if not transport_id or not artifact_id:
                continue

            nodes = []
            for node_data in item.get("nodes", []):
                node = TransportNode(
                    node_name=node_data.get("node_name", "").strip(),
                    planned_arrival=node_data.get("planned_arrival", "").strip(),
                    actual_arrival=node_data.get("actual_arrival", "").strip() or None,
                    temperature=(
                        float(node_data.get("temperature", 0))
                        if node_data.get("temperature")
                        else None
                    ),
                    humidity=(
                        float(node_data.get("humidity", 0))
                        if node_data.get("humidity")
                        else None
                    ),
                    status=node_data.get("status", "正常").strip(),
                    notes=node_data.get("notes", "").strip(),
                )
                nodes.append(node)

            transport = TransportRecord(
                transport_id=transport_id,
                artifact_id=artifact_id,
                start_location=item.get("start_location", "").strip(),
                end_location=item.get("end_location", "").strip(),
                planned_start_date=item.get("planned_start_date", "").strip(),
                planned_end_date=item.get("planned_end_date", "").strip(),
                actual_start_date=item.get("actual_start_date", "").strip() or None,
                actual_end_date=item.get("actual_end_date", "").strip() or None,
                transport_method=item.get("transport_method", "").strip(),
                carrier=item.get("carrier", "").strip(),
                nodes=nodes,
                overall_status=item.get("overall_status", "正常").strip(),
                import_batch=self.import_batch,
            )
            self.transports[transport_id] = transport
            transports.append(transport)

        return transports

    def import_insurance_json(self, file_path: str) -> List[InsurancePolicy]:
        policies = []
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"保险单文件不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._raw_insurance = data
        policy_list = data.get("policies", data) if isinstance(data, dict) else data
        if isinstance(policy_list, dict):
            policy_list = [policy_list]

        for item in policy_list:
            policy_id = item.get("policy_id", "").strip()
            artifact_id = item.get("artifact_id", "").strip()
            if not policy_id or not artifact_id:
                continue

            policy = InsurancePolicy(
                policy_id=policy_id,
                artifact_id=artifact_id,
                insurer=item.get("insurer", "").strip(),
                insured_amount=float(item.get("insured_amount", 0)),
                coverage_start=item.get("coverage_start", "").strip(),
                coverage_end=item.get("coverage_end", "").strip(),
                policy_type=item.get("policy_type", "一切险").strip(),
                premium=(
                    float(item.get("premium", 0))
                    if item.get("premium")
                    else None
                ),
                exclusions=item.get("exclusions", "").strip(),
                special_clauses=item.get("special_clauses", "").strip(),
                import_batch=self.import_batch,
            )
            self.insurance_policies[policy_id] = policy
            policies.append(policy)

        return policies

    def import_all(
        self,
        csv_path: str,
        transport_json_path: str,
        insurance_json_path: str,
    ) -> Tuple[List[Artifact], List[TransportRecord], List[InsurancePolicy]]:
        artifacts = self.import_artifacts_csv(csv_path)
        transports = self.import_transport_json(transport_json_path)
        policies = self.import_insurance_json(insurance_json_path)
        return artifacts, transports, policies

    def get_import_summary(self) -> dict:
        return {
            "import_batch": self.import_batch,
            "artifact_count": len(self.artifacts),
            "transport_count": len(self.transports),
            "insurance_policy_count": len(self.insurance_policies),
            "artifact_ids": list(self.artifacts.keys()),
            "transport_artifact_ids": list(
                set(t.artifact_id for t in self.transports.values())
            ),
            "insurance_artifact_ids": list(
                set(p.artifact_id for p in self.insurance_policies.values())
            ),
        }