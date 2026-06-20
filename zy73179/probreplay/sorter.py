from __future__ import annotations

from typing import List, Tuple, Dict

from .models import Record, SortInstability


TIE_EPS = 1e-9


def sort_records(
    records: List[Record],
    sort_key: str = "effective_score",
    descending: bool = True,
) -> Tuple[List[Record], List[SortInstability]]:
    key_fn = {
        "effective_score": lambda r: r.effective_score,
        "base_score": lambda r: r.base_score,
    }.get(sort_key, lambda r: r.effective_score)

    groups: List[List[Record]] = []
    for rec in records:
        placed = False
        for g in groups:
            if abs(key_fn(g[0]) - key_fn(rec)) <= TIE_EPS:
                g.append(rec)
                placed = True
                break
        if not placed:
            groups.append([rec])

    instabilities: List[SortInstability] = []
    for g in groups:
        if len(g) > 1:
            tied_value = round(key_fn(g[0]), 6)
            ids = [r.id for r in g]
            instabilities.append(
                SortInstability(
                    sort_key=sort_key,
                    tied_value=tied_value,
                    record_ids=ids,
                    reason_pending=(
                        f"【待确认原因】排序键 {sort_key} 出现并列值 {tied_value}（共 {len(ids)} 条），"
                        f"未指定 tiebreaker 时相对顺序依赖输入顺序，结果不可复现（排序不稳定）"
                    ),
                    resolution=(
                        f"【处理去向】已对并列组按 record.id 升序施加确定性 tiebreaker，"
                        f"排序结果可复现；建议人工确认并列样本（{', '.join(ids)}）的及格判定与归属"
                    ),
                )
            )

    ordered_groups: List[List[Record]] = sorted(
        groups,
        key=lambda g: key_fn(g[0]),
        reverse=descending,
    )
    sorted_records: List[Record] = []
    for g in ordered_groups:
        g_sorted = sorted(g, key=lambda r: r.id)
        sorted_records.extend(g_sorted)

    for idx, rec in enumerate(sorted_records):
        rec.meta["rank"] = idx + 1
    return sorted_records, instabilities
