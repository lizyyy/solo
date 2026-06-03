from __future__ import annotations

from collections import defaultdict

from .models import QuestionnaireRawRow, ReviewStatus, SensitivityResult


def detect_duplicate_students(
    rows: list[QuestionnaireRawRow],
) -> list[dict]:
    sq_map: dict[str, dict[int, QuestionnaireRawRow]] = defaultdict(dict)
    for row in rows:
        key = f"{row.student_id}::{row.question_id}"
        sq_map[key][row.version] = row

    duplicates: list[dict] = []
    for key, versions in sq_map.items():
        if len(versions) <= 1:
            continue
        student_id, question_id = key.split("::")
        sorted_versions = sorted(versions.keys())
        entries = [versions[v] for v in sorted_versions]
        duplicates.append({
            "student_id": student_id,
            "question_id": question_id,
            "versions": sorted_versions,
            "rows": entries,
            "summary": (
                f"学生{student_id}对题目{question_id}提交了{len(sorted_versions)}版答案"
                f"（版本{','.join(map(str, sorted_versions))}），"
                f"得分分别为{','.join(str(r.score) for r in entries if r.score is not None)}"
            ),
        })
    return duplicates


def flag_duplicate_results(
    results: list[SensitivityResult],
    duplicate_keys: set[str] | None = None,
) -> list[SensitivityResult]:
    updated = []
    for r in results:
        key = f"{r.student_id}::{r.question_id}"
        if r.is_duplicate or (duplicate_keys and key in duplicate_keys):
            new_r = r.model_copy(update={
                "is_duplicate": True,
                "status": ReviewStatus.DUPLICATE_FLAGGED,
            })
            updated.append(new_r)
        else:
            updated.append(r)
    return updated
