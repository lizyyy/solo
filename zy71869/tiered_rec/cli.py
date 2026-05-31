from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from tiered_rec.engine import TieredRecommendationEngine
from tiered_rec.errors import friendly_error, FriendlyError
from tiered_rec.models import (
    DifficultyTier,
    EquivalentAnswerSource,
    ProcessingStatus,
    Question,
    ReviewRecord,
    StepAward,
    StepScore,
)
from tiered_rec.report import generate_review_draft


def _parse_question(raw: dict[str, Any]) -> Question:
    try:
        step_scores = [
            StepScore(
                step_label=s["step_label"],
                max_score=float(s["max_score"]),
                description=s.get("description", ""),
            )
            for s in raw.get("step_scores", [])
        ]
        return Question(
            question_id=raw["question_id"],
            source_exam=raw["source_exam"],
            content=raw["content"],
            standard_answer=raw["standard_answer"],
            equivalent_answers=raw.get("equivalent_answers", []),
            tier=DifficultyTier(raw.get("tier", "基础")),
            score_total=float(raw.get("score_total", 0)),
            step_scores=step_scores,
            metadata=raw.get("metadata", {}),
        )
    except Exception as exc:
        raise FriendlyError(str(exc), friendly_error(exc)) from exc


def _parse_review(raw: dict[str, Any]) -> ReviewRecord:
    try:
        step_breakdown = [
            StepAward(
                step_label=s["step_label"],
                awarded=float(s["awarded"]),
                note=s.get("note", ""),
            )
            for s in raw.get("step_breakdown", [])
        ]
        return ReviewRecord(
            record_id=raw.get("record_id", ""),
            question_id=raw["question_id"],
            student_answer=raw["student_answer"],
            awarded_score=float(raw["awarded_score"]),
            step_breakdown=step_breakdown,
            reviewer=raw.get("reviewer", ""),
            review_date=raw.get("review_date", ""),
            source=EquivalentAnswerSource(raw.get("source", "讲评记录")),
            is_equivalent_judged=raw.get("is_equivalent_judged", False),
            equivalent_note=raw.get("equivalent_note", ""),
            metadata=raw.get("metadata", {}),
        )
    except Exception as exc:
        raise FriendlyError(str(exc), friendly_error(exc)) from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="竞赛题分层推荐")
    parser.add_argument("--questions", required=True, help="题目数据 JSON 文件路径")
    parser.add_argument("--reviews", required=True, help="讲评记录 JSON 文件路径")
    parser.add_argument("--batch-id", default="default", help="批次编号")
    parser.add_argument("--output", default="-", help="输出文件路径，默认输出到屏幕")
    parser.add_argument(
        "--contact-review-team", default="讲评组", help="讲评组联系人"
    )
    parser.add_argument(
        "--contact-question-admin", default="题库管理员", help="题库管理员联系人"
    )
    args = parser.parse_args()

    try:
        with open(args.questions, "r", encoding="utf-8") as f:
            raw_questions = json.load(f)
        with open(args.reviews, "r", encoding="utf-8") as f:
            raw_reviews = json.load(f)
    except FileNotFoundError as exc:
        print(f"❌ 找不到数据文件：{exc.filename}，请检查文件路径是否正确。", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"❌ 数据文件格式有误，不是有效的 JSON：{friendly_error(exc)}", file=sys.stderr)
        sys.exit(1)

    engine = TieredRecommendationEngine()

    try:
        questions = [_parse_question(q) for q in raw_questions]
        reviews = [_parse_review(r) for r in raw_reviews]
    except FriendlyError as exc:
        print(f"❌ {exc.human_message}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"❌ {friendly_error(exc)}", file=sys.stderr)
        sys.exit(1)

    q_report = engine.load_questions(questions)
    r_report = engine.load_reviews(reviews)

    print("📥 题目导入：")
    for qid, status in q_report.items():
        print(f"  {qid}: {status}")
    print("📥 讲评记录导入：")
    for rid, status in r_report.items():
        print(f"  {rid}: {status}")

    results = engine.run(
        batch_id=args.batch_id,
        contact_review_team=args.contact_review_team,
        contact_question_admin=args.contact_question_admin,
    )

    confirmed = sum(1 for r in results if r.status == ProcessingStatus.CONFIRMED)
    pending = sum(1 for r in results if r.status == ProcessingStatus.PENDING)
    manual = sum(1 for r in results if r.status == ProcessingStatus.MANUAL_OVERRIDE)
    print(f"\n📊 推荐结果：已确认 {confirmed} ｜ 待补充 {pending} ｜ 人工修改 {manual}")

    draft = generate_review_draft(results)

    if args.output == "-":
        print()
        print(draft)
    else:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(draft)
        print(f"\n✅ 讲评稿已写入 {args.output}")


if __name__ == "__main__":
    main()
