from sqlalchemy.orm import Session
from typing import Optional, List, Tuple
from ..models.models import (
    TermRule,
    RuleStatus,
    RuleType,
    GrayRelease,
    TermLibrary,
    TermLibraryVersion
)
from ..schemas.schemas import TermMatchRequest, TermMatchResponse


class MatchService:
    def match_term(self, db: Session, request: TermMatchRequest) -> TermMatchResponse:
        search_term = request.search_term.strip()
        
        statuses = [RuleStatus.PRODUCTION]
        source = "production"
        
        if request.include_gray:
            statuses.append(RuleStatus.IN_GRAY)
            source = "gray_included"

        query = db.query(TermRule).filter(TermRule.status.in_(statuses))
        
        if request.library_id:
            library = db.query(TermLibrary).filter(TermLibrary.id == request.library_id).first()
            if not library:
                raise ValueError(f"词库不存在: id={request.library_id}")
            if not library.is_active:
                raise ValueError(f"词库已停用: {library.name}")
            query = query.filter(TermRule.library_id == request.library_id)

        rules = query.all()

        matched_rule = None
        match_confidence = 0.0

        for rule in rules:
            match_result, confidence = self._check_match(search_term, rule)
            if match_result and confidence > match_confidence:
                matched_rule = rule
                match_confidence = confidence

        if matched_rule:
            if matched_rule.status == RuleStatus.IN_GRAY:
                source = "gray"
            
            return TermMatchResponse(
                search_term=search_term,
                matched=True,
                rule_type=matched_rule.rule_type,
                rule_id=matched_rule.id,
                term=matched_rule.term,
                match_type=matched_rule.match_type,
                action=matched_rule.action,
                source=source,
                confidence=match_confidence
            )

        return TermMatchResponse(
            search_term=search_term,
            matched=False,
            rule_type=None,
            rule_id=None,
            term=None,
            match_type=None,
            action=None,
            source=None,
            confidence=None
        )

    def batch_match_terms(
        self,
        db: Session,
        terms: List[str],
        library_id: Optional[int] = None,
        include_gray: bool = False
    ) -> List[TermMatchResponse]:
        results = []
        for term in terms:
            result = self.match_term(
                db=db,
                request=TermMatchRequest(
                    search_term=term,
                    library_id=library_id,
                    include_gray=include_gray
                )
            )
            results.append(result)
        return results

    def get_production_rules(
        self,
        db: Session,
        library_id: Optional[int] = None,
        rule_type: Optional[RuleType] = None
    ) -> List[TermRule]:
        query = db.query(TermRule).filter(TermRule.status == RuleStatus.PRODUCTION)
        
        if library_id:
            query = query.filter(TermRule.library_id == library_id)
        if rule_type:
            query = query.filter(TermRule.rule_type == rule_type)
        
        return query.order_by(TermRule.priority.desc()).all()

    def get_gray_rules(
        self,
        db: Session,
        library_id: Optional[int] = None
    ) -> List[Tuple[TermRule, GrayRelease]]:
        query = (
            db.query(TermRule, GrayRelease)
            .join(GrayRelease, TermRule.current_gray_id == GrayRelease.id)
            .filter(
                TermRule.status == RuleStatus.IN_GRAY,
                GrayRelease.is_active == True
            )
        )
        
        if library_id:
            query = query.filter(TermRule.library_id == library_id)
        
        return query.all()

    def _check_match(self, search_term: str, rule: TermRule) -> Tuple[bool, float]:
        rule_term = rule.term.lower()
        search_lower = search_term.lower()

        if rule.match_type == "exact":
            if search_lower == rule_term:
                return True, 1.0
        elif rule.match_type == "contains":
            if rule_term in search_lower:
                return True, 0.8
        elif rule.match_type == "prefix":
            if search_lower.startswith(rule_term):
                return True, 0.9
        elif rule.match_type == "suffix":
            if search_lower.endswith(rule_term):
                return True, 0.9
        elif rule.match_type == "regex":
            import re
            try:
                pattern = re.compile(rule_term)
                if pattern.search(search_lower):
                    return True, 0.85
            except re.error:
                pass
        
        return False, 0.0

    def get_match_summary(self, db: Session, library_id: Optional[int] = None) -> dict:
        blacklist_count = (
            db.query(TermRule)
            .filter(
                TermRule.status == RuleStatus.PRODUCTION,
                TermRule.rule_type == RuleType.BLACKLIST
            )
        )
        if library_id:
            blacklist_count = blacklist_count.filter(TermRule.library_id == library_id)
        blacklist_count = blacklist_count.count()

        whitelist_count = (
            db.query(TermRule)
            .filter(
                TermRule.status == RuleStatus.PRODUCTION,
                TermRule.rule_type == RuleType.WHITELIST
            )
        )
        if library_id:
            whitelist_count = whitelist_count.filter(TermRule.library_id == library_id)
        whitelist_count = whitelist_count.count()

        in_gray_count = (
            db.query(TermRule)
            .filter(TermRule.status == RuleStatus.IN_GRAY)
        )
        if library_id:
            in_gray_count = in_gray_count.filter(TermRule.library_id == library_id)
        in_gray_count = in_gray_count.count()

        return {
            "blacklist_production": blacklist_count,
            "whitelist_production": whitelist_count,
            "in_gray": in_gray_count,
            "total_production": blacklist_count + whitelist_count
        }
