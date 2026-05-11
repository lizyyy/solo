import csv
import uuid
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from .database import get_connection
from .models import (
    Resident, Vehicle, Appointment, Violation, Schedule, Anomaly,
    VALID_PAYMENT_STATUSES, VALID_TIME_SLOTS, VALID_VIOLATION_TYPES,
    VALID_ANOMALY_TYPES, VALID_SEVERITIES, VALID_SCHEDULE_STATUSES
)

def get_or_create_resident(name: str, building: str, unit: str = None, room: str = None, phone: str = None, conn=None) -> Tuple[int, bool]:
    if conn is None:
        with get_connection() as conn:
            return get_or_create_resident(name, building, unit, room, phone, conn)
    
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id FROM residents WHERE name = ? AND building = ? AND unit = ? AND room = ?
    """, (name, building, unit, room))
    row = cursor.fetchone()
    
    if row:
        return row[0], False
    
    cursor.execute("""
        INSERT INTO residents (name, building, unit, room, phone)
        VALUES (?, ?, ?, ?, ?)
    """, (name, building, unit, room, phone))
    return cursor.lastrowid, True

def parse_float(value: str, default: float = 0.0) -> float:
    if value is None or str(value).strip() == '':
        return default
    try:
        return float(str(value).strip())
    except ValueError:
        return default

def calculate_amount_due(volume_cubic: float, price_per_cubic: float = 0.0) -> float:
    if price_per_cubic > 0:
        return volume_cubic * price_per_cubic
    return 0.0

def anomaly_exists(cursor, resident_id: int, anomaly_type: str, appointment_id: int = None) -> bool:
    if appointment_id is not None:
        cursor.execute("""
            SELECT 1 FROM anomalies 
            WHERE resident_id = ? AND anomaly_type = ? AND appointment_id = ? AND is_resolved = 0
        """, (resident_id, anomaly_type, appointment_id))
    else:
        cursor.execute("""
            SELECT 1 FROM anomalies 
            WHERE resident_id = ? AND anomaly_type = ? AND appointment_id IS NULL AND is_resolved = 0
        """, (resident_id, anomaly_type))
    return cursor.fetchone() is not None

def insert_anomaly_if_not_exists(cursor, resident_id: int, anomaly_type: str, 
                                 description: str, severity: str, appointment_id: int = None) -> bool:
    if anomaly_exists(cursor, resident_id, anomaly_type, appointment_id):
        return False
    cursor.execute("""
        INSERT INTO anomalies 
        (appointment_id, resident_id, anomaly_type, description, severity)
        VALUES (?, ?, ?, ?, ?)
    """, (appointment_id, resident_id, anomaly_type, description, severity))
    return True

def import_appointments_from_csv(file_path: str, batch_id: str = None) -> Dict:
    if batch_id is None:
        batch_id = str(uuid.uuid4())[:8]
    
    stats = {
        'batch_id': batch_id,
        'total': 0,
        'successful': 0,
        'duplicates': 0,
        'failed': 0,
        'errors': []
    }
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                required_fields = ['name', 'building', 'appointment_date', 'time_slot', 'volume_cubic']
                
                for row in reader:
                    stats['total'] += 1
                    
                    try:
                        for field in required_fields:
                            if field not in row or not row[field].strip():
                                raise ValueError(f"缺少必填字段: {field}")
                        
                        name = row['name'].strip()
                        building = row['building'].strip()
                        unit = row.get('unit', '').strip() or None
                        room = row.get('room', '').strip() or None
                        phone = row.get('phone', '').strip() or None
                        appointment_date = row['appointment_date'].strip()
                        time_slot = row['time_slot'].strip().lower()
                        volume_cubic = float(row['volume_cubic'].strip())
                        payment_status = row.get('payment_status', 'unpaid').strip().lower()
                        
                        price_per_cubic = parse_float(row.get('price_per_cubic', '0'))
                        amount_paid = parse_float(row.get('amount_paid', '0'))
                        amount_due_input = parse_float(row.get('amount_due', '0'))
                        
                        if amount_due_input > 0:
                            amount_due = amount_due_input
                        else:
                            amount_due = calculate_amount_due(volume_cubic, price_per_cubic)
                        
                        if time_slot not in VALID_TIME_SLOTS:
                            raise ValueError(f"无效的时段: {time_slot}, 有效值: {VALID_TIME_SLOTS}")
                        
                        if payment_status not in VALID_PAYMENT_STATUSES:
                            raise ValueError(f"无效的缴费状态: {payment_status}, 有效值: {VALID_PAYMENT_STATUSES}")
                        
                        resident_id, _ = get_or_create_resident(name, building, unit, room, phone, conn)
                        
                        try:
                            cursor.execute("""
                                INSERT INTO appointments 
                                (resident_id, appointment_date, time_slot, volume_cubic, payment_status, 
                                 amount_due, amount_paid, price_per_cubic, source, import_batch_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (resident_id, appointment_date, time_slot, volume_cubic, payment_status,
                                  amount_due, amount_paid, price_per_cubic, 'csv', batch_id))
                            stats['successful'] += 1
                        except Exception as e:
                            if 'UNIQUE' in str(e):
                                stats['duplicates'] += 1
                            else:
                                raise
                        
                    except Exception as e:
                        stats['failed'] += 1
                        stats['errors'].append(f"第{stats['total']}行: {str(e)}")
        
        except FileNotFoundError:
            raise ValueError(f"文件不存在: {file_path}")
        
        cursor.execute("""
            INSERT INTO import_batches 
            (id, filename, total_records, successful_records, duplicate_records, failed_records)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (batch_id, file_path, stats['total'], stats['successful'], stats['duplicates'], stats['failed']))
        
        conn.commit()
    
    return stats

def import_vehicles_from_csv(file_path: str) -> Dict:
    stats = {
        'total': 0,
        'successful': 0,
        'duplicates': 0,
        'failed': 0,
        'errors': []
    }
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    stats['total'] += 1
                    try:
                        plate = row['plate_number'].strip()
                        capacity = float(row['capacity_cubic'].strip())
                        driver = row.get('driver_name', '').strip() or None
                        is_active = row.get('is_active', '1').strip() == '1'
                        
                        try:
                            cursor.execute("""
                                INSERT INTO vehicles (plate_number, capacity_cubic, driver_name, is_active)
                                VALUES (?, ?, ?, ?)
                            """, (plate, capacity, driver, 1 if is_active else 0))
                            stats['successful'] += 1
                        except Exception as e:
                            if 'UNIQUE' in str(e):
                                stats['duplicates'] += 1
                            else:
                                raise
                    except Exception as e:
                        stats['failed'] += 1
                        stats['errors'].append(f"第{stats['total']}行: {str(e)}")
        
        except FileNotFoundError:
            raise ValueError(f"文件不存在: {file_path}")
        
        conn.commit()
    
    return stats

def import_violations_from_csv(file_path: str) -> Dict:
    stats = {
        'total': 0,
        'successful': 0,
        'failed': 0,
        'errors': []
    }
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    stats['total'] += 1
                    try:
                        name = row['name'].strip()
                        building = row['building'].strip()
                        unit = row.get('unit', '').strip() or None
                        room = row.get('room', '').strip() or None
                        violation_date = row['violation_date'].strip()
                        violation_type = row['violation_type'].strip().lower()
                        description = row.get('description', '').strip() or None
                        has_complaint = row.get('has_complaint', '0').strip() == '1'
                        
                        if violation_type not in VALID_VIOLATION_TYPES:
                            raise ValueError(f"无效的违规类型: {violation_type}")
                        
                        resident_id, _ = get_or_create_resident(name, building, unit, room, conn=conn)
                        
                        cursor.execute("""
                            INSERT INTO violations 
                            (resident_id, violation_date, violation_type, description, has_complaint)
                            VALUES (?, ?, ?, ?, ?)
                        """, (resident_id, violation_date, violation_type, description, 1 if has_complaint else 0))
                        stats['successful'] += 1
                        
                    except Exception as e:
                        stats['failed'] += 1
                        stats['errors'].append(f"第{stats['total']}行: {str(e)}")
        
        except FileNotFoundError:
            raise ValueError(f"文件不存在: {file_path}")
        
        conn.commit()
    
    return stats

def check_anomalies(appointment_date: str = None, check_all: bool = False) -> List[Anomaly]:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        where_clause = ""
        params = []
        if appointment_date and not check_all:
            where_clause = "AND a.appointment_date = ?"
            params = [appointment_date]
        
        cursor.execute(f"""
            SELECT a.id, a.resident_id, a.appointment_date, a.time_slot, 
                   a.volume_cubic, a.payment_status, a.amount_due, a.amount_paid,
                   r.name, r.building, r.unit, r.room
            FROM appointments a
            JOIN residents r ON a.resident_id = r.id
            WHERE a.source != 'cancelled' {where_clause}
        """, params)
        appointments = cursor.fetchall()
        
        for apt in appointments:
            if apt['payment_status'] == 'unpaid':
                insert_anomaly_if_not_exists(
                    cursor, apt['resident_id'], 'unpaid_appointment',
                    f"住户 {apt['name']} ({apt['building']}{apt['unit'] or ''}{apt['room'] or ''}) 预约 {apt['appointment_date']} {apt['time_slot']} 未缴费",
                    'high', apt['id']
                )
        
        cursor.execute(f"""
            SELECT a.resident_id, a.appointment_date, 
                   COUNT(*) as cnt,
                   GROUP_CONCAT(a.id) as ids,
                   r.name, r.building
            FROM appointments a
            JOIN residents r ON a.resident_id = r.id
            WHERE a.source != 'cancelled' {where_clause}
            GROUP BY a.resident_id, a.appointment_date
            HAVING cnt > 1
        """, params)
        
        for dup in cursor.fetchall():
            ids = dup['ids'].split(',')
            for apt_id in ids:
                insert_anomaly_if_not_exists(
                    cursor, dup['resident_id'], 'duplicate_appointment',
                    f"住户 {dup['name']} ({dup['building']}) 在 {dup['appointment_date']} 有 {dup['cnt']} 个重复预约",
                    'warning', int(apt_id)
                )
        
        cursor.execute("""
            SELECT v.id as violation_id, v.resident_id, v.violation_date, 
                   v.violation_type, v.has_complaint,
                   r.name, r.building, r.unit, r.room
            FROM violations v
            JOIN residents r ON v.resident_id = r.id
            WHERE v.is_resolved = 0 AND v.has_complaint = 1
        """)
        
        for viol in cursor.fetchall():
            insert_anomaly_if_not_exists(
                cursor, viol['resident_id'], 'violation_skipped',
                f"违规户 {viol['name']} ({viol['building']}{viol['unit'] or ''}{viol['room'] or ''}) 有未解决违规且产生投诉，违规类型: {viol['violation_type']}",
                'critical', None
            )
        
        conn.commit()
    
    return get_unresolved_anomalies()

def get_unresolved_anomalies() -> List[Dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT an.*, r.name as resident_name, r.building, r.unit, r.room,
                   a.appointment_date, a.time_slot, a.volume_cubic
            FROM anomalies an
            LEFT JOIN residents r ON an.resident_id = r.id
            LEFT JOIN appointments a ON an.appointment_id = a.id
            WHERE an.is_resolved = 0
            ORDER BY 
                CASE an.severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'warning' THEN 3 
                    ELSE 4 
                END,
                an.created_at
        """)
        return [dict(row) for row in cursor.fetchall()]

def resolve_anomaly(anomaly_id: int, resolution: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE anomalies 
            SET is_resolved = 1, resolution = ?
            WHERE id = ?
        """, (resolution, anomaly_id))
        conn.commit()
        return cursor.rowcount > 0

def update_appointment_payment(appointment_id: int, status: str, amount_paid: float = None) -> bool:
    if status not in VALID_PAYMENT_STATUSES:
        raise ValueError(f"无效的缴费状态: {status}")
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        if amount_paid is not None:
            cursor.execute("""
                UPDATE appointments 
                SET payment_status = ?, amount_paid = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (status, amount_paid, appointment_id))
        else:
            cursor.execute("""
                UPDATE appointments 
                SET payment_status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (status, appointment_id))
        
        conn.commit()
        return cursor.rowcount > 0

def cancel_appointment(appointment_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE appointments 
            SET source = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (appointment_id,))
        
        cursor.execute("""
            UPDATE schedules 
            SET status = 'cancelled'
            WHERE appointment_id = ? AND status = 'pending'
        """, (appointment_id,))
        
        conn.commit()
        return cursor.rowcount > 0

def get_vehicles(active_only: bool = True) -> List[Dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        where = "WHERE is_active = 1" if active_only else ""
        cursor.execute(f"SELECT * FROM vehicles {where}")
        return [dict(row) for row in cursor.fetchall()]

def get_appointments_for_scheduling(date: str) -> List[Dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, r.name, r.building, r.unit, r.room, r.phone,
                   NOT EXISTS (
                       SELECT 1 FROM anomalies an 
                       WHERE (an.appointment_id = a.id OR an.resident_id = a.resident_id)
                       AND an.is_resolved = 0
                       AND an.anomaly_type IN ('unpaid_appointment', 'violation_skipped')
                   ) as is_eligible
            FROM appointments a
            JOIN residents r ON a.resident_id = r.id
            WHERE a.appointment_date = ?
            AND a.source != 'cancelled'
            ORDER BY a.time_slot, r.building, r.unit, r.room
        """, (date,))
        return [dict(row) for row in cursor.fetchall()]

def generate_schedules(date: str) -> Dict:
    vehicles = get_vehicles(active_only=True)
    if not vehicles:
        raise ValueError("没有可用的车辆")
    
    appointments = get_appointments_for_scheduling(date)
    if not appointments:
        return {'message': f"{date} 没有可排班的预约", 'schedules': []}
    
    eligible_appointments = [a for a in appointments if a['is_eligible']]
    ineligible_appointments = [a for a in appointments if not a['is_eligible']]
    
    schedules = []
    vehicle_loads = {v['id']: {'morning': 0, 'afternoon': 0, 'evening': 0} for v in vehicles}
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM schedules WHERE schedule_date = ? AND status = 'pending'", (date,))
        
        for apt in eligible_appointments:
            assigned = False
            for vehicle in vehicles:
                current_load = vehicle_loads[vehicle['id']][apt['time_slot']]
                if current_load + apt['volume_cubic'] <= vehicle['capacity_cubic']:
                    sequence = int(current_load > 0) + 1
                    
                    cursor.execute("""
                        INSERT INTO schedules 
                        (appointment_id, vehicle_id, schedule_date, sequence, status)
                        VALUES (?, ?, ?, ?, ?)
                    """, (apt['id'], vehicle['id'], date, sequence, 'pending'))
                    
                    vehicle_loads[vehicle['id']][apt['time_slot']] += apt['volume_cubic']
                    schedules.append({
                        'appointment_id': apt['id'],
                        'vehicle_id': vehicle['id'],
                        'plate': vehicle['plate_number'],
                        'resident': apt['name'],
                        'building': apt['building'],
                        'time_slot': apt['time_slot'],
                        'volume': apt['volume_cubic']
                    })
                    assigned = True
                    break
            
            if not assigned:
                insert_anomaly_if_not_exists(
                    cursor, apt['resident_id'], 'overloaded_vehicle',
                    f"预约 {apt['appointment_date']} {apt['time_slot']} 无法安排车辆，容量不足。住户: {apt['name']} ({apt['building']}), 清运量: {apt['volume_cubic']}m³",
                    'high', apt['id']
                )
        
        conn.commit()
    
    return {
        'date': date,
        'total_appointments': len(appointments),
        'eligible': len(eligible_appointments),
        'scheduled': len(schedules),
        'ineligible': len(ineligible_appointments),
        'schedules': schedules,
        'ineligible_details': ineligible_appointments,
        'vehicle_loads': vehicle_loads
    }

def finalize_schedules(date: str) -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM anomalies 
            WHERE is_resolved = 0 
            AND severity IN ('high', 'critical')
        """)
        critical_count = cursor.fetchone()['cnt']
        
        if critical_count > 0:
            return {
                'success': False,
                'message': f"存在 {critical_count} 个高优先级异常未解决，请先处理后再确认"
            }
        
        cursor.execute("""
            UPDATE schedules 
            SET status = 'scheduled'
            WHERE schedule_date = ? AND status = 'pending'
        """, (date,))
        
        scheduled_count = cursor.rowcount
        conn.commit()
    
    return {
        'success': True,
        'date': date,
        'scheduled_count': scheduled_count,
        'message': f"{date} 已确认 {scheduled_count} 个车次安排"
    }

def generate_daily_report(date: str, output_path: str = None) -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT s.*, 
                   a.volume_cubic, a.payment_status, a.time_slot, 
                   a.amount_due, a.amount_paid, a.price_per_cubic,
                   r.name as resident_name, r.building, r.unit, r.room,
                   v.plate_number, v.capacity_cubic, v.driver_name
            FROM schedules s
            JOIN appointments a ON s.appointment_id = a.id
            JOIN residents r ON a.resident_id = r.id
            JOIN vehicles v ON s.vehicle_id = v.id
            WHERE s.schedule_date = ?
            ORDER BY v.id, s.sequence
        """, (date,))
        schedules = [dict(row) for row in cursor.fetchall()]
        
        for s in schedules:
            s['amount_diff'] = (s.get('amount_due') or 0) - (s.get('amount_paid') or 0)
        
        cursor.execute("""
            SELECT a.*, r.name, r.building, r.unit, r.room
            FROM appointments a
            JOIN residents r ON a.resident_id = r.id
            WHERE a.appointment_date = ?
            AND a.source != 'cancelled'
            AND NOT EXISTS (
                SELECT 1 FROM schedules s 
                WHERE s.appointment_id = a.id 
                AND s.schedule_date = ?
                AND s.status != 'cancelled'
            )
        """, (date, date))
        unhandled = [dict(row) for row in cursor.fetchall()]
        
        for u in unhandled:
            u['amount_diff'] = (u.get('amount_due') or 0) - (u.get('amount_paid') or 0)
        
        cursor.execute("""
            SELECT an.*, r.name as resident_name, r.building,
                   a.appointment_date, a.time_slot
            FROM anomalies an
            LEFT JOIN residents r ON an.resident_id = r.id
            LEFT JOIN appointments a ON an.appointment_id = a.id
            WHERE an.is_resolved = 0
            AND (a.appointment_date = ? OR an.anomaly_type = 'violation_skipped')
        """, (date,))
        anomalies = [dict(row) for row in cursor.fetchall()]
        
        vehicle_summary = {}
        building_summary = {}
        
        total_amount_due = 0
        total_amount_paid = 0
        total_amount_diff = 0
        
        for s in schedules:
            plate = s['plate_number']
            if plate not in vehicle_summary:
                vehicle_summary[plate] = {
                    'capacity': s['capacity_cubic'],
                    'driver': s['driver_name'],
                    'loads': {'morning': 0, 'afternoon': 0, 'evening': 0},
                    'stops': {'morning': 0, 'afternoon': 0, 'evening': 0}
                }
            vehicle_summary[plate]['loads'][s['time_slot']] += s['volume_cubic']
            vehicle_summary[plate]['stops'][s['time_slot']] += 1
            
            building = s['building']
            if building not in building_summary:
                building_summary[building] = {
                    'total_volume': 0,
                    'scheduled_count': 0,
                    'unpaid_count': 0,
                    'amount_due': 0,
                    'amount_paid': 0,
                    'amount_diff': 0,
                    'residents': set()
                }
            building_summary[building]['total_volume'] += s['volume_cubic']
            building_summary[building]['scheduled_count'] += 1
            building_summary[building]['amount_due'] += (s.get('amount_due') or 0)
            building_summary[building]['amount_paid'] += (s.get('amount_paid') or 0)
            building_summary[building]['amount_diff'] += s['amount_diff']
            if s['payment_status'] == 'unpaid':
                building_summary[building]['unpaid_count'] += 1
            building_summary[building]['residents'].add(s['resident_name'])
            
            total_amount_due += (s.get('amount_due') or 0)
            total_amount_paid += (s.get('amount_paid') or 0)
            total_amount_diff += s['amount_diff']
        
        for b in building_summary:
            building_summary[b]['residents'] = list(building_summary[b]['residents'])
        
        for u in unhandled:
            building = u['building']
            if building not in building_summary:
                building_summary[building] = {
                    'total_volume': 0,
                    'scheduled_count': 0,
                    'unpaid_count': 0,
                    'amount_due': 0,
                    'amount_paid': 0,
                    'amount_diff': 0,
                    'unhandled_count': 0,
                    'residents': []
                }
            building_summary[building].setdefault('unhandled_count', 0)
            building_summary[building]['unhandled_count'] += 1
    
    report = {
        'date': date,
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_scheduled': len(schedules),
            'total_unhandled': len(unhandled),
            'vehicles_used': len(vehicle_summary),
            'buildings_affected': len(building_summary),
            'active_anomalies': len(anomalies),
            'total_amount_due': total_amount_due,
            'total_amount_paid': total_amount_paid,
            'total_amount_diff': total_amount_diff
        },
        'schedules': schedules,
        'unhandled_appointments': unhandled,
        'anomalies': anomalies,
        'vehicle_summary': vehicle_summary,
        'building_summary': building_summary
    }
    
    if output_path:
        import json
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    
    return report

def export_schedules_to_csv(date: str, output_path: str) -> Dict:
    report = generate_daily_report(date)
    
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        
        writer.writerow(['装修垃圾清运排班日报', date])
        writer.writerow([''])
        writer.writerow(['汇总'])
        writer.writerow(['日期', date])
        writer.writerow(['已安排车次', report['summary']['total_scheduled']])
        writer.writerow(['未处理预约', report['summary']['total_unhandled']])
        writer.writerow(['使用车辆数', report['summary']['vehicles_used']])
        writer.writerow(['涉及楼栋数', report['summary']['buildings_affected']])
        writer.writerow(['待处理异常', report['summary']['active_anomalies']])
        writer.writerow(['应收总额', report['summary']['total_amount_due']])
        writer.writerow(['已收总额', report['summary']['total_amount_paid']])
        writer.writerow(['收费差额', report['summary']['total_amount_diff']])
        writer.writerow([''])
        
        writer.writerow(['车次安排详情'])
        writer.writerow(['序号', '车牌号', '司机', '时段', '住户', '楼栋', '单元', '房间', 
                        '清运量(m³)', '单价(元/m³)', '应收(元)', '已收(元)', '差额(元)', '缴费状态'])
        for i, s in enumerate(report['schedules'], 1):
            writer.writerow([
                i, s['plate_number'], s['driver_name'] or '', s['time_slot'],
                s['resident_name'], s['building'], s['unit'] or '', s['room'] or '',
                s['volume_cubic'], 
                s.get('price_per_cubic') or 0,
                s.get('amount_due') or 0,
                s.get('amount_paid') or 0,
                s.get('amount_diff') or 0,
                s['payment_status']
            ])
        writer.writerow([''])
        
        writer.writerow(['车辆装载汇总'])
        writer.writerow(['车牌号', '容量(m³)', '司机', '时段', '装载量(m³)', '站点数'])
        for plate, data in report['vehicle_summary'].items():
            for slot in ['morning', 'afternoon', 'evening']:
                if data['stops'][slot] > 0:
                    writer.writerow([
                        plate, data['capacity'], data['driver'] or '',
                        slot, data['loads'][slot], data['stops'][slot]
                    ])
        writer.writerow([''])
        
        writer.writerow(['未处理预约'])
        writer.writerow(['住户', '楼栋', '单元', '房间', '时段', '清运量(m³)', 
                        '应收(元)', '已收(元)', '差额(元)', '缴费状态', '未处理原因'])
        for u in report['unhandled_appointments']:
            reasons = []
            for an in report['anomalies']:
                if an['appointment_id'] == u['id']:
                    reasons.append(an['description'])
            writer.writerow([
                u['name'], u['building'], u['unit'] or '', u['room'] or '',
                u['time_slot'], u['volume_cubic'],
                u.get('amount_due') or 0,
                u.get('amount_paid') or 0,
                u.get('amount_diff') or 0,
                u['payment_status'],
                '; '.join(reasons) or '未安排车辆'
            ])
        writer.writerow([''])
        
        writer.writerow(['收费差异汇总'])
        writer.writerow(['楼栋', '应收总额(元)', '已收总额(元)', '收费差额(元)', '差额说明'])
        for building, data in sorted(report['building_summary'].items()):
            diff = data.get('amount_diff', 0)
            note = ''
            if diff > 0:
                note = '待收'
            elif diff < 0:
                note = '多收'
            else:
                note = '已结清'
            writer.writerow([
                building,
                data.get('amount_due', 0),
                data.get('amount_paid', 0),
                diff,
                note
            ])
        writer.writerow([''])
        
        writer.writerow(['按楼栋核对'])
        writer.writerow(['楼栋', '已安排车次', '未处理', '清运总量(m³)', 
                        '应收总额(元)', '已收总额(元)', '收费差额(元)', '未缴费数', '涉及住户'])
        for building, data in sorted(report['building_summary'].items()):
            writer.writerow([
                building,
                data.get('scheduled_count', 0),
                data.get('unhandled_count', 0),
                data.get('total_volume', 0),
                data.get('amount_due', 0),
                data.get('amount_paid', 0),
                data.get('amount_diff', 0),
                data.get('unpaid_count', 0),
                ', '.join(data.get('residents', []))
            ])
    
    return {'output_path': output_path, 'report': report}
