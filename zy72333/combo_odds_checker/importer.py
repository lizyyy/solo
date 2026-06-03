from __future__ import annotations

from combo_odds_checker.models import (
    WeightEntry,
    ScoringWeightTable,
    SampleStatus,
)


def _detect_negative_as_missing(entry: WeightEntry) -> bool:
    if entry.raw_value is not None and entry.raw_value < 0:
        return True
    return False


def import_weight_table(
    table_id: str,
    raw_rows: list[dict],
    source: str = "csv",
) -> ScoringWeightTable:
    entries: list[WeightEntry] = []
    for idx, row in enumerate(raw_rows):
        category = row.get("category", f"未知类别-{idx}")
        weight = float(row.get("weight", 0))
        raw_value = row.get("raw_value")
        if raw_value is not None:
            raw_value = float(raw_value)

        entry = WeightEntry(
            row_id=idx,
            category=category,
            weight=weight,
            raw_value=raw_value,
            is_negative=raw_value is not None and raw_value < 0,
            old_table_treats_as_missing=False,
            note=row.get("note", ""),
        )

        entry.old_table_treats_as_missing = _detect_negative_as_missing(entry)
        entries.append(entry)

    return ScoringWeightTable(
        table_id=table_id,
        entries=entries,
        source=source,
    )


def flag_negative_as_missing(table: ScoringWeightTable) -> list[WeightEntry]:
    flagged: list[WeightEntry] = []
    for entry in table.entries:
        if entry.is_negative and entry.old_table_treats_as_missing:
            flagged.append(entry)
    return flagged
