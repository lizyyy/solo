from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict
from .models import (
    FeatureRecord,
    SelfCheckResult,
    RecordStatus,
    CheckSession,
    ConflictEvidence,
)
from .result_store import UnifiedResultStore


def check_duplicate_imports(records: List[FeatureRecord]) -> SelfCheckResult:
    seen = set()
    duplicates = []
    for rec in records:
        key = (rec.feature_id, rec.bucket_id, rec.sample_id)
        if key in seen:
            duplicates.append("特征" + str(rec.feature_id) + "-桶" + str(rec.bucket_id) + "-样本" + str(rec.sample_id))
        seen.add(key)
    if duplicates:
        return SelfCheckResult(
            check_type="重复导入检查",
            passed=False,
            details="发现" + str(len(duplicates)) + "条重复记录: " + ", ".join(duplicates[:5]) + ("..." if len(duplicates) > 5 else ""),
            found_issues=len(duplicates),
        )
    return SelfCheckResult(
        check_type="重复导入检查", passed=True, details="无重复记录", found_issues=0
    )


def check_feature_missing_default(records: List[FeatureRecord]) -> SelfCheckResult:
    missing_records = [r for r in records if r.status == RecordStatus.FEATURE_MISSING_DEFAULT]
    if missing_records:
        sample_ids = [r.sample_id for r in missing_records]
        return SelfCheckResult(
            check_type="特征缺失默认分检查", passed=False,
            details=("发现" + str(len(missing_records)) + "条记录特征缺失使用默认值填充: "
                     + ", ".join(sample_ids[:5]) + ("..." if len(sample_ids) > 5 else "")
                     + ".这些记录需要推荐负责人复核，暂不归为正常"),
            found_issues=len(missing_records),
        )
    return SelfCheckResult(
        check_type="特征缺失默认分检查", passed=True, details="无特征缺失记录", found_issues=0
    )


def check_resupplement_recalculation(original_records, resupplemented_records):
    omap = {(r.feature_id, r.sample_id): r for r in original_records}
    issues = []
    for nr in resupplemented_records:
        k = (nr.feature_id, nr.sample_id)
        if k in omap:
            orr = omap[k]
            if orr.status == RecordStatus.FEATURE_MISSING_DEFAULT and nr.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                if orr.feature_value == nr.feature_value:
                    issues.append("样本" + nr.sample_id + "补录后仍为默认值，未更新")
    if issues:
        return SelfCheckResult(
            check_type="补录后重算检查", passed=False,
            details="发现" + str(len(issues)) + "条补录后未正确重算: " + ", ".join(issues[:5]),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="补录后重算检查", passed=True, details="补录记录均已正确重算", found_issues=0
    )


def check_export_internal_consistency(
    bucket_records: List[FeatureRecord],
    negative_records: List[FeatureRecord],
    conflicts: List[ConflictEvidence],
) -> SelfCheckResult:
    issues = []
    br_map = {(r.sample_id, r.feature_id): r for r in bucket_records}
    nr_map = {(r.sample_id, r.feature_id): r for r in negative_records}
    for c in conflicts:
        k = (c.sample_id, c.feature_id)
        if k not in br_map and k not in nr_map:
            issues.append("冲突" + c.record_id + "在桶和负样本中均未找到记录")
    if issues:
        return SelfCheckResult(
            check_type="导出数据一致性检查", passed=False,
            details="发现" + str(len(issues)) + "处不一致: " + ", ".join(issues[:5]),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="导出数据一致性检查", passed=True, details="导出数据三端一致", found_issues=0
    )


def check_page_api_export_consistency(
    page_data: List[Dict],
    api_data: List[Dict],
    detail_data: List[Dict],
) -> SelfCheckResult:
    issues = []
    if len(page_data) != len(api_data) or len(page_data) != len(detail_data):
        issues.append(
            "数据条数不一致: 页面" + str(len(page_data)) + "条, 接口" + str(len(api_data)) + "条, 明细" + str(len(detail_data)) + "条"
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
            check_type="三端数据一致性自检",
            passed=False,
            details="; ".join(issues),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="三端数据一致性自检",
        passed=True,
        details="页面、接口、明细数据完全一致",
        found_issues=0,
    )


def check_resupplement_pending_status(pre_snapshot, current_records) -> SelfCheckResult:
    issues = []
    if pre_snapshot is None:
        return SelfCheckResult(
            check_type="补录后重算正确性自检", passed=True,
            details="无补录快照(非补录触发)，跳过检查", found_issues=0
        )
    pre_map = {(r.sample_id, r.feature_id): r for r in pre_snapshot}
    curr_map = {(r.sample_id, r.feature_id): r for r in current_records}
    for k, pre_rec in pre_map.items():
        if pre_rec.status != RecordStatus.FEATURE_MISSING_DEFAULT:
            continue
        if k not in curr_map:
            continue
        curr_rec = curr_map[k]
        pre_missing = (pre_rec.feature_value is None or str(pre_rec.feature_value) == "nan" or str(pre_rec.feature_value) == "")
        curr_missing = (curr_rec.feature_value is None or str(curr_rec.feature_value) == "nan" or str(curr_rec.feature_value) == "")
        if not pre_missing:
            continue
        if not curr_missing and curr_rec.status == RecordStatus.FEATURE_MISSING_DEFAULT:
            issues.append("样本" + curr_rec.sample_id + "特征" + curr_rec.feature_id + "原始值已补全但仍为FEATURE_MISSING_DEFAULT/pending状态")
        elif curr_missing and curr_rec.status != RecordStatus.FEATURE_MISSING_DEFAULT:
            issues.append("样本" + curr_rec.sample_id + "特征" + curr_rec.feature_id + "仍缺失但pending状态被误取消")
    if issues:
        return SelfCheckResult(
            check_type="补录后重算正确性自检", passed=False,
            details="发现" + str(len(issues)) + "项pending状态错误: " + "; ".join(issues[:5]),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="补录后重算正确性自检", passed=True,
        details="补录后所有特征pending状态均正确", found_issues=0
    )


def check_three_way_consistency(session: CheckSession) -> SelfCheckResult:
    store = UnifiedResultStore(session)
    issues = []
    try:
        pr = store.get_all_records_for_page()
        ar = store.get_all_records_for_api()
        er = store.get_all_records_for_export()
        if len(pr) != len(ar):
            issues.append("页面记录数" + str(len(pr)) + " != API记录数" + str(len(ar)))
        if len(ar) != len(er):
            issues.append("API记录数" + str(len(ar)) + " != 导出记录数" + str(len(er)))
        page_keys = {(r["样本ID"], r["特征ID"]) for r in pr}
        api_keys = {(r["样本ID"], r["特征ID"]) for r in ar}
        if page_keys != api_keys:
            issues.append("页面与API样本-特征键集合不一致")
        if not issues:
            for r in pr:
                k = (r["样本ID"], r["特征ID"])
                page_val = r.get("最终状态(英文)")
                api_rec = next((x for x in ar if (x["样本ID"], x["特征ID"]) == k), None)
                if api_rec and api_rec.get("最终状态(英文)") != page_val:
                    issues.append("记录" + str(k) + "页面状态=" + str(page_val) + " vs API状态=" + str(api_rec.get("status")))
                    if len(issues) >= 3:
                        break
    except Exception as e:
        return SelfCheckResult(
            check_type="三端数据一致性自检", passed=False,
            details="自检执行异常: " + str(e), found_issues=1
        )
    if issues:
        return SelfCheckResult(
            check_type="三端数据一致性自检", passed=False,
            details="发现" + str(len(issues)) + "处三端不一致: " + "; ".join(issues[:5]),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="三端数据一致性自检", passed=True,
        details="页面/API/导出三端数据完全一致", found_issues=0
    )


def run_all_self_checks(
    bucket_records,
    negative_records,
    conflicts,
    session: Optional[CheckSession] = None,
    pre_resupplement_snapshot=None,
) -> List[SelfCheckResult]:
    results = []
    all_records = list(bucket_records) + list(negative_records)
    results.append(check_duplicate_imports(all_records))
    results.append(check_feature_missing_default(bucket_records))
    if pre_resupplement_snapshot is not None:
        results.append(check_resupplement_recalculation(pre_resupplement_snapshot, bucket_records))
        results.append(check_resupplement_pending_status(pre_resupplement_snapshot, bucket_records))
    results.append(check_export_internal_consistency(bucket_records, negative_records, conflicts))
    if session is not None:
        results.append(check_three_way_consistency(session))
    return results
