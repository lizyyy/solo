from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.compare import CompareResult, CompareDetail
from app.models.knowledge import Knowledge
from app.repositories.knowledge_repo import knowledge_repo
from app.schemas.compare import CompareRequest, CompareExecuteResponse
from app.utils.text_compare import (
    calculate_overall_similarity,
    determine_error_type,
    match_keywords,
    compare_sentences
)
from app.utils.text_compare import extract_keywords
from app.core.config import settings


class CompareService:
    def _find_matching_knowledge(self, db: Session, question: str) -> Optional[Knowledge]:
        active_knowledge = knowledge_repo.get_active_knowledge(db)

        if not active_knowledge:
            return None

        best_match = None
        best_score = 0.0

        for knowledge in active_knowledge:
            knowledge_text = f"{knowledge.name} {knowledge.content} {knowledge.keywords or ''}"
            _, _, match_ratio = match_keywords(knowledge_text, question)

            keywords = extract_keywords(question)
            knowledge_keywords = knowledge.keywords.split(",") if knowledge.keywords else []
            keyword_hit = sum(1 for kw in keywords if kw in knowledge_keywords)

            score = match_ratio * 0.5 + (keyword_hit / max(len(keywords), 1)) * 0.5

            if score > best_score and score > 0.1:
                best_score = score
                best_match = knowledge

        return best_match

    def compare_qa(
        self,
        db: Session,
        meeting_id: int,
        question: str,
        answer: str,
        knowledge_id: Optional[int] = None,
        threshold: Optional[float] = None
    ) -> CompareResult:
        if threshold is None:
            threshold = settings.SIMILARITY_THRESHOLD

        knowledge = None
        if knowledge_id:
            knowledge = knowledge_repo.get_by_id(db, knowledge_id)
            if not knowledge:
                from app.core.exceptions import ResourceNotFoundException
                raise ResourceNotFoundException("知识库", knowledge_id)
        else:
            knowledge = self._find_matching_knowledge(db, question)

        standard_answer = knowledge.content if knowledge else ""

        similarity, is_match, details = calculate_overall_similarity(standard_answer, answer, threshold)

        error_type = determine_error_type(standard_answer, answer, similarity, threshold)

        status = "correct" if is_match else ("error" if similarity < 0.3 else "need_review")

        confidence = similarity

        compare_result = CompareResult(
            meeting_id=meeting_id,
            knowledge_id=knowledge.id if knowledge else None,
            knowledge_version=knowledge.version if knowledge else None,
            question=question,
            standard_answer=standard_answer,
            meeting_answer=answer,
            similarity=similarity,
            is_match=is_match,
            status=status,
            error_type=error_type if not is_match else None,
            confidence=confidence
        )

        db.add(compare_result)
        db.flush()

        if "keyword_match" in details:
            km = details["keyword_match"]
            detail = CompareDetail(
                compare_result_id=compare_result.id,
                detail_type="keyword_match",
                standard_part=",".join(km.get("matched", [])),
                meeting_part=",".join(km.get("missing", [])),
                diff_content=f"匹配率: {km.get('ratio', 0):.2%}",
                similarity=km.get("ratio", 0),
                remark="关键词匹配结果"
            )
            db.add(detail)

        if "sentence_compare" in details:
            sc = details["sentence_compare"]
            for idx, sent_result in enumerate(sc.get("results", [])):
                detail = CompareDetail(
                    compare_result_id=compare_result.id,
                    detail_type="sentence_diff",
                    standard_part=sent_result.get("standard_sentence", ""),
                    meeting_part=sent_result.get("meeting_sentence", ""),
                    diff_content=sent_result.get("diff", ""),
                    similarity=sent_result.get("similarity", 0),
                    remark=f"句子对比 #{idx + 1}"
                )
                db.add(detail)

        db.commit()
        db.refresh(compare_result)

        return compare_result

    def execute_compare(self, db: Session, request: CompareRequest) -> CompareExecuteResponse:
        from app.models.meeting import Meeting
        from app.repositories.meeting_repo import meeting_repo

        meeting = meeting_repo.get_by_id_or_404(db, request.meeting_id, "会议")

        from app.utils.file_parser import extract_qa_pairs
        qa_pairs = extract_qa_pairs(meeting.content)

        total_compared = 0
        matched_count = 0
        mismatched_count = 0
        need_review_count = 0
        total_similarity = 0.0

        for qa in qa_pairs:
            result = self.compare_qa(
                db,
                meeting_id=meeting.id,
                question=qa["question"],
                answer=qa["answer"],
                knowledge_id=request.knowledge_id,
                threshold=request.threshold
            )

            total_compared += 1
            total_similarity += result.similarity

            if result.is_match:
                matched_count += 1
            elif result.status == "need_review":
                need_review_count += 1
            else:
                mismatched_count += 1

        meeting_repo.update_stats(
            db, meeting.id, total_compared, matched_count, mismatched_count, "completed"
        )

        average_similarity = total_similarity / total_compared if total_compared > 0 else 0.0

        return CompareExecuteResponse(
            meeting_id=meeting.id,
            total_compared=total_compared,
            matched_count=matched_count,
            mismatched_count=mismatched_count,
            need_review_count=need_review_count,
            average_similarity=round(average_similarity, 4)
        )

    def get_compare_results(
        self,
        db: Session,
        meeting_id: int,
        status: Optional[str] = None,
        is_affected_by_version: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[CompareResult], int, int]:
        query = db.query(CompareResult).filter(
            CompareResult.meeting_id == meeting_id,
            CompareResult.is_deleted == False
        )

        if status:
            query = query.filter(CompareResult.status == status)

        if is_affected_by_version is not None:
            query = query.filter(CompareResult.is_affected_by_version == is_affected_by_version)

        query = query.order_by(CompareResult.created_at.desc())

        total = query.count()
        skip = (page - 1) * page_size
        items = query.offset(skip).limit(page_size).all()
        total_pages = (total + page_size - 1) // page_size

        return items, total, total_pages

    def get_compare_result(self, db: Session, result_id: int) -> CompareResult:
        result = db.query(CompareResult).filter(
            CompareResult.id == result_id,
            CompareResult.is_deleted == False
        ).first()

        if not result:
            from app.core.exceptions import ResourceNotFoundException
            raise ResourceNotFoundException("比对结果", result_id)

        result.details = db.query(CompareDetail).filter(
            CompareDetail.compare_result_id == result_id
        ).order_by(CompareDetail.id).all()

        return result

    def get_affected_results(self, db: Session, meeting_id: int) -> List[CompareResult]:
        return db.query(CompareResult).filter(
            CompareResult.meeting_id == meeting_id,
            CompareResult.is_affected_by_version == True,
            CompareResult.is_deleted == False
        ).order_by(CompareResult.created_at.desc()).all()


compare_service = CompareService()
