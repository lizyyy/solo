import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from ..models import (
    CheckResult,
    CheckSession,
    RuleResult,
    RuleType,
    Severity,
    EvidenceCatalog,
    Reference,
    Objection,
)


class JSONExporter:
    def __init__(self):
        pass

    def export_audit(
        self,
        check_result: CheckResult,
        check_session: Optional[CheckSession] = None,
        evidence_catalog: Optional[EvidenceCatalog] = None,
        references: Optional[List[Reference]] = None,
        objections: Optional[List[Objection]] = None,
        case_number: Optional[str] = None,
        case_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        audit = {
            "audit_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "check_info": {
                "check_id": check_result.check_id,
                "check_timestamp": check_result.check_timestamp.isoformat(),
                "case_number": case_number or check_result.case_number,
                "case_name": case_name or check_result.case_name,
                "files_processed": check_result.files_processed,
            },
            "summary": check_result.summary,
            "issues": self._serialize_issues(check_result.rule_results),
            "issues_by_severity": self._group_by_severity(check_result),
            "issues_by_rule_type": self._group_by_rule_type(check_result),
        }

        if check_session:
            audit["session"] = check_session.to_dict()

        if evidence_catalog:
            audit["evidence_catalog"] = evidence_catalog.to_dict()

        if references:
            audit["references"] = [r.to_dict() for r in references]

        if objections:
            audit["objections"] = [o.to_dict() for o in objections]

        audit["statistics"] = self._generate_statistics(check_result, references, objections)

        return audit

    def _serialize_issues(self, results: List[RuleResult]) -> List[Dict]:
        return [r.to_dict() for r in results]

    def _group_by_severity(self, check_result: CheckResult) -> Dict:
        grouped = {}
        for severity in Severity:
            results = check_result.get_results_by_severity(severity)
            if results:
                grouped[severity.value] = {
                    "count": len(results),
                    "issues": [r.to_dict() for r in results],
                }
        return grouped

    def _group_by_rule_type(self, check_result: CheckResult) -> Dict:
        grouped = {}
        for rule_type in RuleType:
            results = check_result.get_results_by_rule_type(rule_type)
            if results:
                grouped[rule_type.value] = {
                    "count": len(results),
                    "issues": [r.to_dict() for r in results],
                }
        return grouped

    def _generate_statistics(
        self,
        check_result: CheckResult,
        references: Optional[List[Reference]] = None,
        objections: Optional[List[Objection]] = None,
    ) -> Dict:
        stats = {
            "total_issues": check_result.issue_count,
            "critical_issues": len(check_result.get_results_by_severity(Severity.CRITICAL)),
            "high_issues": len(check_result.get_results_by_severity(Severity.HIGH)),
            "medium_issues": len(check_result.get_results_by_severity(Severity.MEDIUM)),
            "low_issues": len(check_result.get_results_by_severity(Severity.LOW)),
            "pass_status": check_result.issue_count == 0,
        }

        if references:
            by_type = {}
            for ref in references:
                ref_type = ref.reference_type.value
                by_type[ref_type] = by_type.get(ref_type, 0) + 1
            stats["references"] = {
                "total": len(references),
                "by_type": by_type,
            }

        if objections:
            by_status = {}
            by_type = {}
            unresolved = 0
            for obj in objections:
                status = obj.status.value
                obj_type = obj.objection_type.value
                by_status[status] = by_status.get(status, 0) + 1
                by_type[obj_type] = by_type.get(obj_type, 0) + 1
                if obj.requires_attention:
                    unresolved += 1
            stats["objections"] = {
                "total": len(objections),
                "by_status": by_status,
                "by_type": by_type,
                "unresolved": unresolved,
            }

        return stats

    def export_to_file(
        self,
        output_path: Path,
        check_result: CheckResult,
        check_session: Optional[CheckSession] = None,
        evidence_catalog: Optional[EvidenceCatalog] = None,
        references: Optional[List[Reference]] = None,
        objections: Optional[List[Objection]] = None,
        case_number: Optional[str] = None,
        case_name: Optional[str] = None,
        indent: int = 2,
    ) -> Path:
        audit_data = self.export_audit(
            check_result=check_result,
            check_session=check_session,
            evidence_catalog=evidence_catalog,
            references=references,
            objections=objections,
            case_number=case_number,
            case_name=case_name,
        )

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=indent)

        return output_path


def export_json_audit(
    output_path: Path,
    check_result: CheckResult,
    check_session: Optional[CheckSession] = None,
    evidence_catalog: Optional[EvidenceCatalog] = None,
    references: Optional[List[Reference]] = None,
    objections: Optional[List[Objection]] = None,
    case_number: Optional[str] = None,
    case_name: Optional[str] = None,
    indent: int = 2,
) -> Path:
    exporter = JSONExporter()
    return exporter.export_to_file(
        output_path=output_path,
        check_result=check_result,
        check_session=check_session,
        evidence_catalog=evidence_catalog,
        references=references,
        objections=objections,
        case_number=case_number,
        case_name=case_name,
        indent=indent,
    )
