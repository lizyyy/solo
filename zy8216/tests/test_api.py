import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Animal, Cage, CageOccupancy, Anomaly, AnomalyType, AnomalyStatus
from app.schemas import CageScanCreate
from app.state_machine import CageStateMachine


@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = TestingSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def state_machine(test_db):
    return CageStateMachine(test_db)


def create_test_animal(db, animal_id: str, tag_id: str, status: str = "active", quarantine_end: datetime = None):
    animal = Animal(
        animal_id=animal_id,
        tag_id=tag_id,
        species="Mouse",
        strain="C57BL/6",
        sex="M",
        status=status,
        quarantine_end_date=quarantine_end
    )
    db.add(animal)
    db.commit()
    db.refresh(animal)
    return animal


def create_test_cage(db, cage_id: str, max_capacity: int = 5, is_quarantine: bool = False):
    cage = Cage(
        cage_id=cage_id,
        max_capacity=max_capacity,
        is_quarantine=is_quarantine,
        location="Test Location"
    )
    db.add(cage)
    db.commit()
    db.refresh(cage)
    return cage


def create_scan_data(tag_id: str, cage_id: str, timestamp: datetime = None):
    if timestamp is None:
        timestamp = datetime.utcnow()
    return CageScanCreate(
        scan_id=f"SCAN_{timestamp.strftime('%Y%m%d%H%M%S')}",
        tag_id=tag_id,
        cage_id=cage_id,
        scan_timestamp=timestamp,
        scan_type="check",
        operator="Test"
    )


class TestStateMachineCore:
    def test_animal_initial_scan(self, test_db, state_machine):
        animal = create_test_animal(test_db, "A001", "TAG001")
        cage = create_test_cage(test_db, "C001", max_capacity=5)
        
        scan_data = create_scan_data("TAG001", "C001")
        scan, anomalies, occupancy = state_machine.process_scan(scan_data)
        
        assert scan.tag_id == "TAG001"
        assert scan.animal_id == animal.id
        assert len(anomalies) == 0
        assert occupancy is not None
        assert occupancy.is_active == True
        assert occupancy.animal_id == animal.id
        assert occupancy.cage_id == cage.id

    def test_animal_transfer_between_cages(self, test_db, state_machine):
        animal = create_test_animal(test_db, "A001", "TAG001")
        cage1 = create_test_cage(test_db, "C001", max_capacity=5)
        cage2 = create_test_cage(test_db, "C002", max_capacity=5)
        
        scan1 = create_scan_data("TAG001", "C001", datetime.utcnow())
        scan, anomalies, occupancy1 = state_machine.process_scan(scan1)
        
        assert len(anomalies) == 0
        
        scan2 = create_scan_data("TAG001", "C002", datetime.utcnow() + timedelta(minutes=10))
        scan, anomalies, occupancy2 = state_machine.process_scan(scan2)
        
        assert len(anomalies) == 0
        
        old_occupancy = test_db.query(CageOccupancy).filter(
            CageOccupancy.id == occupancy1.id
        ).first()
        assert old_occupancy.is_active == False
        assert old_occupancy.end_date is not None
        
        new_occupancy = test_db.query(CageOccupancy).filter(
            CageOccupancy.animal_id == animal.id,
            CageOccupancy.is_active == True
        ).first()
        assert new_occupancy.cage_id == cage2.id


class TestAnomalyDetection:
    def test_cage_capacity_exceeded(self, test_db, state_machine):
        cage = create_test_cage(test_db, "C001", max_capacity=2)
        
        animal1 = create_test_animal(test_db, "A001", "TAG001")
        animal2 = create_test_animal(test_db, "A002", "TAG002")
        animal3 = create_test_animal(test_db, "A003", "TAG003")
        
        base_time = datetime.utcnow()
        
        state_machine.process_scan(create_scan_data("TAG001", "C001", base_time))
        state_machine.process_scan(create_scan_data("TAG002", "C001", base_time + timedelta(minutes=1)))
        
        scan3 = create_scan_data("TAG003", "C001", base_time + timedelta(minutes=2))
        scan, anomalies, occupancy = state_machine.process_scan(scan3)
        
        capacity_anomalies = [
            a for a in anomalies 
            if a.anomaly_type == AnomalyType.CAGE_CAPACITY_EXCEEDED.value
        ]
        assert len(capacity_anomalies) == 1
        assert "容量超限" in capacity_anomalies[0].description

    def test_duplicate_scan_detection(self, test_db, state_machine):
        animal = create_test_animal(test_db, "A001", "TAG001")
        cage = create_test_cage(test_db, "C001", max_capacity=5)
        
        base_time = datetime.utcnow()
        
        state_machine.process_scan(create_scan_data("TAG001", "C001", base_time))
        
        duplicate_scan = create_scan_data("TAG001", "C001", base_time + timedelta(seconds=30))
        scan, anomalies, occupancy = state_machine.process_scan(duplicate_scan)
        
        duplicate_anomalies = [
            a for a in anomalies 
            if a.anomaly_type == AnomalyType.DUPLICATE_SCAN.value
        ]
        assert len(duplicate_anomalies) == 1
        assert scan.is_duplicate == True

    def test_deceased_animal_scanned(self, test_db, state_machine):
        animal = create_test_animal(test_db, "A001", "TAG001", status="deceased")
        cage = create_test_cage(test_db, "C001", max_capacity=5)
        
        scan_data = create_scan_data("TAG001", "C001")
        scan, anomalies, occupancy = state_machine.process_scan(scan_data)
        
        deceased_anomalies = [
            a for a in anomalies 
            if a.anomaly_type == AnomalyType.DECEASED_ANIMAL_SCANNED.value
        ]
        assert len(deceased_anomalies) == 1
        assert "已死亡" in deceased_anomalies[0].description

    def test_transferred_animal_scanned(self, test_db, state_machine):
        animal = create_test_animal(test_db, "A001", "TAG001", status="transferred")
        cage = create_test_cage(test_db, "C001", max_capacity=5)
        
        scan_data = create_scan_data("TAG001", "C001")
        scan, anomalies, occupancy = state_machine.process_scan(scan_data)
        
        transferred_anomalies = [
            a for a in anomalies 
            if a.anomaly_type == AnomalyType.TRANSFERRED_ANIMAL_SCANNED.value
        ]
        assert len(transferred_anomalies) == 1
        assert "已转出" in transferred_anomalies[0].description

    def test_quarantine_animal_mixed(self, test_db, state_machine):
        quarantine_end = datetime.utcnow() + timedelta(days=7)
        
        normal_animal = create_test_animal(test_db, "A001", "TAG001", status="active")
        quarantine_animal = create_test_animal(
            test_db, "A002", "TAG002", 
            status="in_quarantine", 
            quarantine_end=quarantine_end
        )
        
        cage = create_test_cage(test_db, "C001", max_capacity=5)
        
        base_time = datetime.utcnow()
        
        state_machine.process_scan(create_scan_data("TAG001", "C001", base_time))
        
        scan2 = create_scan_data("TAG002", "C001", base_time + timedelta(minutes=1))
        scan, anomalies, occupancy = state_machine.process_scan(scan2)
        
        quarantine_anomalies = [
            a for a in anomalies 
            if a.anomaly_type == AnomalyType.QUARANTINE_ANIMAL_MIXED.value
        ]
        assert len(quarantine_anomalies) == 1
        assert "隔离" in quarantine_anomalies[0].description


class TestAnomalyReview:
    def test_anomaly_status_pending_by_default(self, test_db, state_machine):
        animal = create_test_animal(test_db, "A001", "TAG001", status="deceased")
        cage = create_test_cage(test_db, "C001", max_capacity=5)
        
        scan_data = create_scan_data("TAG001", "C001")
        scan, anomalies, occupancy = state_machine.process_scan(scan_data)
        
        assert len(anomalies) == 1
        assert anomalies[0].status == AnomalyStatus.PENDING.value

    def test_capacity_exceeded_blocks_cage_transfer(self, test_db, state_machine):
        cage = create_test_cage(test_db, "C001", max_capacity=1)
        
        animal1 = create_test_animal(test_db, "A001", "TAG001")
        animal2 = create_test_animal(test_db, "A002", "TAG002")
        
        base_time = datetime.utcnow()
        
        state_machine.process_scan(create_scan_data("TAG001", "C001", base_time))
        
        animal1_cage = state_machine.get_current_cage(animal1)
        assert animal1_cage is not None
        assert animal1_cage.cage_id == "C001"
        
        scan2 = create_scan_data("TAG002", "C001", base_time + timedelta(seconds=30))
        scan, anomalies, occupancy = state_machine.process_scan(scan2)
        
        capacity_anomalies = [
            a for a in anomalies 
            if a.anomaly_type == AnomalyType.CAGE_CAPACITY_EXCEEDED.value
        ]
        assert len(capacity_anomalies) == 1
        
        animal2_cage = state_machine.get_current_cage(animal2)
        assert animal2_cage is None
        
        cage_occupancy = state_machine.get_cage_occupancy(cage)
        assert cage_occupancy == 1

    def test_duplicate_scan_when_animal_in_cage(self, test_db, state_machine):
        cage = create_test_cage(test_db, "C001", max_capacity=5)
        animal = create_test_animal(test_db, "A001", "TAG001")
        
        base_time = datetime.utcnow()
        
        state_machine.process_scan(create_scan_data("TAG001", "C001", base_time))
        
        animal_cage = state_machine.get_current_cage(animal)
        assert animal_cage is not None
        assert animal_cage.cage_id == "C001"
        
        duplicate_scan = create_scan_data("TAG001", "C001", base_time + timedelta(seconds=30))
        scan, anomalies, occupancy = state_machine.process_scan(duplicate_scan)
        
        duplicate_anomalies = [
            a for a in anomalies 
            if a.anomaly_type == AnomalyType.DUPLICATE_SCAN.value
        ]
        assert len(duplicate_anomalies) == 1
        assert scan.is_duplicate == True
        
        animal_cage_after = state_machine.get_current_cage(animal)
        assert animal_cage_after is not None
        assert animal_cage_after.cage_id == "C001"


class TestCageOccupancyTracking:
    def test_get_current_cage(self, test_db, state_machine):
        animal = create_test_animal(test_db, "A001", "TAG001")
        cage1 = create_test_cage(test_db, "C001", max_capacity=5)
        cage2 = create_test_cage(test_db, "C002", max_capacity=5)
        
        base_time = datetime.utcnow()
        
        state_machine.process_scan(create_scan_data("TAG001", "C001", base_time))
        
        current_cage = state_machine.get_current_cage(animal)
        assert current_cage is not None
        assert current_cage.cage_id == "C001"
        
        state_machine.process_scan(create_scan_data("TAG001", "C002", base_time + timedelta(minutes=10)))
        
        current_cage = state_machine.get_current_cage(animal)
        assert current_cage is not None
        assert current_cage.cage_id == "C002"

    def test_cage_occupancy_count(self, test_db, state_machine):
        cage = create_test_cage(test_db, "C001", max_capacity=5)
        
        animal1 = create_test_animal(test_db, "A001", "TAG001")
        animal2 = create_test_animal(test_db, "A002", "TAG002")
        animal3 = create_test_animal(test_db, "A003", "TAG003")
        
        base_time = datetime.utcnow()
        
        assert state_machine.get_cage_occupancy(cage) == 0
        
        state_machine.process_scan(create_scan_data("TAG001", "C001", base_time))
        assert state_machine.get_cage_occupancy(cage) == 1
        
        state_machine.process_scan(create_scan_data("TAG002", "C001", base_time + timedelta(minutes=1)))
        assert state_machine.get_cage_occupancy(cage) == 2
        
        state_machine.process_scan(create_scan_data("TAG003", "C001", base_time + timedelta(minutes=2)))
        assert state_machine.get_cage_occupancy(cage) == 3
