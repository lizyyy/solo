from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
from datetime import datetime
import pandas as pd
from io import BytesIO

from models import HazardStatus, OperationType, BatchStatus, Hazard
from schemas import (
    HazardCreate, HazardUpdate, ResponsiblePersonCreate, RectificationCreate,
    RecheckCreate, BatchOperationResult, BatchItemResult, HazardFilter,
    HazardExportRow
)
from repositories import (
    HazardRepository, ResponsiblePersonRepository, RectificationRepository,
    RecheckRepository, BatchOperationRepository
)
from rules import RuleEngine


class HazardService:
    def __init__(self, db: Session):
        self.db = db
        self.hazard_repo = HazardRepository(db)
        self.person_repo = ResponsiblePersonRepository(db)
        self.rectification_repo = RectificationRepository(db)
        self.recheck_repo = RecheckRepository(db)
        self.rule_engine = RuleEngine(db)

    def create_hazard(self, data: HazardCreate, operator: str = "system") -> Hazard:
        hazard = self.hazard_repo.create(data)
        
        if data.responsible_person_id:
            self.hazard_repo.update_status(hazard.id, HazardStatus.ASSIGNED, operator)
        
        self.rule_engine.check_hazard(hazard.id, "import_check")
        
        self.db.commit()
        return self.hazard_repo.get_by_id(hazard.id)

    def update_hazard(self, hazard_id: int, data: HazardUpdate, operator: str = "system") -> Optional[Hazard]:
        hazard = self.hazard_repo.update(hazard_id, data)
        
        if data.responsible_person_id and hazard.status == HazardStatus.PENDING:
            self.hazard_repo.update_status(hazard_id, HazardStatus.ASSIGNED, operator)
        
        self.db.commit()
        return self.hazard_repo.get_by_id(hazard_id)

    def assign_responsible_person(self, hazard_id: int, person_id: int, 
                                  operator: str = "system") -> Optional[Hazard]:
        hazard = self.hazard_repo.update(
            hazard_id, 
            HazardUpdate(responsible_person_id=person_id)
        )
        
        if hazard:
            self.hazard_repo.update_status(hazard_id, HazardStatus.ASSIGNED, operator)
            self.rule_engine.check_hazard(hazard_id, "assign_check")
            self.db.commit()
        
        return self.hazard_repo.get_by_id(hazard_id)

    def start_rectification(self, hazard_id: int, operator: str = "system") -> Optional[Hazard]:
        hazard = self.hazard_repo.update_status(hazard_id, HazardStatus.RECTIFYING, operator)
        self.db.commit()
        return hazard

    def submit_rectification(self, hazard_id: int, data: RectificationCreate,
                            operator: str = "system") -> Optional[Hazard]:
        self.rectification_repo.create(hazard_id, data)
        hazard = self.hazard_repo.update_status(hazard_id, HazardStatus.RECHECKING, operator)
        self.db.commit()
        return hazard

    def submit_recheck(self, hazard_id: int, data: RecheckCreate,
                      operator: str = "system") -> Optional[Hazard]:
        recheck = self.recheck_repo.create(hazard_id, data)
        
        if recheck.result:
            can_close, messages = self.rule_engine.can_close_hazard(hazard_id)
            if can_close:
                self.hazard_repo.update_status(hazard_id, HazardStatus.CLOSED, operator)
            else:
                self.hazard_repo.update_status(hazard_id, HazardStatus.RECTIFYING, operator)
        else:
            self.hazard_repo.update_status(hazard_id, HazardStatus.RECTIFYING, operator)
        
        self.db.commit()
        return self.hazard_repo.get_by_id(hazard_id)

    def close_hazard(self, hazard_id: int, operator: str = "system") -> tuple[bool, List[str], Optional[Hazard]]:
        can_close, messages = self.rule_engine.can_close_hazard(hazard_id)
        
        if not can_close:
            return False, messages, None
        
        hazard = self.hazard_repo.update_status(hazard_id, HazardStatus.CLOSED, operator)
        self.db.commit()
        return True, [], hazard

    def get_hazard(self, hazard_id: int) -> Optional[Hazard]:
        return self.hazard_repo.get_by_id(hazard_id)

    def get_hazard_by_code(self, hazard_code: str) -> Optional[Hazard]:
        return self.hazard_repo.get_by_code(hazard_code)

    def list_hazards(self, filter_params: Optional[HazardFilter] = None,
                    skip: int = 0, limit: int = 100) -> List[Hazard]:
        return self.hazard_repo.list(filter_params, skip, limit)

    def count_hazards(self, filter_params: Optional[HazardFilter] = None) -> int:
        return self.hazard_repo.count(filter_params)

    def delete_hazard(self, hazard_id: int, operator: str = "system") -> bool:
        result = self.hazard_repo.delete(hazard_id, operator)
        self.db.commit()
        return result


class BatchOperationService:
    def __init__(self, db: Session):
        self.db = db
        self.hazard_service = HazardService(db)
        self.batch_repo = BatchOperationRepository(db)
        self.person_repo = ResponsiblePersonRepository(db)

    def import_hazards(self, hazard_data_list: List[Dict[str, Any]],
                      operator: str = "", remark: str = "") -> BatchOperationResult:
        batch = self.batch_repo.create(
            operation_type=OperationType.IMPORT,
            total_count=len(hazard_data_list),
            operator=operator,
            remark=remark
        )
        
        self.batch_repo.update_status(batch.id, BatchStatus.PROCESSING)
        
        success_count = 0
        failed_count = 0
        item_results = []

        for idx, data in enumerate(hazard_data_list):
            try:
                self.db.begin_nested()
                
                responsible_person_id = None
                if "responsible_person" in data and data["responsible_person"]:
                    person_name = data["responsible_person"]
                    person = self.person_repo.get_by_name(person_name)
                    if not person:
                        person = self.person_repo.create(
                            ResponsiblePersonCreate(name=person_name)
                        )
                    responsible_person_id = person.id
                
                photos = []
                if "photos" in data and data["photos"]:
                    photos = data["photos"]
                
                hazard_data = HazardCreate(
                    title=data.get("title", ""),
                    description=data.get("description", ""),
                    location=data.get("location", ""),
                    location_detail=data.get("location_detail", ""),
                    level=data.get("level", "medium"),
                    discoverer=data.get("discoverer", ""),
                    deadline=data.get("deadline"),
                    department=data.get("department", ""),
                    team=data.get("team", ""),
                    responsible_person_id=responsible_person_id,
                    photos=photos
                )
                
                hazard = self.hazard_service.create_hazard(hazard_data, operator)
                
                rule_checks = []
                for r in hazard.rule_check_results:
                    rule_checks.append({
                        "rule_code": r.rule_code,
                        "rule_name": r.rule_name,
                        "passed": r.passed,
                        "message": r.message,
                        "check_stage": r.check_stage,
                        "hazard_id": r.hazard_id,
                        "id": r.id,
                        "check_time": r.check_time
                    })
                
                self.batch_repo.add_item(
                    batch_id=batch.id,
                    row_index=idx,
                    row_data=json.dumps(data, ensure_ascii=False, default=str),
                    hazard_id=hazard.id,
                    success=True,
                    error_message=None
                )
                
                success_count += 1
                item_results.append(BatchItemResult(
                    row_index=idx,
                    success=True,
                    hazard_id=hazard.id,
                    hazard_code=hazard.hazard_code,
                    error_message=None,
                    rule_checks=rule_checks
                ))
                
                self.db.commit()
                
            except Exception as e:
                self.db.rollback()
                
                self.batch_repo.add_item(
                    batch_id=batch.id,
                    row_index=idx,
                    row_data=json.dumps(data, ensure_ascii=False, default=str),
                    hazard_id=None,
                    success=False,
                    error_message=str(e)
                )
                
                failed_count += 1
                item_results.append(BatchItemResult(
                    row_index=idx,
                    success=False,
                    hazard_id=None,
                    hazard_code=None,
                    error_message=str(e)
                ))

        if failed_count == 0:
            final_status = BatchStatus.SUCCESS
        elif success_count > 0:
            final_status = BatchStatus.PARTIAL_SUCCESS
        else:
            final_status = BatchStatus.FAILED

        self.batch_repo.update_status(
            batch.id, 
            final_status,
            success_count=success_count,
            failed_count=failed_count
        )
        
        self.db.commit()

        batch = self.batch_repo.get_by_id(batch.id)
        return BatchOperationResult(
            batch_no=batch.batch_no,
            operation_type=batch.operation_type,
            status=final_status,
            total_count=batch.total_count,
            success_count=success_count,
            failed_count=failed_count,
            items=item_results,
            operator=batch.operator,
            operate_time=batch.operate_time
        )

    def retry_failed_items(self, batch_no: str, operator: str = "") -> BatchOperationResult:
        batch = self.batch_repo.get_by_batch_no(batch_no)
        if not batch:
            raise ValueError(f"Batch {batch_no} not found")

        failed_items = self.batch_repo.get_failed_items(batch.id)
        if not failed_items:
            return BatchOperationResult(
                batch_no=batch.batch_no,
                operation_type=batch.operation_type,
                status=batch.status,
                total_count=batch.total_count,
                success_count=batch.success_count,
                failed_count=batch.failed_count,
                items=[],
                operator=operator,
                operate_time=datetime.utcnow()
            )

        new_success_count = batch.success_count
        new_failed_count = batch.failed_count
        item_results = []

        for item in failed_items:
            try:
                self.db.begin_nested()
                
                data = json.loads(item.row_data)
                
                responsible_person_id = None
                if "responsible_person" in data and data["responsible_person"]:
                    person_name = data["responsible_person"]
                    person = self.person_repo.get_by_name(person_name)
                    if not person:
                        person = self.person_repo.create(
                            ResponsiblePersonCreate(name=person_name)
                        )
                    responsible_person_id = person.id
                
                photos = []
                if "photos" in data and data["photos"]:
                    photos = data["photos"]
                
                hazard_data = HazardCreate(
                    title=data.get("title", ""),
                    description=data.get("description", ""),
                    location=data.get("location", ""),
                    location_detail=data.get("location_detail", ""),
                    level=data.get("level", "medium"),
                    discoverer=data.get("discoverer", ""),
                    deadline=data.get("deadline"),
                    department=data.get("department", ""),
                    team=data.get("team", ""),
                    responsible_person_id=responsible_person_id,
                    photos=photos
                )
                
                hazard = self.hazard_service.create_hazard(hazard_data, operator)
                
                rule_checks = []
                for r in hazard.rule_check_results:
                    rule_checks.append({
                        "rule_code": r.rule_code,
                        "rule_name": r.rule_name,
                        "passed": r.passed,
                        "message": r.message,
                        "check_stage": r.check_stage,
                        "hazard_id": r.hazard_id,
                        "id": r.id,
                        "check_time": r.check_time
                    })
                
                self.batch_repo.update_item(
                    item_id=item.id,
                    success=True,
                    error_message=None,
                    hazard_id=hazard.id
                )
                
                new_success_count += 1
                new_failed_count -= 1
                item_results.append(BatchItemResult(
                    row_index=item.row_index,
                    success=True,
                    hazard_id=hazard.id,
                    hazard_code=hazard.hazard_code,
                    error_message=None,
                    rule_checks=rule_checks
                ))
                
                self.db.commit()
                
            except Exception as e:
                self.db.rollback()
                
                self.batch_repo.update_item(
                    item_id=item.id,
                    success=False,
                    error_message=str(e),
                    hazard_id=item.hazard_id
                )
                
                item_results.append(BatchItemResult(
                    row_index=item.row_index,
                    success=False,
                    hazard_id=item.hazard_id,
                    hazard_code=None,
                    error_message=str(e)
                ))

        if new_failed_count == 0:
            final_status = BatchStatus.SUCCESS
        elif new_success_count > 0:
            final_status = BatchStatus.PARTIAL_SUCCESS
        else:
            final_status = BatchStatus.FAILED

        self.batch_repo.update_status(
            batch.id,
            final_status,
            success_count=new_success_count,
            failed_count=new_failed_count
        )
        
        self.db.commit()

        batch = self.batch_repo.get_by_id(batch.id)
        return BatchOperationResult(
            batch_no=batch.batch_no,
            operation_type=batch.operation_type,
            status=final_status,
            total_count=batch.total_count,
            success_count=new_success_count,
            failed_count=new_failed_count,
            items=item_results,
            operator=operator,
            operate_time=datetime.utcnow()
        )

    def get_batch_result(self, batch_no: str) -> Optional[BatchOperationResult]:
        batch = self.batch_repo.get_by_batch_no(batch_no)
        if not batch:
            return None

        items = []
        for item in batch.items:
            hazard_code = None
            if item.hazard_id:
                hazard = self.hazard_service.get_hazard(item.hazard_id)
                if hazard:
                    hazard_code = hazard.hazard_code

            items.append(BatchItemResult(
                row_index=item.row_index,
                success=item.success,
                hazard_id=item.hazard_id,
                hazard_code=hazard_code,
                error_message=item.error_message,
                rule_checks=[]
            ))

        return BatchOperationResult(
            batch_no=batch.batch_no,
            operation_type=batch.operation_type,
            status=batch.status,
            total_count=batch.total_count,
            success_count=batch.success_count,
            failed_count=batch.failed_count,
            items=items,
            operator=batch.operator,
            operate_time=batch.operate_time
        )


class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self.hazard_repo = HazardRepository(db)

    def export_hazards(self, filter_params: Optional[HazardFilter] = None) -> List[HazardExportRow]:
        hazards = self.hazard_repo.list(filter_params, limit=10000)
        
        export_rows = []
        for hazard in hazards:
            has_exception = any(not r.passed for r in hazard.rule_check_results)
            latest_rule = sorted(hazard.rule_check_results, key=lambda x: x.check_time, reverse=True)
            latest_rule_message = latest_rule[0].message if latest_rule else ""
            
            responsible_name = hazard.responsible_person.name if hazard.responsible_person else ""
            
            export_rows.append(HazardExportRow(
                hazard_code=hazard.hazard_code,
                title=hazard.title,
                description=hazard.description or "",
                location=hazard.location or "",
                location_detail=hazard.location_detail or "",
                level=hazard.level.value if hasattr(hazard.level, 'value') else str(hazard.level),
                status=hazard.status.value if hasattr(hazard.status, 'value') else str(hazard.status),
                discover_time=hazard.discover_time.strftime("%Y-%m-%d %H:%M:%S") if hazard.discover_time else "",
                discoverer=hazard.discoverer or "",
                deadline=hazard.deadline.strftime("%Y-%m-%d") if hazard.deadline else "",
                actual_close_time=hazard.actual_close_time.strftime("%Y-%m-%d %H:%M:%S") if hazard.actual_close_time else "",
                responsible_person=responsible_name,
                department=hazard.department or "",
                team=hazard.team or "",
                photo_count=len([p for p in hazard.photos if not p.is_deleted]),
                rectification_count=len(hazard.rectifications),
                recheck_count=len(hazard.rechecks),
                is_closed="是" if hazard.status == HazardStatus.CLOSED else "否",
                has_exception="是" if has_exception else "否",
                latest_rule_message=latest_rule_message
            ))
        
        return export_rows

    def export_to_excel(self, filter_params: Optional[HazardFilter] = None, output_path: str = None) -> bytes:
        export_rows = self.export_hazards(filter_params)
        
        df_data = []
        for row in export_rows:
            df_data.append({
                "隐患编号": row.hazard_code,
                "隐患标题": row.title,
                "隐患描述": row.description,
                "隐患位置": row.location,
                "位置详情": row.location_detail,
                "隐患等级": row.level,
                "隐患状态": row.status,
                "发现时间": row.discover_time,
                "发现人": row.discoverer,
                "整改期限": row.deadline,
                "闭环时间": row.actual_close_time,
                "整改责任人": row.responsible_person,
                "所属部门": row.department,
                "所属班组": row.team,
                "照片数量": row.photo_count,
                "整改记录数": row.rectification_count,
                "复查记录数": row.recheck_count,
                "是否闭环": row.is_closed,
                "是否异常": row.has_exception,
                "最新规则提示": row.latest_rule_message
            })
        
        df = pd.DataFrame(df_data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='隐患清单', index=False)
        
        output.seek(0)
        excel_bytes = output.read()
        
        if output_path:
            with open(output_path, 'wb') as f:
                f.write(excel_bytes)
        
        return excel_bytes

    def get_statistics(self, filter_params: Optional[HazardFilter] = None) -> Dict[str, Any]:
        total = self.hazard_repo.count(filter_params)
        
        closed_filter = HazardFilter(**(filter_params.model_dump() if filter_params else {}))
        closed_filter.is_closed = True
        closed_count = self.hazard_repo.count(closed_filter)
        
        open_filter = HazardFilter(**(filter_params.model_dump() if filter_params else {}))
        open_filter.is_closed = False
        open_count = self.hazard_repo.count(open_filter)
        
        status_counts = {}
        for status in HazardStatus:
            status_filter = HazardFilter(**(filter_params.model_dump() if filter_params else {}))
            status_filter.status = status
            status_counts[status.value] = self.hazard_repo.count(status_filter)
        
        return {
            "total": total,
            "closed": closed_count,
            "open": open_count,
            "closed_rate": round(closed_count / total * 100, 2) if total > 0 else 0,
            "status_distribution": status_counts
        }
