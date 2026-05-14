import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from .database import EnvSnapshot, ErrorSample, Batch, ActionLog, Supplier


class ReportGenerator:
    def __init__(self, db: Session):
        self.db = db

    def generate_json(self, data: Dict[str, Any]) -> str:
        return json.dumps(data, ensure_ascii=False, indent=2)

    def generate_markdown(self, data: Dict[str, Any]) -> str:
        md_lines = []
        md_lines.append(f"# {data.get('title', '环境变量快照报告')}")
        md_lines.append("")
        md_lines.append(f"**生成时间**: {datetime.now().isoformat()}")
        md_lines.append(f"**报告版本**: 1.0")
        md_lines.append("")

        if "summary" in data:
            md_lines.append("## 摘要")
            md_lines.append("")
            for key, value in data["summary"].items():
                md_lines.append(f"- **{key}**: {value}")
            md_lines.append("")

        if "snapshots" in data:
            md_lines.append("## 快照列表")
            md_lines.append("")
            for snap in data["snapshots"]:
                md_lines.append(f"### {snap.get('snapshot_id', '未知')}")
                md_lines.append("")
                md_lines.append(f"- **供应商**: {snap.get('supplier_name', '未知')}")
                md_lines.append(f"- **算法**: {snap.get('algorithm', '未知')}")
                md_lines.append(f"- **操作者**: {snap.get('operator', '未知')}")
                md_lines.append(f"- **结论**: {snap.get('conclusion', '未知')}")
                md_lines.append(f"- **材料摘要**: {snap.get('material_summary', '无')}")
                if snap.get("rerun_marker"):
                    md_lines.append(f"- **重跑标记**: `{snap['rerun_marker']}`")
                md_lines.append("")

                if snap.get("errors"):
                    md_lines.append("#### 错误样本")
                    md_lines.append("")
                    for err in snap["errors"]:
                        md_lines.append(f"- **{err.get('type')}**: {err.get('description')}")
                    md_lines.append("")

        if "legal_evidence" in data:
            md_lines.append("## 法务证据页")
            md_lines.append("")
            md_lines.append("### 复核样例")
            md_lines.append("")
            evidence = data["legal_evidence"]
            md_lines.append("| 项目 | 内容 |")
            md_lines.append("|------|------|")
            md_lines.append(f"| 批次ID | {evidence.get('batch_id', 'N/A')} |")
            md_lines.append(f"| 重跑标记 | `{evidence.get('rerun_marker', 'N/A')}` |")
            md_lines.append(f"| 输入数据 | `{evidence.get('input_data', 'N/A')}` |")
            md_lines.append(f"| 执行动作 | {evidence.get('action', 'N/A')} |")
            md_lines.append(f"| 处理结论 | {evidence.get('conclusion', 'N/A')} |")
            md_lines.append(f"| 操作者 | {evidence.get('operator', 'N/A')} |")
            md_lines.append(f"| 时间戳 | {evidence.get('timestamp', 'N/A')} |")
            md_lines.append("")
            md_lines.append("---")
            md_lines.append("")
            md_lines.append("**复核声明**:")
            md_lines.append("")
            md_lines.append("> 本人确认以上数据真实有效，已按照公司合规流程完成复核。")
            md_lines.append("")
            md_lines.append("复核人签名: _______________")
            md_lines.append("")
            md_lines.append("日期: _______________")

        return "\n".join(md_lines)

    def save_report(self, content: str, format: str, output_path: Optional[str] = None) -> str:
        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"env_snapshot_report_{timestamp}.{format}"
            output_path = os.path.join(os.getcwd(), filename)
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return output_path

    def generate_full_report(self, batch_id: Optional[str] = None,
                             include_evidence: bool = True) -> Dict[str, Any]:
        data = {
            "title": "环境变量快照合规报告",
            "generated_at": datetime.now().isoformat(),
            "summary": {},
            "snapshots": [],
            "errors": []
        }

        query = self.db.query(EnvSnapshot)
        if batch_id:
            batch = self.db.query(Batch).filter(Batch.batch_id == batch_id).first()
            if batch:
                query = query.filter(EnvSnapshot.batch_id == batch.id)
                data["batch_id"] = batch_id
                data["batch_operator"] = batch.operator

        snapshots = query.order_by(EnvSnapshot.created_at.desc()).all()
        
        total_snapshots = len(snapshots)
        total_errors = 0
        algorithm_mismatches = 0
        signature_mismatches = 0

        for snap in snapshots:
            errors = self.db.query(ErrorSample).filter(ErrorSample.snapshot_id == snap.id).all()
            error_list = [{"type": e.risk_type, "description": e.description, "severity": e.severity} for e in errors]
            
            total_errors += len(errors)
            algorithm_mismatches += sum(1 for e in errors if e.risk_type == "algorithm_mismatch")
            signature_mismatches += sum(1 for e in errors if e.risk_type == "signature_mismatch")

            data["snapshots"].append({
                "snapshot_id": snap.snapshot_id,
                "supplier_name": snap.supplier_name,
                "algorithm": snap.algorithm,
                "operator": snap.operator,
                "created_at": snap.created_at.isoformat(),
                "conclusion": snap.conclusion,
                "rerun_marker": snap.rerun_marker,
                "material_summary": snap.material_summary,
                "errors": error_list,
                "error_count": len(error_list)
            })

            for err in errors:
                data["errors"].append({
                    "snapshot_id": snap.snapshot_id,
                    "risk_type": err.risk_type,
                    "description": err.description,
                    "severity": err.severity,
                    "identified_at": err.identified_at.isoformat()
                })

        data["summary"] = {
            "总快照数": total_snapshots,
            "总错误数": total_errors,
            "算法不匹配数": algorithm_mismatches,
            "签名不匹配数": signature_mismatches,
            "风险等级": "HIGH" if algorithm_mismatches > 0 else "MEDIUM" if total_errors > 0 else "LOW"
        }

        if include_evidence and snapshots:
            sample_snap = snapshots[0]
            sample_errors = self.db.query(ErrorSample).filter(ErrorSample.snapshot_id == sample_snap.id).first()
            
            rerun_marker = f"RERUN-{datetime.now().strftime('%Y%m%d')}-{sample_snap.snapshot_id}"
            
            data["legal_evidence"] = {
                "batch_id": batch_id or "N/A",
                "rerun_marker": rerun_marker,
                "input_data": f"供应商={sample_snap.supplier_name}, 算法={sample_snap.algorithm}",
                "action": "环境变量快照验证",
                "conclusion": sample_snap.conclusion,
                "operator": sample_snap.operator,
                "timestamp": sample_snap.created_at.isoformat()
            }

        return data
