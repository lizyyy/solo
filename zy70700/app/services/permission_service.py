from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import (
    PermissionDeclaration,
    ActualCall,
    MatchStatus,
    Tool,
)
from app.schemas import (
    PermissionDeclarationCreate,
    PermissionDeclarationUpdate,
    ActualCallCreate,
    PermissionMatchResult,
)


class PermissionService:
    @staticmethod
    def create_declaration(
        db: Session, declaration: PermissionDeclarationCreate
    ) -> PermissionDeclaration:
        db_declaration = PermissionDeclaration(**declaration.model_dump())
        db.add(db_declaration)
        db.commit()
        db.refresh(db_declaration)
        return db_declaration

    @staticmethod
    def get_declaration(db: Session, declaration_id: int) -> Optional[PermissionDeclaration]:
        return db.query(PermissionDeclaration).filter(PermissionDeclaration.id == declaration_id).first()

    @staticmethod
    def get_declarations_by_tool(db: Session, tool_id: int) -> List[PermissionDeclaration]:
        return db.query(PermissionDeclaration).filter(PermissionDeclaration.tool_id == tool_id).all()

    @staticmethod
    def get_active_declarations(db: Session) -> List[PermissionDeclaration]:
        return db.query(PermissionDeclaration).filter(PermissionDeclaration.is_active == True).all()

    @staticmethod
    def update_declaration(
        db: Session, declaration_id: int, declaration_update: PermissionDeclarationUpdate
    ) -> Optional[PermissionDeclaration]:
        db_declaration = PermissionService.get_declaration(db, declaration_id)
        if not db_declaration:
            return None
        update_data = declaration_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_declaration, key, value)
        db_declaration.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_declaration)
        return db_declaration

    @staticmethod
    def deactivate_declaration(db: Session, declaration_id: int) -> Optional[PermissionDeclaration]:
        db_declaration = PermissionService.get_declaration(db, declaration_id)
        if not db_declaration:
            return None
        db_declaration.is_active = False
        db_declaration.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_declaration)
        return db_declaration

    @staticmethod
    def _calculate_match_score(declared: List[str], actual: List[str]) -> tuple:
        if not declared:
            declared_set = set()
        else:
            declared_set = set(declared)
        
        if not actual:
            actual_set = set()
        else:
            actual_set = set(actual)
        
        intersection = declared_set.intersection(actual_set)
        union = declared_set.union(actual_set)
        
        if not union:
            return 100, "both_empty"
        
        match_percent = len(intersection) / len(union) * 100
        return int(match_percent), {
            "declared": list(declared_set),
            "actual": list(actual_set),
            "matched": list(intersection),
            "unmatched_declared": list(declared_set - actual_set),
            "unmatched_actual": list(actual_set - declared_set),
        }

    @staticmethod
    def compare_permissions(
        db: Session, declaration_id: int
    ) -> Optional[PermissionMatchResult]:
        declaration = PermissionService.get_declaration(db, declaration_id)
        if not declaration:
            return None

        actual_calls = db.query(ActualCall).filter(
            ActualCall.tool_id == declaration.tool_id
        ).all()

        if not actual_calls:
            declaration.match_status = MatchStatus.UNCHECKED
            declaration.match_score = 0
            declaration.match_details = {"reason": "no_actual_calls"}
            db.commit()
            return PermissionMatchResult(
                declaration_id=declaration_id,
                match_status=MatchStatus.UNCHECKED,
                match_score=0,
                match_details={"reason": "no_actual_calls"},
            )

        all_actual_scopes = set()
        all_actual_resources = set()
        all_actual_actions = set()

        for call in actual_calls:
            if call.actual_scopes:
                all_actual_scopes.update(call.actual_scopes)
            if call.actual_resources:
                all_actual_resources.update(call.actual_resources)
            if call.actual_actions:
                all_actual_actions.update(call.actual_actions)

        scope_score, scope_details = PermissionService._calculate_match_score(
            declaration.declared_scopes or [], list(all_actual_scopes)
        )
        
        resource_score, resource_details = PermissionService._calculate_match_score(
            declaration.declared_resources or [], list(all_actual_resources)
        )
        
        action_score, action_details = PermissionService._calculate_match_score(
            declaration.declared_actions or [], list(all_actual_actions)
        )

        overall_score = int((scope_score + resource_score + action_score) / 3)

        if overall_score == 100:
            match_status = MatchStatus.MATCHED
        elif overall_score >= 50:
            match_status = MatchStatus.PARTIAL
        else:
            match_status = MatchStatus.MISMATCHED

        match_details = {
            "scope": scope_details,
            "resource": resource_details,
            "action": action_details,
            "scope_score": scope_score,
            "resource_score": resource_score,
            "action_score": action_score,
            "overall_score": overall_score,
        }

        declaration.match_status = match_status
        declaration.match_score = overall_score
        declaration.match_details = match_details
        db.commit()

        return PermissionMatchResult(
            declaration_id=declaration_id,
            match_status=match_status,
            match_score=overall_score,
            match_details=match_details,
        )

    @staticmethod
    def record_actual_call(db: Session, call: ActualCallCreate) -> ActualCall:
        existing = db.query(ActualCall).filter(ActualCall.call_id == call.call_id).first()
        if existing:
            return existing
        
        db_call = ActualCall(**call.model_dump())
        db.add(db_call)
        db.commit()
        db.refresh(db_call)
        return db_call

    @staticmethod
    def archive_call(db: Session, call_id: str) -> Optional[ActualCall]:
        db_call = db.query(ActualCall).filter(ActualCall.call_id == call_id).first()
        if not db_call:
            return None
        db_call.archived = True
        db_call.archived_at = datetime.utcnow()
        db.commit()
        db.refresh(db_call)
        return db_call

    @staticmethod
    def get_calls_by_tool(db: Session, tool_id: int, include_archived: bool = False) -> List[ActualCall]:
        query = db.query(ActualCall).filter(ActualCall.tool_id == tool_id)
        if not include_archived:
            query = query.filter(ActualCall.archived == False)
        return query.all()

    @staticmethod
    def get_call(db: Session, call_id: str) -> Optional[ActualCall]:
        return db.query(ActualCall).filter(ActualCall.call_id == call_id).first()
