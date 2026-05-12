import uuid
from datetime import datetime
from typing import List, Optional, Dict, Tuple
from .models import (
    Database, Volunteer, MealTicket, ValidationRecord,
    ShiftType, MealType, PositionType, TicketStatus, ValidationStatus
)
from .storage import StorageManager


class MealTicketService:
    def __init__(self, data_dir: str = "./data"):
        self.storage = StorageManager(data_dir)
        self._db: Optional[Database] = None
    
    @property
    def db(self) -> Database:
        if self._db is None:
            self._db = self.storage.load()
        return self._db
    
    def save(self):
        self.storage.save(self.db)
    
    def init_sample_data(self, force: bool = False) -> Dict[str, int]:
        if self.storage.exists() and not force:
            raise ValueError("数据已存在，使用 --force 覆盖")
        
        self._db = Database()
        
        volunteers = [
            Volunteer(
                id=f"VOL{str(i+1).zfill(4)}",
                name=f"志愿者{i+1}",
                phone=f"138{str(10000000 + i)}",
                position=list(PositionType)[i % len(PositionType)],
                shift=list(ShiftType)[i % len(ShiftType)]
            )
            for i in range(12)
        ]
        self.db.volunteers.extend(volunteers)
        
        tickets = []
        for volunteer in volunteers:
            for meal in [MealType.LUNCH, MealType.DINNER]:
                tickets.append(MealTicket(
                    id=f"TKT{str(len(tickets)+1).zfill(6)}",
                    volunteer_id=volunteer.id,
                    meal_type=meal,
                    shift=volunteer.shift,
                    position=volunteer.position
                ))
        
        self.db.tickets.extend(tickets)
        
        self.save()
        
        return {"volunteers": len(volunteers), "tickets": len(tickets), "validations": 0}
    
    def import_volunteers(self, volunteers_data: List[Dict]) -> Tuple[int, int]:
        added = 0
        updated = 0
        existing_ids = {v.id for v in self.db.volunteers}
        
        for data in volunteers_data:
            volunteer = Volunteer(
                id=data["id"],
                name=data["name"],
                phone=data["phone"],
                position=PositionType(data["position"]),
                shift=ShiftType(data["shift"])
            )
            
            if volunteer.id in existing_ids:
                idx = next(i for i, v in enumerate(self.db.volunteers) if v.id == volunteer.id)
                self.db.volunteers[idx] = volunteer
                updated += 1
            else:
                self.db.volunteers.append(volunteer)
                added += 1
        
        self.save()
        return added, updated
    
    def issue_tickets_for_volunteer(self, volunteer_id: str, meal_types: List[MealType]) -> List[MealTicket]:
        volunteer = self._get_volunteer(volunteer_id)
        if not volunteer:
            raise ValueError(f"志愿者不存在: {volunteer_id}")
        
        existing_meals = {t.meal_type for t in self.db.tickets if t.volunteer_id == volunteer_id}
        new_tickets = []
        
        for meal_type in meal_types:
            if meal_type in existing_meals:
                continue
            
            ticket = MealTicket(
                id=f"TKT{len(self.db.tickets) + 100000:06d}",
                volunteer_id=volunteer_id,
                meal_type=meal_type,
                shift=volunteer.shift,
                position=volunteer.position
            )
            self.db.tickets.append(ticket)
            new_tickets.append(ticket)
        
        self.save()
        return new_tickets
    
    def validate_ticket(self, ticket_id: str, volunteer_id: Optional[str] = None, 
                        current_shift: Optional[ShiftType] = None,
                        current_meal: Optional[MealType] = None) -> ValidationRecord:
        ticket = self._get_ticket(ticket_id)
        if not ticket:
            return self._create_validation_record(
                ticket_id=ticket_id,
                volunteer_id=volunteer_id or "UNKNOWN",
                volunteer_name="未知",
                position=PositionType.SERVICE,
                shift=current_shift or ShiftType.MORNING,
                meal_type=current_meal or MealType.LUNCH,
                status=ValidationStatus.MISSING,
                details=f"餐券不存在"
            )
        
        volunteer = self._get_volunteer(ticket.volunteer_id)
        
        if ticket.status == TicketStatus.USED:
            record = self._create_validation_record(
                ticket_id=ticket.id,
                volunteer_id=volunteer.id if volunteer else ticket.volunteer_id,
                volunteer_name=volunteer.name if volunteer else "未知",
                position=ticket.position,
                shift=ticket.shift,
                meal_type=ticket.meal_type,
                status=ValidationStatus.DUPLICATE,
                details=f"餐券已在 {ticket.used_at} 核销过"
            )
            self.db.validations.append(record)
            self.save()
            return record
        
        if current_shift and current_shift != ticket.shift:
            record = self._create_validation_record(
                ticket_id=ticket.id,
                volunteer_id=volunteer.id if volunteer else ticket.volunteer_id,
                volunteer_name=volunteer.name if volunteer else "未知",
                position=ticket.position,
                shift=ticket.shift,
                meal_type=ticket.meal_type,
                status=ValidationStatus.INVALID_SHIFT,
                details=f"当前班次 {current_shift.value}，餐券班次 {ticket.shift.value}"
            )
            self.db.validations.append(record)
            self.save()
            return record
        
        if current_meal and current_meal != ticket.meal_type:
            record = self._create_validation_record(
                ticket_id=ticket.id,
                volunteer_id=volunteer.id if volunteer else ticket.volunteer_id,
                volunteer_name=volunteer.name if volunteer else "未知",
                position=ticket.position,
                shift=ticket.shift,
                meal_type=ticket.meal_type,
                status=ValidationStatus.INVALID_MEAL,
                details=f"当前餐点 {current_meal.value}，餐券餐点 {ticket.meal_type.value}"
            )
            self.db.validations.append(record)
            self.save()
            return record
        
        ticket.status = TicketStatus.USED
        ticket.used_at = datetime.now().isoformat()
        
        record = self._create_validation_record(
            ticket_id=ticket.id,
            volunteer_id=volunteer.id if volunteer else ticket.volunteer_id,
            volunteer_name=volunteer.name if volunteer else "未知",
            position=ticket.position,
            shift=ticket.shift,
            meal_type=ticket.meal_type,
            status=ValidationStatus.NORMAL,
            details="核销成功"
        )
        self.db.validations.append(record)
        self.save()
        return record
    
    def check_anomalies(self) -> Dict[str, list]:
        anomalies = {
            "duplicates": [],
            "missing_tickets": [],
            "invalid_shifts": [],
            "invalid_meals": []
        }
        
        used_tickets = {}
        for record in self.db.validations:
            key = record.ticket_id
            if record.validation_status == ValidationStatus.DUPLICATE:
                anomalies["duplicates"].append(record)
        
        for volunteer in self.db.volunteers:
            volunteer_tickets = [t for t in self.db.tickets if t.volunteer_id == volunteer.id]
            expected_meals = self._get_expected_meals(volunteer.shift)
            actual_meals = {t.meal_type for t in volunteer_tickets}
            missing = expected_meals - actual_meals
            if missing:
                anomalies["missing_tickets"].append({
                    "volunteer": volunteer,
                    "missing_meals": list(missing)
                })
        
        anomalies["invalid_shifts"] = [
            r for r in self.db.validations if r.validation_status == ValidationStatus.INVALID_SHIFT]
        anomalies["invalid_meals"] = [
            r for r in self.db.validations if r.validation_status == ValidationStatus.INVALID_MEAL]
        
        return anomalies
    
    def generate_report(self) -> Dict:
        total_volunteers = len(self.db.volunteers)
        total_tickets = len(self.db.tickets)
        used_tickets = len([t for t in self.db.tickets if t.status == TicketStatus.USED])
        unused_tickets = total_tickets - used_tickets
        
        status_counts = {}
        for record in self.db.validations:
            status = record.validation_status.value
            status_counts[status] = status_counts.get(status, 0) + 1
        
        anomalies = self.check_anomalies()
        
        return {
            "summary": {
                "total_volunteers": total_volunteers,
                "total_tickets": total_tickets,
                "used_tickets": used_tickets,
                "unused_tickets": unused_tickets,
                "validation_count": len(self.db.validations)
            },
            "validation_status": status_counts,
            "anomalies_summary": {
                "duplicate_count": len(anomalies["duplicates"]),
                "missing_count": len(anomalies["missing_tickets"]),
                "invalid_shift_count": len(anomalies["invalid_shifts"]),
                "invalid_meal_count": len(anomalies["invalid_meals"])
            },
            "details": anomalies
        }
    
    def get_validation_history(self, limit: Optional[int] = None) -> List[ValidationRecord]:
        history = sorted(self.db.validations, key=lambda r: r.validation_time, reverse=True)
        if limit:
            return history[:limit]
        return history
    
    def export_data(self, format_type: str) -> Dict:
        if format_type == "json":
            return self.db.to_dict()
        else:
            raise ValueError(f"不支持的导出格式: {format_type}")
    
    def _get_volunteer(self, volunteer_id: str) -> Optional[Volunteer]:
        return next((v for v in self.db.volunteers if v.id == volunteer_id), None)
    
    def _get_ticket(self, ticket_id: str) -> Optional[MealTicket]:
        return next((t for t in self.db.tickets if t.id == ticket_id), None)
    
    def _create_validation_record(self, ticket_id: str, volunteer_id: str, 
                                volunteer_name: str,
                                position: PositionType,
                                shift: ShiftType,
                                meal_type: MealType,
                                status: ValidationStatus,
                                details: str) -> ValidationRecord:
        return ValidationRecord(
            id=str(uuid.uuid4()),
            ticket_id=ticket_id,
            volunteer_id=volunteer_id,
            volunteer_name=volunteer_name,
            position=position,
            shift=shift,
            meal_type=meal_type,
            validation_time=datetime.now().isoformat(),
            validation_status=status,
            details=details
        )
    
    def _get_expected_meals(self, shift: ShiftType) -> set:
        meal_map = {
            ShiftType.MORNING: {MealType.LUNCH},
            ShiftType.AFTERNOON: {MealType.LUNCH, MealType.DINNER},
            ShiftType.EVENING: {MealType.DINNER, MealType.MIDNIGHT_SNACK},
            ShiftType.NIGHT: {MealType.MIDNIGHT_SNACK}
        }
        return meal_map.get(shift, set())
