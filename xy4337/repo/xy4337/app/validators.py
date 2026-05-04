from typing import List, Tuple
from datetime import date
from app.models import Work, KilnSession, DrynessStatus
from app.config import settings
from app.schemas import ValidationErrorDetail, ValidationResponse


class KilnValidator:
    
    @staticmethod
    def validate_temperature_zone(
        kiln_session: KilnSession,
        work: Work
    ) -> Tuple[bool, List[ValidationErrorDetail]]:
        errors = []
        
        if work.temperature_zone != kiln_session.target_temperature_zone:
            errors.append(ValidationErrorDetail(
                type="temperature_zone_conflict",
                message=f"作品温区({work.temperature_zone})与窑次温区({kiln_session.target_temperature_zone})不匹配",
                work_ids=[work.id]
            ))
            return False, errors
        
        return True, errors
    
    @staticmethod
    def validate_dryness(
        work: Work
    ) -> Tuple[bool, List[ValidationErrorDetail]]:
        errors = []
        
        if not work.is_dry:
            dryness_msg = {
                DrynessStatus.NOT_DRY: "完全未干燥",
                DrynessStatus.PARTIALLY_DRY: "部分干燥"
            }.get(work.dryness_status, "未干燥")
            
            errors.append(ValidationErrorDetail(
                type="not_dry",
                message=f"作品状态为{dryness_msg}，不适合入窑",
                work_ids=[work.id]
            ))
            return False, errors
        
        return True, errors
    
    @staticmethod
    def validate_glaze_compatibility(
        works: List[Work]
    ) -> Tuple[bool, List[ValidationErrorDetail]]:
        errors = []
        
        glaze_types = [w.glaze_type for w in works if w.glaze_type]
        conflicting_groups = []
        
        for i, glaze in enumerate(glaze_types):
            incompatible = settings.GLAZE_INCOMPATIBILITIES.get(glaze, [])
            for j in range(i + 1, len(glaze_types)):
                if glaze_types[j] in incompatible:
                    conflicting_groups.append((works[i].id, works[j].id, glaze, glaze_types[j]))
        
        for work1_id, work2_id, glaze1, glaze2 in conflicting_groups:
            errors.append(ValidationErrorDetail(
                type="glaze_incompatibility",
                message=f"釉料不兼容: 作品{work1_id}({glaze1})与作品{work2_id}({glaze2})不能同窑",
                work_ids=[work1_id, work2_id]
            ))
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_capacity(
        kiln_session: KilnSession,
        additional_count: int = 1
    ) -> Tuple[bool, List[ValidationErrorDetail]]:
        errors = []
        
        total_load = kiln_session.current_load + additional_count
        
        if total_load > kiln_session.max_capacity:
            errors.append(ValidationErrorDetail(
                type="overloaded",
                message=f"窑次超载: 当前{kiln_session.current_load}件, 新增{additional_count}件, 最大容量{kiln_session.max_capacity}件",
                work_ids=None
            ))
            return False, errors
        
        return True, errors
    
    @staticmethod
    def validate_queue_jump(
        kiln_session: KilnSession,
        work: Work,
        all_sessions: List[KilnSession]
    ) -> Tuple[bool, List[ValidationErrorDetail]]:
        warnings = []
        
        if not work.expected_pickup_date:
            return True, warnings
        
        earlier_sessions = [
            s for s in all_sessions
            if s.id != kiln_session.id
            and not s.is_fired
            and s.scheduled_firing_date < kiln_session.scheduled_firing_date
            and s.current_load < s.max_capacity
        ]
        
        if earlier_sessions:
            warnings.append(ValidationErrorDetail(
                type="queue_jump_risk",
                message=f"存在更早的可用窑次({earlier_sessions[0].session_name})，建议优先安排以避免延期风险",
                work_ids=[work.id]
            ))
        
        return True, warnings
    
    @staticmethod
    def validate_adding_work(
        kiln_session: KilnSession,
        work: Work,
        all_sessions: List[KilnSession]
    ) -> ValidationResponse:
        all_errors = []
        all_warnings = []
        is_valid = True
        
        valid, errors = KilnValidator.validate_temperature_zone(kiln_session, work)
        if not valid:
            all_errors.extend(errors)
            is_valid = False
        
        valid, errors = KilnValidator.validate_dryness(work)
        if not valid:
            all_errors.extend(errors)
            is_valid = False
        
        valid, errors = KilnValidator.validate_capacity(kiln_session, 1)
        if not valid:
            all_errors.extend(errors)
            is_valid = False
        
        current_works = [loading.work for loading in kiln_session.kiln_loadings]
        all_works = current_works + [work]
        valid, errors = KilnValidator.validate_glaze_compatibility(all_works)
        if not valid:
            all_errors.extend(errors)
            is_valid = False
        
        valid, warnings = KilnValidator.validate_queue_jump(kiln_session, work, all_sessions)
        all_warnings.extend(warnings)
        
        return ValidationResponse(
            is_valid=is_valid,
            errors=all_errors,
            warnings=all_warnings
        )
    
    @staticmethod
    def validate_session_consolidation(
        kiln_session: KilnSession
    ) -> ValidationResponse:
        all_errors = []
        all_warnings = []
        is_valid = True
        
        if kiln_session.is_overloaded:
            all_errors.append(ValidationErrorDetail(
                type="overloaded",
                message=f"窑次超载: 当前{kiln_session.current_load}件, 最大容量{kiln_session.max_capacity}件",
                work_ids=None
            ))
            is_valid = False
        
        works = [loading.work for loading in kiln_session.kiln_loadings]
        valid, errors = KilnValidator.validate_glaze_compatibility(works)
        if not valid:
            all_errors.extend(errors)
            is_valid = False
        
        for work in works:
            valid, errors = KilnValidator.validate_dryness(work)
            if not valid:
                all_errors.extend(errors)
                is_valid = False
        
        for work in works:
            valid, errors = KilnValidator.validate_temperature_zone(kiln_session, work)
            if not valid:
                all_errors.extend(errors)
                is_valid = False
        
        return ValidationResponse(
            is_valid=is_valid,
            errors=all_errors,
            warnings=all_warnings
        )
