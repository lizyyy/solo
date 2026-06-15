from datetime import datetime
from typing import List, Dict
from collections import defaultdict
from .models import (
    FeatureRecord,
    SelfCheckResult,
    RecordStatus,
)


def check_duplicate_imports(records: List[FeatureRecord]) -> SelfCheckResult:
    seen = set()
    duplicates = []

    for rec in records:
        key = (rec.feature_id, rec.bucket_id, rec.sample_id)
        if key in seen:
            duplicates.append(f"特征{rec.feature_id}-桶{rec.bucket_id}-样本{rec.sample_id}")
        seen.add(key)

    if duplicates:
        return SelfCheckResult(
            check_type="重复导入检查",
            passed=False,
            details=f"发现{len(duplicates)}条重复记录: {', '.join(duplicates[:5])}{'...' if len(duplicates) > 5 else ''}",
            found_issues=len(duplicates),
        )
    return SelfCheckResult(
        check_type="重复导入检查",
        passed=True,
        details="无重复记录",
        found_issues=0,
    )


def check_feature_missing_default(records: List[FeatureRecord]) -> SelfCheckResult:
    missing_records = [
        r for r in records
        if r.status == RecordStatus.FEATURE_MISSING_DEFAULT
    ]

    if missing_records:
        sample_ids = [r.sample_id for r in missing_records]
        return SelfCheckResult(
            check_type="特征缺失默认分检查",
            passed=False,
            details=(
                f"发现{len(missing_records)}条记录特征缺失使用默认值填充: "
                f"{', '.join(sample_ids[:5])}{'...' if len(sample_ids) > 5 else ''}。"
                f"这些记录需要推荐负责人复核，暂不归为正常"
            ),
            found_issues=len(missing_records),
        )
    return SelfCheckResult(
        check_type="特征缺失默认分检查",
        passed=True,
        details="无特征缺失记录",
        found_issues=0,
    )


def check_resupplement_recalculation(
    original_records: List[FeatureRecord],
    resupplemented_records: List[FeatureRecord],
) -> SelfCheckResult:
    original_map = {(r.feature_id, r.sample_id): r for r in original_records}
    issues = []

    for new_rec in resupplemented_records:
        key = (new_rec.feature_id, new_rec.sample_id)
        if key in original_map:
            old_rec = original_map[key]
            if old_rec.status == RecordStatus.FEATURE_MISSING_DEFAULT and new_rec.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                if old_rec.feature_value == new_rec.feature_value:
                    issues.append(f"样本{new_rec.sample_id}补录后仍为默认值，未更新")

    if issues:
        return SelfCheckResult(
            check_type="补录后重算检查",
            passed=False,
            details=f"发现{len(issues)}条补录后未正确重算: {', '.join(issues[:5])}",
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="补录后重算检查",
        passed=True,
        details="补录记录均已正确重算",
        found_issues=0,
    )


def check_export_consistency(
    page_data: List[Dict],
    api_data: List[Dict],
    detail_data: List[Dict],
) -> SelfCheckResult:
    issues = []

    if len(page_data) != len(api_data) or len(page_data) != len(detail_data):
        issues.append(
            f"数据条数不一致: 页面{len(page_data)}条, 接口{len(api_data)}条, 明细{len(detail_data)}条"
        )

    page_keys = {str(sorted(d.items())) for d in page_data}
    api_keys = {str(sorted(d.items())) for d in api_data}
    detail_keys = {str(sorted(d.items())) for d in detail_data}

    if page_keys != api_keys:
        issues.append("页面展示与接口返回数据不一致")
    if page_keys != detail_keys:
        issues.append("页面展示与导出明细数据不一致")

    if issues:
        return SelfCheckResult(
            check_type="导出一致性检查",
            passed=False,
            details="; ".join(issues),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="导出一致性检查",
        passed=True,
        details="页面、接口、明细数据完全一致",
        found_issues=0,
    )


def run_all_self_checks(
    bucket_records: List[FeatureRecord],
    negative_records: List[FeatureRecord],
) -> List[SelfCheckResult]:
    all_records = bucket_records + negative_records
    results = []

    results.append(check_duplicate_imports(bucket_records))
    results.append(check_duplicate_imports(negative_records))
    results.append(check_feature_missing_default(all_records))

    return results
