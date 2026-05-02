import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, BatteryPack, ChargeRecord, FlightRecord, CellVoltageReading, MaintenanceNote, QuarantineRecord, SystemConfig
from app.services.csv_parser import ChargerCSVParser, FlightLogCSVParser, CellVoltageCSVParser, CSVParseError
from app.services.record_merger import RecordMerger, QuarantineService
from app.services.rules_engine import ReleaseRulesEngine, ReleaseStatus
from app.services.report_exporter import ReportExporter


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


class TestCSVParser:
    def test_charger_csv_parser_basic(self):
        parser = ChargerCSVParser()
        
        csv_content = """battery_id,charge_start_time,charge_end_time,start_voltage,end_voltage,cycle_count
BAT001,2024-01-15 08:00:00,2024-01-15 09:30:00,22.5,25.2,15
BAT002,2024-01-15 10:00:00,2024-01-15 11:45:00,22.8,25.2,23"""
        
        parsed, errors = parser.parse_file(csv_content)
        
        assert len(errors) == 0
        assert len(parsed) == 2
        assert parsed[0]['battery_id'] == 'BAT001'
        assert parsed[0]['cycle_count'] == 15
        assert parsed[0]['charge_start_time'] is not None
    
    def test_flight_csv_parser_with_low_alert(self):
        parser = FlightLogCSVParser()
        
        csv_content = """battery_id,flight_date,flight_duration_min,start_voltage,end_voltage,min_voltage,cycle_count,low_voltage_alert,alert_value
BAT001,2024-01-16 14:00:00,25,25.0,22.2,21.5,16,是,21.5"""
        
        parsed, errors = parser.parse_file(csv_content)
        
        assert len(errors) == 0
        assert len(parsed) == 1
        assert parsed[0]['has_low_voltage_alert'] == True
        assert parsed[0]['min_voltage'] == 21.5
        assert parsed[0]['low_voltage_alert_value'] == 21.5
    
    def test_cell_voltage_parser_calculates_diff(self):
        parser = CellVoltageCSVParser()
        
        csv_content = """battery_id,reading_time,cell_1,cell_2,cell_3,cell_4,cell_5,cell_6
BAT001,2024-01-16 20:00:00,3.85,3.84,3.86,3.85,3.83,3.85"""
        
        parsed, errors = parser.parse_file(csv_content)
        
        assert len(errors) == 0
        assert len(parsed) == 1
        assert parsed[0]['max_cell_voltage'] == 3.86
        assert parsed[0]['min_cell_voltage'] == 3.83
        assert abs(parsed[0]['voltage_diff'] - 0.03) < 0.0001


class TestRecordMerger:
    def test_generate_unique_hash(self):
        record1 = {
            'battery_id': 'BAT001',
            'charge_start_time': datetime(2024, 1, 15, 8, 0),
            'cycle_count': 15
        }
        
        record2 = {
            'battery_id': 'BAT001',
            'charge_start_time': datetime(2024, 1, 15, 8, 0),
            'cycle_count': 15
        }
        
        hash1 = RecordMerger.generate_unique_hash(record1, 'charge')
        hash2 = RecordMerger.generate_unique_hash(record2, 'charge')
        
        assert hash1 == hash2
    
    def test_group_by_battery(self):
        records = [
            {'battery_id': 'BAT001', 'value': 1},
            {'battery_id': 'BAT002', 'value': 2},
            {'battery_id': 'BAT001', 'value': 3},
        ]
        
        grouped = RecordMerger.group_by_battery(records)
        
        assert 'BAT001' in grouped
        assert 'BAT002' in grouped
        assert len(grouped['BAT001']) == 2
        assert len(grouped['BAT002']) == 1


class TestRulesEngine:
    def test_battery_sealed_check(self, db_session):
        battery = BatteryPack(
            battery_id='BAT001',
            status='sealed'
        )
        db_session.add(battery)
        db_session.commit()
        
        engine = ReleaseRulesEngine(db_session)
        result = engine.evaluate_battery(
            battery_id='BAT001',
            mission_date=datetime.utcnow(),
            min_temperature=20.0,
            expected_flights=1
        )
        
        assert result.status == ReleaseStatus.FORBIDDEN
        assert any('BATTERY_SEALED' in h.rule_code for h in result.rule_hits)
    
    def test_low_voltage_alert_no_review(self, db_session):
        battery = BatteryPack(
            battery_id='BAT001',
            status='active'
        )
        db_session.add(battery)
        
        flight = FlightRecord(
            battery_id='BAT001',
            flight_date=datetime(2024, 1, 15, 14, 0),
            has_low_voltage_alert=True,
            low_voltage_alert_value=3.1,
            min_voltage=3.1
        )
        db_session.add(flight)
        db_session.commit()
        
        engine = ReleaseRulesEngine(db_session)
        result = engine.evaluate_battery(
            battery_id='BAT001',
            mission_date=datetime(2024, 1, 16, 8, 0),
            min_temperature=20.0,
            expected_flights=1
        )
        
        assert result.status == ReleaseStatus.FORBIDDEN
        assert any('LOW_VOLTAGE_ALERT_NO_REVIEW' in h.rule_code for h in result.rule_hits)
    
    def test_cell_voltage_diff_too_large(self, db_session):
        battery = BatteryPack(
            battery_id='BAT001',
            status='active'
        )
        db_session.add(battery)
        
        voltage = CellVoltageReading(
            battery_id='BAT001',
            reading_time=datetime(2024, 1, 15, 20, 0),
            cell_1_voltage=3.85,
            cell_2_voltage=3.84,
            cell_3_voltage=3.86,
            cell_4_voltage=3.85,
            cell_5_voltage=3.75,
            cell_6_voltage=3.85,
            max_cell_voltage=3.86,
            min_cell_voltage=3.75,
            voltage_diff=0.11
        )
        db_session.add(voltage)
        db_session.commit()
        
        engine = ReleaseRulesEngine(db_session)
        result = engine.evaluate_battery(
            battery_id='BAT001',
            mission_date=datetime(2024, 1, 16, 8, 0),
            min_temperature=20.0,
            expected_flights=1
        )
        
        assert any('CELL_VOLTAGE_DIFF_LARGE' in h.rule_code for h in result.rule_hits)


class TestQuarantineService:
    def test_add_to_quarantine(self, db_session):
        quarantine_record = QuarantineService.add_to_quarantine(
            db=db_session,
            import_session_id='test-session-123',
            source_type='charger',
            source_file='test.csv',
            row_number=3,
            raw_data={'battery_id': 'INVALID'},
            error_type='battery_not_exist',
            error_message='电池不存在'
        )
        
        assert quarantine_record.id is not None
        assert quarantine_record.error_type == 'battery_not_exist'
        assert quarantine_record.is_resolved == False
    
    def test_resolve_quarantine(self, db_session):
        quarantine_record = QuarantineService.add_to_quarantine(
            db=db_session,
            import_session_id='test-session-123',
            source_type='charger',
            source_file='test.csv',
            row_number=3,
            raw_data={'battery_id': 'INVALID'},
            error_type='battery_not_exist',
            error_message='电池不存在'
        )
        
        resolved = QuarantineService.resolve_quarantine_record(
            db=db_session,
            record_id=quarantine_record.id,
            resolution_note='已手动处理'
        )
        
        assert resolved.is_resolved == True
        assert resolved.resolution_note == '已手动处理'


class TestReportExporter:
    def test_export_markdown(self, db_session):
        battery = BatteryPack(
            battery_id='BAT001',
            name='测试电池1号',
            initial_cycles=0,
            cell_count=6,
            capacity_mah=16000,
            status='active'
        )
        db_session.add(battery)
        
        charge = ChargeRecord(
            battery_id='BAT001',
            charge_start_time=datetime(2024, 1, 15, 8, 0),
            charge_end_time=datetime(2024, 1, 15, 9, 30),
            start_voltage=22.5,
            end_voltage=25.2,
            cycle_count=15
        )
        db_session.add(charge)
        
        flight = FlightRecord(
            battery_id='BAT001',
            flight_date=datetime(2024, 1, 16, 14, 0),
            flight_duration_min=25,
            start_voltage=25.0,
            end_voltage=22.2,
            cycle_count=16,
            has_low_voltage_alert=False
        )
        db_session.add(flight)
        db_session.commit()
        
        exporter = ReportExporter(db_session)
        markdown = exporter.export_to_markdown('BAT001')
        
        assert 'BAT001' in markdown
        assert '测试电池1号' in markdown
        assert '充电记录' in markdown
        assert '飞行记录' in markdown
