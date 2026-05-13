import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple
from collections import defaultdict


class EvidenceValidator:
    def __init__(self, base_dir: str = "evidence"):
        self.base_dir = Path(base_dir)
        self.checks: List[Dict[str, Any]] = []

    def check_evidence(self, evidence: Dict[str, Any]) -> Dict[str, Any]:
        result = {
            "id": evidence.get("id"),
            "name": evidence.get("name"),
            "audit_topic": evidence.get("audit_topic"),
            "path": evidence.get("path"),
            "status": "PASS",
            "issues": []
        }

        ev_path = self.base_dir / evidence.get("path", "")
        required = evidence.get("required", True)

        if not ev_path.exists():
            if required:
                result["status"] = "FAIL"
                result["issues"].append({
                    "type": "MISSING",
                    "severity": "critical",
                    "message": f"证据文件不存在: {ev_path}"
                })
            else:
                result["issues"].append({
                    "type": "MISSING_OPTIONAL",
                    "severity": "info",
                    "message": f"可选证据文件不存在: {ev_path}"
                })
        else:
            if ev_path.is_dir():
                result["status"] = "FAIL"
                result["issues"].append({
                    "type": "INVALID_PATH",
                    "severity": "critical",
                    "message": f"路径指向目录而非文件: {ev_path}"
                })

        if evidence.get("owner") is None or not str(evidence.get("owner", "")).strip():
            if required:
                result["status"] = "FAIL"
                result["issues"].append({
                    "type": "NO_OWNER",
                    "severity": "high",
                    "message": "缺少负责人信息"
                })
            else:
                result["issues"].append({
                    "type": "NO_OWNER_OPTIONAL",
                    "severity": "medium",
                    "message": "可选证据缺少负责人"
                })

        expiry_date = evidence.get("expiry_date")
        if expiry_date:
            try:
                expiry = datetime.strptime(str(expiry_date), "%Y-%m-%d")
                today = datetime.now()
                if expiry < today:
                    result["status"] = "FAIL"
                    result["issues"].append({
                        "type": "EXPIRED",
                        "severity": "high",
                        "message": f"证据已过期，过期日期: {expiry_date}"
                    })
                elif (expiry - today).days <= 30:
                    result["issues"].append({
                        "type": "EXPIRING_SOON",
                        "severity": "medium",
                        "message": f"证据即将过期，过期日期: {expiry_date}"
                    })
            except ValueError:
                result["issues"].append({
                    "type": "INVALID_DATE",
                    "severity": "medium",
                    "message": f"过期日期格式无效: {expiry_date}"
                })

        remediation_status = evidence.get("remediation_status")
        if remediation_status:
            if remediation_status.lower() not in ["已关闭", "closed", "completed", "done"]:
                result["status"] = "FAIL"
                result["issues"].append({
                    "type": "REMEDIATION_OPEN",
                    "severity": "high",
                    "message": f"整改未关闭，当前状态: {remediation_status}"
                })

        return result

    def check_all(self, evidence_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        results = []
        seen_ids = set()
        seen_paths = set()
        duplicates = defaultdict(list)

        for ev in evidence_list:
            ev_id = ev.get("id")
            ev_path = ev.get("path")

            if ev_id in seen_ids:
                duplicates["id"].append(ev_id)
            seen_ids.add(ev_id)

            if ev_path in seen_paths:
                duplicates["path"].append(ev_path)
            seen_paths.add(ev_path)

            result = self.check_evidence(ev)
            results.append(result)

        stats = self._calculate_stats(results, duplicates)

        return {
            "results": results,
            "duplicates": duplicates,
            "stats": stats,
            "checked_at": datetime.now().isoformat()
        }

    def _calculate_stats(self, results: List[Dict[str, Any]], duplicates: defaultdict) -> Dict[str, Any]:
        pass_count = sum(1 for r in results if r["status"] == "PASS")
        fail_count = sum(1 for r in results if r["status"] == "FAIL")
        
        issue_stats = defaultdict(int)
        for r in results:
            for issue in r["issues"]:
                issue_stats[issue["type"]] += 1
                issue_stats[f"severity_{issue['severity']}"] += 1

        return {
            "total": len(results),
            "pass": pass_count,
            "fail": fail_count,
            "duplicate_ids": len(duplicates.get("id", [])),
            "duplicate_paths": len(duplicates.get("path", [])),
            "issues": dict(issue_stats)
        }


def calculate_file_hash(file_path: Path, algorithm: str = "sha256") -> str:
    hasher = hashlib.new(algorithm)
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            hasher.update(chunk)
    return hasher.hexdigest()
