from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Optional

from .models import (
    ArrivalStatus,
    CanBaoRen,
    DanWeiHuiKuan,
    MatchResult,
    ProblemCategory,
    BujiaoDan,
)


def _match_person(
    dan: BujiaoDan, person_index: dict[str, list[CanBaoRen]]
) -> tuple[Optional[CanBaoRen], str, list[ProblemCategory]]:
    problems: list[ProblemCategory] = []
    candidates_by_id = person_index.get(dan.id_number, [])
    same_name_different_id: list[CanBaoRen] = []

    for person_list in person_index.values():
        for p in person_list:
            if p.name == dan.name and p.id_number != dan.id_number:
                same_name_different_id.append(p)

    if same_name_different_id:
        problems.append(ProblemCategory.DUPLICATE_NAME)

    if candidates_by_id:
        if len(candidates_by_id) == 1:
            p = candidates_by_id[0]
            reason = f"身份证号 {dan.id_number} 唯一匹配到参保人 {p.name}（单位 {p.unit_code}，状态 {p.status}）"
            if same_name_different_id:
                names_str = "、".join(
                    f"{sn.name}（身份证 {sn.id_number[:6]}****{sn.id_number[-4:]}, 单位 {sn.unit_code}）"
                    for sn in same_name_different_id
                )
                reason += f"；注意: 参保人库中存在同名人员 {names_str}，请人工确认是否为同一人"
            return p, reason, problems
        else:
            matched = None
            for p in candidates_by_id:
                if p.unit_code == dan.unit_code:
                    matched = p
                    break
            if matched is None:
                matched = candidates_by_id[0]
            reason = (
                f"身份证号 {dan.id_number} 匹配到 {len(candidates_by_id)} 名参保人，"
                f"按单位编号 {dan.unit_code} 选取 {matched.name}"
            )
            return matched, reason, problems

    if same_name_different_id:
        names_str = "、".join(
            f"{p.name}（身份证 {p.id_number[:6]}****{p.id_number[-4:]}, 单位 {p.unit_code}）"
            for p in same_name_different_id
        )
        reason = (
            f"补缴单身份证号 {dan.id_number} 在参保人库中未找到，"
            f"但存在同名人员: {names_str}；请人工确认是否为同一人"
        )
        return None, reason, problems

    reason = f"身份证号 {dan.id_number} 在参保人库中未找到任何匹配记录"
    return None, reason, problems


def _check_duplicate_months(
    results_so_far: dict[str, list[MatchResult]], dan: BujiaoDan
) -> tuple[bool, str, list[ProblemCategory]]:
    problems: list[ProblemCategory] = []
    key = f"{dan.id_number}|{dan.bujiao_month}"
    existing = results_so_far.get(key, [])
    if existing:
        problems.append(ProblemCategory.DUPLICATE_MONTH)
        prev = existing[0].bujiao_dan
        reason = (
            f"身份证号 {dan.id_number} 的 {dan.bujiao_month} 月份补缴重复："
            f"已存在单号 {prev.dan_hao}（来源 {prev.source_file} 第 {prev.source_line} 行），"
            f"当前单号 {dan.dan_hao}；请人工确认是否为不同补缴事项"
        )
        return True, reason, problems
    reason = f"身份证号 {dan.id_number} 的 {dan.bujiao_month} 月份无重复补缴记录"
    return False, reason, problems


def _determine_arrival_status(
    dan: BujiaoDan,
    remittances_by_unit: dict[str, list[DanWeiHuiKuan]],
) -> tuple[ArrivalStatus, Optional[DanWeiHuiKuan], str, list[ProblemCategory]]:
    problems: list[ProblemCategory] = []
    unit_remittances = remittances_by_unit.get(dan.unit_code, [])

    if not unit_remittances:
        reason = (
            f"单位编号 {dan.unit_code} 无任何汇款记录，"
            f"补缴单 {dan.dan_hao}（{dan.bujiao_month}，{dan.amount}元）无法匹配到账"
        )
        return ArrivalStatus.NO_REMITTANCE, None, reason, problems

    matching_remittances: list[DanWeiHuiKuan] = []
    for r in unit_remittances:
        if r.arrival_date and r.remit_date <= dan.declare_date:
            if r.arrival_date > dan.declare_date:
                pass
            if abs(r.amount - dan.amount) < 0.01 or r.amount >= dan.amount:
                matching_remittances.append(r)
        elif r.arrival_date and r.arrival_date > dan.declare_date:
            matching_remittances.append(r)
        elif not r.arrival_date and r.remit_date <= dan.declare_date:
            pass

    best: Optional[DanWeiHuiKuan] = None
    for r in unit_remittances:
        if r.arrival_date is None:
            continue
        if r.amount >= dan.amount - 0.01:
            if best is None or abs(r.arrival_date - dan.declare_date).days < abs(best.arrival_date - dan.declare_date).days:
                best = r

    if best is None:
        pending = [r for r in unit_remittances if r.arrival_date is None]
        if pending:
            reason = (
                f"单位编号 {dan.unit_code} 有 {len(pending)} 笔汇款尚未到账，"
                f"补缴单 {dan.dan_hao}（{dan.bujiao_month}，{dan.amount}元）暂无法确认到账"
            )
            return ArrivalStatus.NOT_ARRIVED, None, reason, problems
        reason = (
            f"单位编号 {dan.unit_code} 有 {len(unit_remittances)} 笔汇款，"
            f"但金额均不足以覆盖补缴单 {dan.dan_hao}（{dan.amount}元）"
        )
        return ArrivalStatus.NOT_ARRIVED, None, reason, problems

    if best.arrival_date > dan.declare_date:
        problems.append(ProblemCategory.LATE_ARRIVAL)
        reason = (
            f"补缴单 {dan.dan_hao} 申报日期 {dan.declare_date}，"
            f"对应汇款到账日期 {best.arrival_date}，"
            f"到账晚于申报 {(best.arrival_date - dan.declare_date).days} 天；"
            f"汇款来源 {best.source_file} 第 {best.source_line} 行，"
            f"汇款日期 {best.remit_date}，金额 {best.amount}元"
        )
        return ArrivalStatus.LATE, best, reason, problems

    reason = (
        f"补缴单 {dan.dan_hao} 申报日期 {dan.declare_date}，"
        f"对应汇款到账日期 {best.arrival_date}，到账正常；"
        f"汇款来源 {best.source_file} 第 {best.source_line} 行，"
        f"汇款日期 {best.remit_date}，金额 {best.amount}元"
    )
    return ArrivalStatus.MATCHED, best, reason, problems


def run_match(
    bujiao_dans: list[BujiaoDan],
    can_bao_rens: list[CanBaoRen],
    hui_kuans: list[DanWeiHuiKuan],
) -> list[MatchResult]:
    person_index_by_id: dict[str, list[CanBaoRen]] = defaultdict(list)
    for p in can_bao_rens:
        person_index_by_id[p.id_number].append(p)

    remittances_by_unit: dict[str, list[DanWeiHuiKuan]] = defaultdict(list)
    for r in hui_kuans:
        remittances_by_unit[r.unit_code].append(r)

    month_tracker: dict[str, list[MatchResult]] = defaultdict(list)

    results: list[MatchResult] = []

    for dan in bujiao_dans:
        all_problems: list[ProblemCategory] = []

        matched_person, person_reason, person_problems = _match_person(
            dan, dict(person_index_by_id)
        )
        all_problems.extend(person_problems)

        is_dup, month_reason, month_problems = _check_duplicate_months(
            month_tracker, dan
        )
        all_problems.extend(month_problems)

        arrival_status, matched_remittance, arrival_reason, arrival_problems = (
            _determine_arrival_status(dan, remittances_by_unit)
        )
        all_problems.extend(arrival_problems)

        result = MatchResult(
            bujiao_dan=dan,
            matched_person=matched_person,
            matched_remittance=matched_remittance,
            arrival_status=arrival_status,
            person_match_reason=person_reason,
            month_validation_reason=month_reason,
            arrival_status_reason=arrival_reason,
            problems=list(dict.fromkeys(all_problems)),
        )

        month_key = f"{dan.id_number}|{dan.bujiao_month}"
        month_tracker[month_key].append(result)

        results.append(result)

    return results
