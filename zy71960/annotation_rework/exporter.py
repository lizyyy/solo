"""导出模块 - 确保导出一致性"""

import json
import csv
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from .models import (
    AnnotationSample, SampleStatus, ExportConfig, ExportResult
)
from .storage import AnnotationStore


class AnnotationExporter:
    """标注数据导出器"""
    
    def __init__(self, store: AnnotationStore):
        self.store = store
    
    def export_samples(self, version_id: str, output_path: str,
                       config: Optional[ExportConfig] = None) -> ExportResult:
        """导出版本样本"""
        config = config or ExportConfig()
        
        samples = self.store.get_all_samples(version_id)
        version = self.store.get_version(version_id)
        
        if config.only_confirmed:
            samples = [s for s in samples if s.status == SampleStatus.CONFIRMED]
        
        if not config.include_anomalies:
            samples = [s for s in samples if not s.anomalies]
        
        consistency_score = self._calculate_consistency_score(samples)
        
        export_data = []
        for sample in samples:
            sample_data = self._prepare_sample_export(sample, config)
            export_data.append(sample_data)
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        warnings = []
        
        if config.format == "json":
            self._export_json(export_data, output_path, version_id, config)
        elif config.format == "csv":
            self._export_csv(export_data, output_path)
        elif config.format == "jsonl":
            self._export_jsonl(export_data, output_path)
        else:
            warnings.append(f"不支持的格式 {config.format}，使用默认JSON格式")
            self._export_json(export_data, output_path, version_id, config)
        
        anomaly_count = sum(1 for s in samples if s.anomalies)
        
        if config.consistency_check and consistency_score < 0.8:
            warnings.append(
                f"导出数据一致性评分较低: {consistency_score:.2f}，建议复核后再使用"
            )
        
        total_samples = len(self.store.get_all_samples(version_id))
        
        return ExportResult(
            total_samples=total_samples,
            exported_samples=len(samples),
            anomalies_included=anomaly_count,
            consistency_score=consistency_score,
            file_path=str(output_path),
            warnings=warnings
        )
    
    def _prepare_sample_export(self, sample: AnnotationSample,
                               config: ExportConfig) -> Dict[str, Any]:
        """准备单条样本的导出数据"""
        data = {
            "sample_id": sample.sample_id,
            "content": sample.content,
            "labels": sample.labels,
            "status": sample.status.value,
        }
        
        if sample.meta.split:
            data["split"] = sample.meta.split
        if sample.meta.metrics:
            data["metrics"] = sample.meta.metrics
        
        if config.include_anomalies and sample.anomalies:
            data["anomalies"] = [a.value for a in sample.anomalies]
            data["anomaly_details"] = sample.anomaly_details
        
        if config.include_history:
            history = self.store.get_sample_history(sample.sample_id)
            if history:
                data["review_history"] = [
                    {
                        "reviewer": log.reviewer,
                        "old_status": log.old_status.value,
                        "new_status": log.new_status.value,
                        "comment": log.comment,
                        "created_at": log.created_at.isoformat()
                    }
                    for _, log in history
                ]
        
        return data
    
    def _export_json(self, data: List[Dict], output_path: Path,
                     version_id: str, config: ExportConfig) -> None:
        """导出为JSON"""
        export_package = {
            "export_info": {
                "version_id": version_id,
                "exported_at": datetime.now().isoformat(),
                "config": config.model_dump(),
                "data_hash": self._calculate_data_hash(data)
            },
            "samples": data
        }
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(export_package, f, ensure_ascii=False, indent=2)
    
    def _export_csv(self, data: List[Dict], output_path: Path) -> None:
        """导出为CSV"""
        if not data:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write("")
            return
        
        flat_data = []
        for item in data:
            flat_item = {
                "sample_id": item["sample_id"],
                "labels": ",".join(item.get("labels", [])),
                "status": item.get("status", "")
            }
            
            content = item.get("content", {})
            for key, value in content.items():
                if isinstance(value, (str, int, float, bool)):
                    flat_item[f"content_{key}"] = value
                else:
                    flat_item[f"content_{key}"] = json.dumps(value, ensure_ascii=False)
            
            flat_data.append(flat_item)
        
        fieldnames = list(flat_data[0].keys()) if flat_data else []
        
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(flat_data)
    
    def _export_jsonl(self, data: List[Dict], output_path: Path) -> None:
        """导出为JSONL"""
        with open(output_path, "w", encoding="utf-8") as f:
            for item in data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
    
    def _calculate_consistency_score(self, samples: List[AnnotationSample]) -> float:
        """计算数据一致性评分"""
        if not samples:
            return 1.0
        
        score = 1.0
        penalty = 0
        
        anomaly_count = sum(1 for s in samples if s.anomalies)
        if anomaly_count > 0:
            penalty += (anomaly_count / len(samples)) * 0.3
        
        unconfirmed = sum(
            1 for s in samples
            if s.status not in [SampleStatus.CONFIRMED, SampleStatus.ANNOTATED]
        )
        if unconfirmed > 0:
            penalty += (unconfirmed / len(samples)) * 0.4
        
        samples_with_labels = [s for s in samples if s.labels]
        if samples_with_labels:
            label_counts = {}
            for s in samples_with_labels:
                for label in s.labels:
                    label_counts[label] = label_counts.get(label, 0) + 1
            if label_counts:
                max_count = max(label_counts.values())
                imbalance_ratio = max_count / sum(label_counts.values())
                if imbalance_ratio > 0.9:
                    penalty += 0.2
        
        return max(0.0, score - penalty)
    
    def _calculate_data_hash(self, data: List[Dict]) -> str:
        """计算数据哈希用于验证导出一致性"""
        sorted_samples = sorted(data, key=lambda x: x.get("sample_id", ""))
        content_str = json.dumps(sorted_samples, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(content_str.encode("utf-8")).hexdigest()
    
    def verify_export_consistency(self, export_path: str) -> Dict[str, Any]:
        """验证导出文件的一致性"""
        with open(export_path, "r", encoding="utf-8") as f:
            export_data = json.load(f)
        
        if "export_info" not in export_data or "samples" not in export_data:
            return {"valid": False, "error": "无效的导出文件格式"}
        
        export_info = export_data["export_info"]
        samples = export_data["samples"]
        
        current_hash = self._calculate_data_hash(samples)
        hash_valid = current_hash == export_info.get("data_hash")
        
        return {
            "valid": hash_valid,
            "version_id": export_info.get("version_id"),
            "exported_at": export_info.get("exported_at"),
            "sample_count": len(samples),
            "hash_match": hash_valid,
            "expected_hash": export_info.get("data_hash"),
            "actual_hash": current_hash
        }
