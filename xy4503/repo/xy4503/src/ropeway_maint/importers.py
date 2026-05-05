import csv
import json
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from .models import (
    Cabin, CabinInspection, WireRope, WireRopeInspection,
    WindSpeedRecord, Gripper, GripperLubrication, ReservationPeak
)


def parse_date(date_str: str) -> datetime:
    formats = ["%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析日期格式: {date_str}")


class CabinInspectionImporter:
    @staticmethod
    def import_csv(file_path: str, db: Session) -> int:
        imported_count = 0
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                cabin_number = row.get('cabin_number') or row.get('吊厢编号')
                if not cabin_number:
                    continue
                
                cabin = db.query(Cabin).filter(Cabin.cabin_number == cabin_number).first()
                if not cabin:
                    cabin = Cabin(cabin_number=cabin_number)
                    db.add(cabin)
                    db.flush()
                
                inspection_date = parse_date(row.get('inspection_date') or row.get('点检日期', datetime.now().strftime('%Y-%m-%d')))
                
                inspection = CabinInspection(
                    inspection_date=inspection_date,
                    cabin_number=cabin_number,
                    inspector=row.get('inspector') or row.get('点检员'),
                    condition=row.get('condition') or row.get('状态'),
                    issues=row.get('issues') or row.get('问题'),
                    status=row.get('status') or row.get('检查状态', '正常')
                )
                db.add(inspection)
                imported_count += 1
        
        db.commit()
        return imported_count


class WireRopeInspectionImporter:
    @staticmethod
    def import_json(file_path: str, db: Session) -> int:
        imported_count = 0
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        inspections = data if isinstance(data, list) else data.get('inspections', [data])
        
        for item in inspections:
            rope_id = item.get('rope_id') or item.get('钢丝绳编号')
            if not rope_id:
                continue
            
            rope = db.query(WireRope).filter(WireRope.rope_id == rope_id).first()
            if not rope:
                rope = WireRope(
                    rope_id=rope_id,
                    location=item.get('location') or item.get('位置')
                )
                db.add(rope)
                db.flush()
            
            inspection_date = parse_date(
                item.get('inspection_date') or 
                item.get('探伤日期', datetime.now().strftime('%Y-%m-%d'))
            )
            
            inspection = WireRopeInspection(
                inspection_date=inspection_date,
                rope_id=rope_id,
                broken_wires=int(item.get('broken_wires', item.get('断丝数', 0))),
                corrosion=item.get('corrosion') or item.get('腐蚀情况'),
                wear_percentage=float(item.get('wear_percentage', item.get('磨损率', 0.0))),
                abnormal=item.get('abnormal') or item.get('是否异常', '否'),
                issues=item.get('issues') or item.get('问题描述')
            )
            db.add(inspection)
            imported_count += 1
        
        db.commit()
        return imported_count


class WindSpeedImporter:
    @staticmethod
    def import_csv(file_path: str, db: Session) -> int:
        imported_count = 0
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record_date = parse_date(row.get('record_date') or row.get('日期', datetime.now().strftime('%Y-%m-%d')))
                
                record = WindSpeedRecord(
                    record_date=record_date,
                    time_slot=row.get('time_slot') or row.get('时间段'),
                    wind_speed=float(row.get('wind_speed', row.get('风速', 0.0))),
                    direction=row.get('direction') or row.get('风向')
                )
                db.add(record)
                imported_count += 1
        
        db.commit()
        return imported_count


class GripperLubricationImporter:
    @staticmethod
    def import_csv(file_path: str, db: Session) -> int:
        imported_count = 0
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                gripper_id = row.get('gripper_id') or row.get('抱索器编号')
                cabin_number = row.get('cabin_number') or row.get('吊厢编号')
                
                if not gripper_id:
                    continue
                
                gripper = db.query(Gripper).filter(Gripper.gripper_id == gripper_id).first()
                if not gripper:
                    gripper = Gripper(
                        gripper_id=gripper_id,
                        cabin_number=cabin_number
                    )
                    db.add(gripper)
                    db.flush()
                
                record_date = parse_date(row.get('record_date') or row.get('记录日期', datetime.now().strftime('%Y-%m-%d')))
                lubrication_date = parse_date(row.get('lubrication_date') or row.get('润滑日期', record_date.strftime('%Y-%m-%d')))
                
                lubrication = GripperLubrication(
                    record_date=record_date,
                    gripper_id=gripper_id,
                    cabin_number=cabin_number,
                    lubrication_date=lubrication_date,
                    technician=row.get('technician') or row.get('技术员'),
                    status=row.get('status') or row.get('状态', '已完成')
                )
                db.add(lubrication)
                imported_count += 1
                
                gripper.last_lubrication_date = lubrication_date
        
        db.commit()
        return imported_count


class ReservationPeakImporter:
    @staticmethod
    def import_csv(file_path: str, db: Session) -> int:
        imported_count = 0
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record_date = parse_date(row.get('record_date') or row.get('日期', datetime.now().strftime('%Y-%m-%d')))
                
                peak = ReservationPeak(
                    record_date=record_date,
                    time_slot=row.get('time_slot') or row.get('时间段'),
                    peak_count=int(row.get('peak_count', row.get('峰值人数', 0))),
                    estimated_arrival=int(row.get('estimated_arrival', row.get('预计到达', 0)))
                )
                db.add(peak)
                imported_count += 1
        
        db.commit()
        return imported_count
