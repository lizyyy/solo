import pytest
import os
import tempfile
import shutil

from meal_ticket.service import MealTicketService
from meal_ticket.models import (
    Volunteer, MealTicket, ValidationRecord,
    ShiftType, MealType, PositionType, TicketStatus, ValidationStatus
)


@pytest.fixture
def temp_data_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def service(temp_data_dir):
    return MealTicketService(temp_data_dir)


class TestModels:
    def test_volunteer_creation(self):
        volunteer = Volunteer(
            id="VOL0001",
            name="测试志愿者",
            phone="13800138000",
            position=PositionType.REGISTRATION,
            shift=ShiftType.MORNING
        )
        
        assert volunteer.id == "VOL0001"
        assert volunteer.name == "测试志愿者"
        assert volunteer.position == PositionType.REGISTRATION
        assert volunteer.shift == ShiftType.MORNING
    
    def test_meal_ticket_creation(self):
        ticket = MealTicket(
            id="TKT000001",
            volunteer_id="VOL0001",
            meal_type=MealType.LUNCH,
            shift=ShiftType.MORNING,
            position=PositionType.REGISTRATION
        )
        
        assert ticket.id == "TKT000001"
        assert ticket.status == TicketStatus.UNUSED
        assert ticket.used_at is None
    
    def test_validation_record_creation(self):
        record = ValidationRecord(
            id="test-123",
            ticket_id="TKT000001",
            volunteer_id="VOL0001",
            volunteer_name="测试志愿者",
            position=PositionType.REGISTRATION,
            shift=ShiftType.MORNING,
            meal_type=MealType.LUNCH,
            validation_time="2024-01-01T12:00:00",
            validation_status=ValidationStatus.NORMAL,
            details="测试核销"
        )
        
        assert record.validation_status == ValidationStatus.NORMAL
        assert record.ticket_id == "TKT000001"


class TestService:
    def test_init_sample_data(self, service):
        result = service.init_sample_data()
        
        assert result["volunteers"] == 12
        assert result["tickets"] == 24
        assert result["validations"] == 0
        
        assert len(service.db.volunteers) == 12
        assert len(service.db.tickets) == 24
    
    def test_init_sample_data_force(self, service):
        service.init_sample_data()
        result = service.init_sample_data(force=True)
        
        assert result["volunteers"] == 12
        assert len(service.db.volunteers) == 12
    
    def test_init_sample_data_no_force_error(self, service):
        service.init_sample_data()
        
        with pytest.raises(ValueError, match="数据已存在"):
            service.init_sample_data()
    
    def test_import_volunteers(self, service):
        volunteers_data = [
            {
                "id": "TEST001",
                "name": "新志愿者1",
                "phone": "13900139000",
                "position": "签到组",
                "shift": "早班"
            },
            {
                "id": "TEST002",
                "name": "新志愿者2",
                "phone": "13900139001",
                "position": "安保组",
                "shift": "中班"
            }
        ]
        
        added, updated = service.import_volunteers(volunteers_data)
        
        assert added == 2
        assert updated == 0
        assert len(service.db.volunteers) == 2
    
    def test_issue_tickets_for_volunteer(self, service):
        service.db.volunteers.append(Volunteer(
            id="VOL001",
            name="测试",
            phone="13800138000",
            position=PositionType.REGISTRATION,
            shift=ShiftType.MORNING
        ))
        service.save()
        
        tickets = service.issue_tickets_for_volunteer("VOL001", [MealType.LUNCH])
        
        assert len(tickets) == 1
        assert tickets[0].volunteer_id == "VOL001"
        assert tickets[0].meal_type == MealType.LUNCH
        assert tickets[0].shift == ShiftType.MORNING
    
    def test_issue_tickets_duplicate(self, service):
        service.db.volunteers.append(Volunteer(
            id="VOL001",
            name="测试",
            phone="13800138000",
            position=PositionType.REGISTRATION,
            shift=ShiftType.MORNING
        ))
        service.save()
        
        tickets1 = service.issue_tickets_for_volunteer("VOL001", [MealType.LUNCH])
        tickets2 = service.issue_tickets_for_volunteer("VOL001", [MealType.LUNCH])
        
        assert len(tickets1) == 1
        assert len(tickets2) == 0


class TestValidation:
    def test_normal_validation(self, service):
        service.init_sample_data()
        
        ticket = service.db.tickets[0]
        record = service.validate_ticket(ticket.id)
        
        assert record.validation_status == ValidationStatus.NORMAL
        assert record.ticket_id == ticket.id
        
        updated_ticket = service._get_ticket(ticket.id)
        assert updated_ticket.status == TicketStatus.USED
        assert updated_ticket.used_at is not None
    
    def test_duplicate_validation(self, service):
        service.init_sample_data()
        
        ticket = service.db.tickets[0]
        
        record1 = service.validate_ticket(ticket.id)
        assert record1.validation_status == ValidationStatus.NORMAL
        
        record2 = service.validate_ticket(ticket.id)
        assert record2.validation_status == ValidationStatus.DUPLICATE
        assert "已在" in record2.details
    
    def test_invalid_shift_validation(self, service):
        service.init_sample_data()
        
        ticket = service.db.tickets[0]
        record = service.validate_ticket(ticket.id, current_shift=ShiftType.EVENING)
        
        assert record.validation_status == ValidationStatus.INVALID_SHIFT
        assert "当前班次" in record.details
    
    def test_invalid_meal_validation(self, service):
        service.init_sample_data()
        
        ticket = service.db.tickets[0]
        current_meal = MealType.DINNER if ticket.meal_type == MealType.LUNCH else MealType.LUNCH
        
        record = service.validate_ticket(ticket.id, current_meal=current_meal)
        
        assert record.validation_status == ValidationStatus.INVALID_MEAL
        assert "当前餐点" in record.details
    
    def test_missing_ticket_validation(self, service):
        service.init_sample_data()
        
        record = service.validate_ticket("TKT999999")
        
        assert record.validation_status == ValidationStatus.MISSING
        assert "餐券不存在" in record.details


class TestAnomalyDetection:
    def test_check_anomalies_duplicates(self, service):
        service.init_sample_data()
        
        ticket = service.db.tickets[0]
        service.validate_ticket(ticket.id)
        service.validate_ticket(ticket.id)
        
        anomalies = service.check_anomalies()
        
        assert len(anomalies["duplicates"]) == 1
    
    def test_check_anomalies_missing_tickets(self, service):
        service.init_sample_data()
        
        volunteer = service.db.volunteers[0]
        volunteer_tickets = [t for t in service.db.tickets if t.volunteer_id == volunteer.id]
        for t in volunteer_tickets:
            service.db.tickets.remove(t)
        service.save()
        
        anomalies = service.check_anomalies()
        
        assert len(anomalies["missing_tickets"]) > 0
    
    def test_generate_report(self, service):
        service.init_sample_data()
        
        ticket = service.db.tickets[0]
        service.validate_ticket(ticket.id)
        service.validate_ticket(ticket.id)
        
        report = service.generate_report()
        
        assert report["summary"]["total_volunteers"] == 12
        assert report["summary"]["validation_count"] == 2
        assert "重复核销" in report["validation_status"]


class TestHistory:
    def test_get_validation_history(self, service):
        service.init_sample_data()
        
        ticket1 = service.db.tickets[0]
        ticket2 = service.db.tickets[1]
        
        service.validate_ticket(ticket1.id)
        service.validate_ticket(ticket2.id)
        
        history = service.get_validation_history()
        
        assert len(history) == 2
        assert history[0].validation_time > history[1].validation_time
    
    def test_get_validation_history_limit(self, service):
        service.init_sample_data()
        
        for i in range(5):
            service.validate_ticket(service.db.tickets[i].id)
        
        history = service.get_validation_history(limit=3)
        
        assert len(history) == 3


class TestExport:
    def test_export_data(self, service):
        service.init_sample_data()
        
        data = service.export_data("json")
        
        assert "volunteers" in data
        assert "tickets" in data
        assert "validations" in data
        assert len(data["volunteers"]) == 12
