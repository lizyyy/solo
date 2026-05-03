from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Tuple
from datetime import datetime
from collections import defaultdict

from app.models import (
    Animal, Cage, CageScan, CageOccupancy, Anomaly,
    AnimalStatus, AnomalyType, AnomalyStatus
)
from app.schemas import CageScanCreate


class CageStateMachine:
    def __init__(self, db: Session):
        self.db = db
        self._scan_cache: Dict[str, List[CageScan]] = {}

    def get_current_cage(self, animal: Animal) -> Optional[Cage]:
        occupancy = (
            self.db.query(CageOccupancy)
            .filter(
                CageOccupancy.animal_id == animal.id,
                CageOccupancy.is_active == True
            )
            .first()
        )
        if occupancy:
            return occupancy.cage
        return None

    def get_cage_occupancy(self, cage: Cage, exclude_animal_id: Optional[int] = None) -> int:
        query = (
            self.db.query(CageOccupancy)
            .filter(
                CageOccupancy.cage_id == cage.id,
                CageOccupancy.is_active == True
            )
        )
        if exclude_animal_id:
            query = query.filter(CageOccupancy.animal_id != exclude_animal_id)
        return query.count()

    def get_animal_by_tag(self, tag_id: str) -> Optional[Animal]:
        return (
            self.db.query(Animal)
            .filter(Animal.tag_id == tag_id)
            .first()
        )

    def get_cage_by_id(self, cage_id: str) -> Optional[Cage]:
        return (
            self.db.query(Cage)
            .filter(Cage.cage_id == cage_id)
            .first()
        )

    def check_duplicate_scan(
        self,
        tag_id: str,
        cage_id: str,
        scan_timestamp: datetime,
        window_seconds: int = 60
    ) -> Tuple[bool, Optional[CageScan]]:
        from datetime import timedelta
        
        time_window_start = scan_timestamp - timedelta(seconds=window_seconds)
        
        existing_scan = (
            self.db.query(CageScan)
            .filter(
                CageScan.tag_id == tag_id,
                CageScan.cage_id == (
                    self.db.query(Cage.id)
                    .filter(Cage.cage_id == cage_id)
                    .scalar_subquery()
                ),
                CageScan.scan_timestamp.between(time_window_start, scan_timestamp)
            )
            .first()
        )
        
        return (existing_scan is not None, existing_scan)

    def check_animal_status(self, animal: Animal) -> List[Tuple[AnomalyType, str]]:
        anomalies = []
        
        if animal.status == AnimalStatus.DECEASED.value:
            anomalies.append((
                AnomalyType.DECEASED_ANIMAL_SCANNED,
                f"动物 {animal.animal_id} (标签 {animal.tag_id}) 已死亡，但仍被扫码"
            ))
        elif animal.status == AnimalStatus.TRANSFERRED.value:
            anomalies.append((
                AnomalyType.TRANSFERRED_ANIMAL_SCANNED,
                f"动物 {animal.animal_id} (标签 {animal.tag_id}) 已转出，但仍被扫码"
            ))
        
        return anomalies

    def check_quarantine_mixing(
        self,
        animal: Animal,
        target_cage: Cage,
        current_cage: Optional[Cage]
    ) -> List[Tuple[AnomalyType, str]]:
        anomalies = []
        
        is_animal_in_quarantine = (
            animal.status == AnimalStatus.IN_QUARANTINE.value and
            animal.quarantine_end_date and
            animal.quarantine_end_date > datetime.utcnow()
        )
        
        target_occupants = (
            self.db.query(CageOccupancy)
            .filter(
                CageOccupancy.cage_id == target_cage.id,
                CageOccupancy.is_active == True,
                CageOccupancy.animal_id != animal.id
            )
            .all()
        )
        
        for occupancy in target_occupants:
            occupant = occupancy.animal
            is_occupant_in_quarantine = (
                occupant.status == AnimalStatus.IN_QUARANTINE.value and
                occupant.quarantine_end_date and
                occupant.quarantine_end_date > datetime.utcnow()
            )
            
            if is_animal_in_quarantine != is_occupant_in_quarantine:
                if is_animal_in_quarantine:
                    desc = (
                        f"隔离期动物 {animal.animal_id} 试图混入笼位 {target_cage.cage_id}，"
                        f"该笼位已有非隔离期动物 {occupant.animal_id}"
                    )
                else:
                    desc = (
                        f"非隔离期动物 {animal.animal_id} 试图混入笼位 {target_cage.cage_id}，"
                        f"该笼位有隔离期动物 {occupant.animal_id}"
                    )
                anomalies.append((AnomalyType.QUARANTINE_ANIMAL_MIXED, desc))
                break
        
        if target_occupants and target_cage.is_quarantine:
            pass
        
        return anomalies

    def check_cage_capacity(
        self,
        animal: Animal,
        target_cage: Cage,
        current_cage: Optional[Cage]
    ) -> List[Tuple[AnomalyType, str]]:
        anomalies = []
        
        if current_cage and current_cage.id == target_cage.id:
            return anomalies
        
        current_occupancy = self.get_cage_occupancy(target_cage, exclude_animal_id=animal.id)
        
        if current_occupancy >= target_cage.max_capacity:
            anomalies.append((
                AnomalyType.CAGE_CAPACITY_EXCEEDED,
                f"笼位 {target_cage.cage_id} 容量超限。当前 {current_occupancy} 只，"
                f"最大容量 {target_cage.max_capacity}，动物 {animal.animal_id} 试图进入"
            ))
        
        return anomalies

    def validate_scan(
        self,
        scan_data: CageScanCreate
    ) -> Tuple[bool, List[Tuple[AnomalyType, str]], Optional[Animal], Optional[Cage]]:
        all_anomalies = []
        
        animal = self.get_animal_by_tag(scan_data.tag_id)
        cage = self.get_cage_by_id(scan_data.cage_id)
        
        if not animal:
            return False, [], None, cage
        
        if not cage:
            return False, [], animal, None
        
        is_duplicate, duplicate_scan = self.check_duplicate_scan(
            scan_data.tag_id,
            scan_data.cage_id,
            scan_data.scan_timestamp
        )
        
        if is_duplicate:
            all_anomalies.append((
                AnomalyType.DUPLICATE_SCAN,
                f"检测到重复扫码：标签 {scan_data.tag_id} 在笼位 {scan_data.cage_id} "
                f"于 {scan_data.scan_timestamp} 附近已扫码过"
            ))
        
        status_anomalies = self.check_animal_status(animal)
        all_anomalies.extend(status_anomalies)
        
        current_cage = self.get_current_cage(animal)
        
        if not status_anomalies:
            capacity_anomalies = self.check_cage_capacity(animal, cage, current_cage)
            all_anomalies.extend(capacity_anomalies)
            
            quarantine_anomalies = self.check_quarantine_mixing(animal, cage, current_cage)
            all_anomalies.extend(quarantine_anomalies)
        
        is_valid = len(all_anomalies) == 0 or is_duplicate
        
        return is_valid, all_anomalies, animal, cage

    def create_anomaly(
        self,
        anomaly_type: AnomalyType,
        description: str,
        scan_event: Optional[CageScan] = None,
        animal: Optional[Animal] = None,
        cage: Optional[Cage] = None
    ) -> Anomaly:
        anomaly = Anomaly(
            anomaly_type=anomaly_type.value,
            description=description,
            status=AnomalyStatus.PENDING.value
        )
        
        if scan_event:
            anomaly.scan_event_id = scan_event.id
        if animal:
            anomaly.animal_id = animal.id
        if cage:
            anomaly.cage_id = cage.id
        
        self.db.add(anomaly)
        self.db.flush()
        return anomaly

    def process_scan(self, scan_data: CageScanCreate) -> Tuple[CageScan, List[Anomaly], Optional[CageOccupancy]]:
        is_valid, anomalies, animal, cage = self.validate_scan(scan_data)
        
        scan = CageScan(
            scan_id=scan_data.scan_id or f"SCAN_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
            tag_id=scan_data.tag_id,
            cage_id=cage.id if cage else None,
            animal_id=animal.id if animal else None,
            scan_timestamp=scan_data.scan_timestamp,
            scan_type=scan_data.scan_type,
            operator=scan_data.operator,
            notes=scan_data.notes
        )
        
        duplicate_anomaly = next(
            (a for a in anomalies if a[0] == AnomalyType.DUPLICATE_SCAN),
            None
        )
        scan.is_duplicate = duplicate_anomaly is not None
        
        self.db.add(scan)
        self.db.flush()
        
        created_anomalies = []
        for anomaly_type, description in anomalies:
            anomaly = self.create_anomaly(
                anomaly_type=anomaly_type,
                description=description,
                scan_event=scan,
                animal=animal,
                cage=cage
            )
            created_anomalies.append(anomaly)
        
        new_occupancy = None
        if animal and cage and not scan.is_duplicate:
            blocking_anomalies_exist = any(
                a[0] in [
                    AnomalyType.DECEASED_ANIMAL_SCANNED, 
                    AnomalyType.TRANSFERRED_ANIMAL_SCANNED,
                    AnomalyType.CAGE_CAPACITY_EXCEEDED,
                    AnomalyType.QUARANTINE_ANIMAL_MIXED
                ]
                for a in anomalies
            )
            
            if not blocking_anomalies_exist:
                current_cage = self.get_current_cage(animal)
                
                if current_cage and current_cage.id != cage.id:
                    old_occupancy = (
                        self.db.query(CageOccupancy)
                        .filter(
                            CageOccupancy.animal_id == animal.id,
                            CageOccupancy.is_active == True
                        )
                        .first()
                    )
                    if old_occupancy:
                        old_occupancy.is_active = False
                        old_occupancy.end_date = scan_data.scan_timestamp
                
                if not current_cage or current_cage.id != cage.id:
                    new_occupancy = CageOccupancy(
                        animal_id=animal.id,
                        cage_id=cage.id,
                        start_date=scan_data.scan_timestamp,
                        is_active=True
                    )
                    self.db.add(new_occupancy)
        
        self.db.commit()
        
        return scan, created_anomalies, new_occupancy

    def process_scans_batch(
        self,
        scans_data: List[CageScanCreate]
    ) -> Tuple[int, int, List[str]]:
        scans_data.sort(key=lambda x: x.scan_timestamp)
        
        success_count = 0
        anomaly_count = 0
        errors = []
        
        for i, scan_data in enumerate(scans_data):
            try:
                scan, anomalies, _ = self.process_scan(scan_data)
                success_count += 1
                anomaly_count += len(anomalies)
            except Exception as e:
                errors.append(f"第 {i+1} 条扫码记录处理失败: {str(e)}")
        
        return success_count, anomaly_count, errors
