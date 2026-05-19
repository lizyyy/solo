import fnmatch
import re
from datetime import date
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from .models import (
    DataContract,
    ExceptionRule,
    HitRecord,
    RecoveryItem,
    ExceptionStatus,
    RecoveryStatus,
)


class FieldPathMatcher:
    @staticmethod
    def exact_match(pattern: str, field_path: str) -> bool:
        return pattern == field_path

    @staticmethod
    def wildcard_match(pattern: str, field_path: str) -> bool:
        return fnmatch.fnmatch(field_path, pattern)

    @staticmethod
    def regex_match(pattern: str, field_path: str) -> bool:
        try:
            return bool(re.match(pattern, field_path))
        except re.error:
            return False

    @classmethod
    def match(cls, pattern: str, field_path: str, match_type: str = "exact") -> bool:
        matchers = {
            "exact": cls.exact_match,
            "wildcard": cls.wildcard_match,
            "regex": cls.regex_match,
        }
        matcher = matchers.get(match_type, cls.exact_match)
        return matcher(pattern, field_path)


class RuleEngine:
    def __init__(self, match_type: str = "exact"):
        self.match_type = match_type
        self.matcher = FieldPathMatcher()

    def check_expired_exceptions(
        self,
        exceptions: List[ExceptionRule],
        check_date: Optional[date] = None,
    ) -> List[ExceptionRule]:
        check_date = check_date or date.today()
        expired = []
        for exception in exceptions:
            if exception.status == ExceptionStatus.ACTIVE and exception.is_expired(
                check_date
            ):
                exception.status = ExceptionStatus.EXPIRED
                expired.append(exception)
        return expired

    def match_exceptions_to_hits(
        self,
        exceptions: List[ExceptionRule],
        hit_records: List[HitRecord],
        contracts: Optional[List[DataContract]] = None,
    ) -> Dict[str, List[HitRecord]]:
        exception_hits: Dict[str, List[HitRecord]] = defaultdict(list)

        for exception in exceptions:
            for hit in hit_records:
                if (
                    hit.contract_id == exception.contract_id
                    and hit.rule_id == exception.rule_id
                ):
                    exception_hits[exception.rule_id].append(hit)
                    continue

                if hit.contract_id == exception.contract_id and self.matcher.match(
                    exception.field_path, hit.field_path, self.match_type
                ):
                    exception_hits[exception.rule_id].append(hit)

        return dict(exception_hits)

    def aggregate_hit_stats(
        self,
        exception_hits: Dict[str, List[HitRecord]],
        exceptions: List[ExceptionRule],
    ) -> Dict[str, Dict]:
        stats: Dict[str, Dict] = {}
        exception_map = {e.rule_id: e for e in exceptions}

        for rule_id, hits in exception_hits.items():
            total_null = sum(h.null_count for h in hits)
            total_records = sum(h.total_count for h in hits)
            null_rate = total_null / total_records if total_records > 0 else 0.0

            sample_values = []
            for h in hits:
                sample_values.extend(h.sample_values)
                if len(sample_values) >= 100:
                    break

            stats[rule_id] = {
                "null_count": total_null,
                "total_count": total_records,
                "null_rate": round(null_rate, 4),
                "sample_count": len(sample_values),
                "sample_values": sample_values[:100],
            }

        return stats

    def generate_recovery_items(
        self,
        expired_exceptions: List[ExceptionRule],
        hit_stats: Dict[str, Dict],
    ) -> List[RecoveryItem]:
        recovery_items = []

        for exception in expired_exceptions:
            rule_id = exception.rule_id
            stats = hit_stats.get(rule_id, {})

            item = RecoveryItem(
                rule_id=rule_id,
                field_path=exception.field_path,
                exception_date=exception.exception_date,
                reason=exception.reason,
                null_rate=stats.get("null_rate", 0.0),
                null_count=stats.get("null_count", 0),
                total_count=stats.get("total_count", 0),
                recovery_status=RecoveryStatus.PENDING,
            )
            recovery_items.append(item)

        return recovery_items

    def find_unmatched_exceptions(
        self,
        exceptions: List[ExceptionRule],
        hit_records: List[HitRecord],
    ) -> List[ExceptionRule]:
        matched_rule_ids = set()
        for hit in hit_records:
            matched_rule_ids.add(hit.rule_id)

        unmatched = []
        for exception in exceptions:
            if exception.rule_id not in matched_rule_ids:
                unmatched.append(exception)

        return unmatched

    def validate_contract_compliance(
        self,
        contract: DataContract,
        hit_records: List[HitRecord],
    ) -> Dict[str, any]:
        contract_fields = {f.field_path: f for f in contract.fields}
        violations = []
        compliant_fields = []

        for hit in hit_records:
            if hit.contract_id != contract.contract_id:
                continue

            field = contract_fields.get(hit.field_path)
            if not field:
                violations.append(
                    {
                        "field_path": hit.field_path,
                        "type": "unknown_field",
                        "message": f"字段 {hit.field_path} 不在数据契约中",
                    }
                )
                continue

            if not field.is_nullable and hit.null_count > 0:
                violations.append(
                    {
                        "field_path": hit.field_path,
                        "type": "null_violation",
                        "message": f"字段 {hit.field_path} 不允许为空，但发现 {hit.null_count} 条空值",
                        "null_count": hit.null_count,
                        "null_rate": hit.null_rate,
                    }
                )
            else:
                compliant_fields.append(hit.field_path)

        return {
            "contract_id": contract.contract_id,
            "total_fields": len(contract_fields),
            "violations": violations,
            "violation_count": len(violations),
            "compliant_fields": compliant_fields,
            "is_compliant": len(violations) == 0,
        }

    def run_full_scan(
        self,
        contracts: List[DataContract],
        exceptions: List[ExceptionRule],
        hit_records: List[HitRecord],
        check_date: Optional[date] = None,
    ) -> Tuple[List[ExceptionRule], List[RecoveryItem], Dict[str, any]]:
        check_date = check_date or date.today()

        expired_exceptions = self.check_expired_exceptions(exceptions, check_date)

        exception_hits = self.match_exceptions_to_hits(
            expired_exceptions, hit_records, contracts
        )

        hit_stats = self.aggregate_hit_stats(exception_hits, expired_exceptions)

        recovery_items = self.generate_recovery_items(expired_exceptions, hit_stats)

        unmatched = self.find_unmatched_exceptions(expired_exceptions, hit_records)

        compliance_results = {}
        for contract in contracts:
            compliance_results[contract.contract_id] = self.validate_contract_compliance(
                contract, hit_records
            )

        summary = {
            "scan_date": check_date.isoformat(),
            "total_contracts": len(contracts),
            "total_exceptions": len(exceptions),
            "expired_exceptions": len(expired_exceptions),
            "expired_with_hits": len(exception_hits),
            "expired_without_hits": len(unmatched),
            "recovery_items_count": len(recovery_items),
            "hit_stats": {
                rule_id: {
                    "null_count": stats["null_count"],
                    "total_count": stats["total_count"],
                    "null_rate": stats["null_rate"],
                }
                for rule_id, stats in hit_stats.items()
            },
        }

        return expired_exceptions, recovery_items, summary
