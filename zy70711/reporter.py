import json
from typing import Dict, List, Any
from datetime import datetime
from pathlib import Path

from models import NotebookRecord


class ReportGenerator:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_machine_readable(self, records: List[NotebookRecord]) -> Dict[str, Any]:
        data = {
            "generated_at": datetime.now().isoformat(),
            "total_records": len(records),
            "records": []
        }
        
        for record in records:
            record_data = record.to_dict()
            record_data["verification"] = {
                "params_signature_valid": record.parameters.verify_signature(),
                "env_hash_valid": self._verify_env_hash(record),
                "review_status": record.review_status
            }
            data["records"].append(record_data)
        
        return data

    def _verify_env_hash(self, record: NotebookRecord) -> bool:
        return record.environment.verify_hash()

    def generate_human_readable(self, records: List[NotebookRecord]) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("NOTEBOOK 参数制品排查报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"记录总数: {len(records)}")
        lines.append("=" * 80)
        lines.append("")
        
        for idx, record in enumerate(records, 1):
            lines.extend(self._generate_record_section(idx, record))
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("统计摘要")
        lines.append("=" * 80)
        
        stats = self._generate_stats(records)
        lines.append(f"  复核通过: {stats['approved']}")
        lines.append(f"  待复核: {stats['pending']}")
        lines.append(f"  被拒绝: {stats['rejected']}")
        lines.append(f"  参数签名有效: {stats['valid_params']}")
        lines.append(f"  环境哈希有效: {stats['valid_env']}")
        lines.append(f"  制品总数: {stats['total_artifacts']}")
        
        return "\n".join(lines)

    def _generate_record_section(self, idx: int, record: NotebookRecord) -> List[str]:
        lines = []
        lines.append(f"【记录 #{idx}】")
        lines.append(f"  Notebook ID: {record.notebook_id}")
        lines.append(f"  名称: {record.name}")
        lines.append(f"  路径: {record.path}")
        lines.append(f"  创建时间: {record.created_at}")
        lines.append("")
        
        lines.append("  ┌─ 参数集 ────────────────────────────────────────")
        lines.append(f"  │ 参数ID: {record.parameters.param_id}")
        lines.append(f"  │ 参数签名: {record.parameters.signature}")
        lines.append(f"  │ 签名验证: {'✓ 有效' if record.parameters.verify_signature() else '✗ 无效'}")
        lines.append("  │ 参数值:")
        for key, value in record.parameters.values.items():
            lines.append(f"  │   {key}: {value}")
        lines.append("  └─────────────────────────────────────────────────")
        lines.append("")
        
        lines.append("  ┌─ 运行环境 ──────────────────────────────────────")
        lines.append(f"  │ Python版本: {record.environment.python_version}")
        lines.append(f"  │ 操作系统: {record.environment.os}")
        lines.append(f"  │ CPU: {record.environment.cpu_info}")
        lines.append(f"  │ 内存: {record.environment.memory_total / (1024**3):.2f} GB")
        lines.append(f"  │ 环境哈希: {record.environment.env_hash}")
        env_valid = self._verify_env_hash(record)
        lines.append(f"  │ 哈希验证: {'✓ 有效' if env_valid else '✗ 无效'}")
        lines.append("  │ 依赖库:")
        for lib, ver in list(record.environment.libraries.items())[:5]:
            lines.append(f"  │   {lib}: {ver}")
        if len(record.environment.libraries) > 5:
            lines.append(f"  │   ... 等 {len(record.environment.libraries)} 个库")
        lines.append("  └─────────────────────────────────────────────────")
        lines.append("")
        
        lines.append("  ┌─ 输出制品 ──────────────────────────────────────")
        lines.append(f"  │ 制品数量: {len(record.artifacts)}")
        for artifact in record.artifacts:
            lines.append(f"  │  • {artifact.name} (v{artifact.version})")
            lines.append(f"  │    类型: {artifact.type}")
            lines.append(f"  │    大小: {artifact.size} bytes")
            lines.append(f"  │    校验和: {artifact.checksum}")
        lines.append("  └─────────────────────────────────────────────────")
        lines.append("")
        
        lines.append("  ┌─ 复核信息 ──────────────────────────────────────")
        lines.append(f"  │ 状态: {self._format_review_status(record.review_status)}")
        if record.reviews:
            lines.append(f"  │ 复核记录 ({len(record.reviews)}):")
            for review in record.reviews:
                lines.append(f"  │  • {review.reviewer} @ {review.reviewed_at[:19]}")
                lines.append(f"  │    结果: {review.status}")
                lines.append(f"  │    意见: {review.comment}")
        lines.append("  └─────────────────────────────────────────────────")
        lines.append("")
        lines.append("─" * 80)
        lines.append("")
        
        return lines

    def _format_review_status(self, status: str) -> str:
        status_map = {
            "approved": "✓ 已通过",
            "rejected": "✗ 已拒绝",
            "pending": "○ 待复核"
        }
        return status_map.get(status, status)

    def _generate_stats(self, records: List[NotebookRecord]) -> Dict[str, int]:
        stats = {
            "approved": 0,
            "pending": 0,
            "rejected": 0,
            "valid_params": 0,
            "valid_env": 0,
            "total_artifacts": 0
        }
        
        for record in records:
            stats[record.review_status] += 1
            if record.parameters.verify_signature():
                stats["valid_params"] += 1
            if self._verify_env_hash(record):
                stats["valid_env"] += 1
            stats["total_artifacts"] += len(record.artifacts)
        
        return stats

    def save_reports(self, records: List[NotebookRecord], base_name: str) -> Dict[str, str]:
        machine_data = self.generate_machine_readable(records)
        human_text = self.generate_human_readable(records)
        
        machine_path = self.output_dir / f"{base_name}_machine.json"
        human_path = self.output_dir / f"{base_name}_human.txt"
        
        with open(machine_path, 'w', encoding='utf-8') as f:
            json.dump(machine_data, f, indent=2, ensure_ascii=False)
        
        with open(human_path, 'w', encoding='utf-8') as f:
            f.write(human_text)
        
        consistency = self.verify_consistency(machine_data, human_text)
        
        return {
            "machine_path": str(machine_path),
            "human_path": str(human_path),
            "consistency_verified": consistency
        }

    def verify_consistency(self, machine_data: Dict[str, Any], human_text: str) -> bool:
        if str(machine_data["total_records"]) not in human_text:
            return False
        
        record_ids = [r["notebook_id"] for r in machine_data["records"]]
        for rid in record_ids:
            if rid not in human_text:
                return False
        
        return True
