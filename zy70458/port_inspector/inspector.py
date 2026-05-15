import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Tuple
import pandas as pd
from .models import InspectionSample, InspectionResult, BatchInfo, RiskLevel
from .rule_manager import RuleManager
from .storage import DataStorage


class PortInspector:
    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path.home() / ".port_inspector" / "data"
        self.data_dir = data_dir
        self.rule_manager = RuleManager(data_dir)
        self.storage = DataStorage(data_dir)

    def _generate_batch_id(self) -> str:
        return f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    def _generate_sample_id(self) -> str:
        return f"sample_{uuid.uuid4().hex[:12]}"

    def load_samples_from_excel(self, file_path: Path) -> List[InspectionSample]:
        df = pd.read_excel(file_path)
        samples = []
        batch_id = self._generate_batch_id()
        inspection_time = datetime.now()

        for idx, row in df.iterrows():
            supplier_original = str(row.get('供应商', row.get('supplier', '')))
            supplier_corrected = self._correct_supplier(supplier_original)

            sample = InspectionSample(
                sample_id=self._generate_sample_id(),
                batch_id=batch_id,
                source_file=file_path.name,
                row_number=idx + 2,
                ip_address=str(row.get('IP地址', row.get('ip_address', ''))),
                port=int(row.get('端口', row.get('port', 0))),
                protocol=str(row.get('协议', row.get('protocol', 'TCP'))),
                process_name=str(row.get('进程名', row.get('process_name', ''))),
                connection_count=int(row.get('连接数', row.get('connection_count', 0))),
                supplier=supplier_corrected or supplier_original,
                supplier_original=supplier_original,
                supplier_corrected=supplier_corrected,
                department=str(row.get('部门', row.get('department', ''))),
                business_line=str(row.get('业务线', row.get('business_line', ''))),
                inspection_time=inspection_time,
                raw_data=row.to_dict()
            )
            samples.append(sample)
        return samples

    def _correct_supplier(self, supplier: str) -> Optional[str]:
        corrections = {
            "阿里": "阿里巴巴",
            "阿里云计算": "阿里巴巴",
            "腾讯": "腾讯科技",
            "腾讯云": "腾讯科技",
            "百度": "百度在线",
            "百度云": "百度在线",
        }
        return corrections.get(supplier)

    def inspect_sample(self, sample: InspectionSample, rule_version: Optional[str] = None) -> InspectionResult:
        if rule_version is None:
            rule = self.rule_manager.get_latest_rule()
            rule_version = rule.version
        else:
            rule = self.rule_manager.get_rule(rule_version)

        port_risk = self.rule_manager.get_port_risk_level(sample.port, rule_version)
        high_connections = self.rule_manager.is_high_connections(sample.connection_count, rule_version)

        final_risk = port_risk
        if high_connections and port_risk != RiskLevel.CRITICAL:
            final_risk = RiskLevel.HIGH

        is_anomaly = final_risk in [RiskLevel.CRITICAL, RiskLevel.HIGH]

        conclusion_parts = []
        if sample.port in rule.reserved_ports:
            conclusion_parts.append(f"端口{sample.port}为保留端口")
        if high_connections:
            conclusion_parts.append(f"连接数{sample.connection_count}超过阈值{rule.threshold_connections}")
        conclusion_parts.append(f"端口风险等级: {final_risk.value}")

        conclusion = "，".join(conclusion_parts)

        if sample.port < 1024:
            port_status = "系统端口"
        elif sample.port < 49152:
            port_status = "注册端口"
        else:
            port_status = "动态端口"

        return InspectionResult(
            sample_id=sample.sample_id,
            batch_id=sample.batch_id,
            rule_version=rule_version,
            risk_level=final_risk,
            is_anomaly=is_anomaly,
            conclusion=conclusion,
            port_status=port_status,
            details={
                "port_risk": port_risk.value,
                "high_connections": high_connections,
                "port_in_reserved": sample.port in rule.reserved_ports,
                "rule_description": rule.description,
            }
        )

    def check_duplicate_sample(self, sample: InspectionSample) -> Tuple[bool, Optional[InspectionResult], Optional[str]]:
        existing = self.storage.find_existing_sample(
            sample.ip_address,
            sample.port,
            sample.supplier
        )
        if existing is None:
            return False, None, None

        existing_result = self.storage.get_result(existing.sample_id)
        if existing_result is None:
            return False, None, None

        current_result = self.inspect_sample(sample)

        if existing_result.risk_level == current_result.risk_level:
            return True, existing_result, "reused"
        else:
            return True, existing_result, "conflict"

    def process_batch(self, samples: List[InspectionSample], force_rule_version: Optional[str] = None) -> BatchInfo:
        if not samples:
            raise ValueError("样本列表为空")

        batch_id = samples[0].batch_id
        rule_version = force_rule_version or self.rule_manager.get_latest_rule().version

        anomaly_count = 0
        conflict_samples = []
        reused_samples = []

        for sample in samples:
            is_dup, old_result, status = self.check_duplicate_sample(sample)
            if is_dup and status == "reused":
                reused_samples.append(sample.sample_id)
                continue
            elif is_dup and status == "conflict":
                conflict_samples.append({
                    "sample_id": sample.sample_id,
                    "old_risk": old_result.risk_level.value if old_result else None,
                    "old_rule": old_result.rule_version if old_result else None,
                })

            result = self.inspect_sample(sample, rule_version)
            if result.is_anomaly:
                anomaly_count += 1

            self.storage.save_sample(sample)
            self.storage.save_result(result)

        batch = BatchInfo(
            batch_id=batch_id,
            submit_time=datetime.now(),
            rule_version_at_submit=rule_version,
            total_samples=len(samples),
            anomaly_count=anomaly_count,
            status="completed",
            source_files=list({s.source_file for s in samples}),
            notes=f"复用样本: {len(reused_samples)}, 冲突样本: {len(conflict_samples)}"
        )
        self.storage.save_batch(batch)
        return batch

    def get_batch_report(self, batch_id: str) -> Dict:
        batch = self.storage.get_batch(batch_id)
        if batch is None:
            raise ValueError(f"批次 {batch_id} 不存在")

        results = self.storage.get_results_by_batch(batch_id)
        samples = [self.storage.get_sample(r.sample_id) for r in results]

        risk_distribution = {}
        for result in results:
            risk = result.risk_level.value
            risk_distribution[risk] = risk_distribution.get(risk, 0) + 1

        return {
            "batch": batch.model_dump(),
            "total_samples": batch.total_samples,
            "anomaly_count": batch.anomaly_count,
            "risk_distribution": risk_distribution,
            "rule_version": batch.rule_version_at_submit,
            "results": [
                {
                    "result": r.model_dump(),
                    "sample": s.model_dump() if s else None
                }
                for r, s in zip(results, samples)
            ]
        }
