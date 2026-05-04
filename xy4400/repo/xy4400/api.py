from flask import request, jsonify, Response
from datetime import datetime, timedelta
from dateutil import parser
import json
import uuid
from collections import defaultdict

def register_routes(app, db):
    from models import Battery, CabinetDoor, SwapRecord, MaintenanceOrder, Dispute, DoorSensorLog, TemperatureLog

    @app.route('/api/batteries', methods=['GET'])
    def get_batteries():
        batteries = Battery.query.all()
        return jsonify([b.to_dict() for b in batteries])

    @app.route('/api/batteries/<int:battery_id>', methods=['GET'])
    def get_battery(battery_id):
        battery = Battery.query.get_or_404(battery_id)
        return jsonify(battery.to_dict())

    @app.route('/api/doors', methods=['GET'])
    def get_doors():
        doors = CabinetDoor.query.all()
        return jsonify([d.to_dict() for d in doors])

    @app.route('/api/doors/<int:door_id>', methods=['GET'])
    def get_door(door_id):
        door = CabinetDoor.query.get_or_404(door_id)
        return jsonify(door.to_dict())

    @app.route('/api/swaps', methods=['GET'])
    def get_swaps():
        swaps = SwapRecord.query.order_by(SwapRecord.swap_started_at.desc()).all()
        return jsonify([s.to_dict() for s in swaps])

    @app.route('/api/swaps/<int:swap_id>', methods=['GET'])
    def get_swap(swap_id):
        swap = SwapRecord.query.get_or_404(swap_id)
        return jsonify(swap.to_dict())

    @app.route('/api/maintenance', methods=['GET'])
    def get_maintenance():
        orders = MaintenanceOrder.query.order_by(MaintenanceOrder.created_at.desc()).all()
        return jsonify([o.to_dict() for o in orders])

    @app.route('/api/maintenance/<int:order_id>', methods=['GET'])
    def get_maintenance_order(order_id):
        order = MaintenanceOrder.query.get_or_404(order_id)
        return jsonify(order.to_dict())

    @app.route('/api/disputes', methods=['GET'])
    def get_disputes():
        status = request.args.get('status')
        dispute_type = request.args.get('type')
        
        query = Dispute.query
        if status:
            query = query.filter(Dispute.status == status)
        if dispute_type:
            query = query.filter(Dispute.dispute_type == dispute_type)
        
        disputes = query.order_by(Dispute.created_at.desc()).all()
        return jsonify([d.to_dict() for d in disputes])

    @app.route('/api/disputes/<int:dispute_id>', methods=['GET'])
    def get_dispute(dispute_id):
        dispute = Dispute.query.get_or_404(dispute_id)
        return jsonify(dispute.to_dict())

    @app.route('/api/disputes/<int:dispute_id>/review', methods=['PUT'])
    def review_dispute(dispute_id):
        dispute = Dispute.query.get_or_404(dispute_id)
        data = request.get_json()
        
        status = data.get('status')
        if status and status not in Dispute.STATUS_TYPES:
            return jsonify({'error': f'Invalid status. Must be one of: {Dispute.STATUS_TYPES}'}), 400
        
        if status:
            dispute.status = status
        if 'review_comment' in data:
            dispute.review_comment = data.get('review_comment')
        if 'reviewer_id' in data:
            dispute.reviewer_id = data.get('reviewer_id')
        
        dispute.reviewed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(dispute.to_dict())

    @app.route('/api/logs/door-sensor', methods=['POST'])
    def import_door_sensor_logs():
        data = request.get_json()
        logs = data.get('logs', []) if isinstance(data, dict) else data
        
        imported = []
        errors = []
        
        for log_data in logs:
            try:
                door_number = log_data.get('door_number')
                door = CabinetDoor.query.filter_by(door_number=door_number).first()
                
                if not door:
                    door = CabinetDoor(
                        door_number=door_number,
                        status='available'
                    )
                    db.session.add(door)
                    db.session.flush()
                
                log_time = parser.parse(log_data.get('log_time')) if log_data.get('log_time') else datetime.utcnow()
                
                log = DoorSensorLog(
                    log_time=log_time,
                    door_id=door.id,
                    event_type=log_data.get('event_type'),
                    sensor_reading=log_data.get('sensor_reading'),
                    raw_data=json.dumps(log_data)
                )
                db.session.add(log)
                imported.append(log.to_dict())
                
                if log_data.get('event_type') == 'open':
                    door.last_opened_at = log_time
                    door.status = 'open'
                elif log_data.get('event_type') == 'close':
                    door.last_closed_at = log_time
                    door.status = 'locked'
                elif log_data.get('event_type') == 'jam':
                    door.is_jammed = True
                    door.jammed_at = log_time
                    door.status = 'fault'
                    
            except Exception as e:
                errors.append({'log': log_data, 'error': str(e)})
        
        db.session.commit()
        return jsonify({
            'imported': len(imported),
            'errors': len(errors),
            'imported_logs': imported,
            'error_details': errors
        })

    @app.route('/api/logs/temperature', methods=['POST'])
    def import_temperature_logs():
        data = request.get_json()
        logs = data.get('logs', []) if isinstance(data, dict) else data
        
        imported = []
        errors = []
        
        for log_data in logs:
            try:
                log_time = parser.parse(log_data.get('log_time')) if log_data.get('log_time') else datetime.utcnow()
                temperature = log_data.get('temperature')
                
                battery_code = log_data.get('battery_code')
                door_number = log_data.get('door_number')
                
                battery = None
                door = None
                
                if battery_code:
                    battery = Battery.query.filter_by(battery_code=battery_code).first()
                    if battery:
                        battery.current_temperature = temperature
                
                if door_number:
                    door = CabinetDoor.query.filter_by(door_number=door_number).first()
                    if not door:
                        door = CabinetDoor(door_number=door_number, status='available')
                        db.session.add(door)
                        db.session.flush()
                
                log = TemperatureLog(
                    log_time=log_time,
                    battery_id=battery.id if battery else None,
                    door_id=door.id if door else None,
                    temperature=temperature,
                    raw_data=json.dumps(log_data)
                )
                db.session.add(log)
                imported.append(log.to_dict())
                
            except Exception as e:
                errors.append({'log': log_data, 'error': str(e)})
        
        db.session.commit()
        return jsonify({
            'imported': len(imported),
            'errors': len(errors),
            'imported_logs': imported,
            'error_details': errors
        })

    @app.route('/api/logs/swap-records', methods=['POST'])
    def import_swap_records():
        data = request.get_json()
        swaps = data.get('swaps', []) if isinstance(data, dict) else data
        
        imported = []
        errors = []
        
        for swap_data in swaps:
            try:
                swap_code = swap_data.get('swap_code') or f'SWAP-{uuid.uuid4().hex[:8]}'
                
                old_battery = None
                new_battery = None
                old_door = None
                new_door = None
                
                if swap_data.get('old_battery_code'):
                    old_battery = Battery.query.filter_by(battery_code=swap_data.get('old_battery_code')).first()
                    if not old_battery:
                        old_battery = Battery(
                            battery_code=swap_data.get('old_battery_code'),
                            status='in_use'
                        )
                        db.session.add(old_battery)
                        db.session.flush()
                
                if swap_data.get('new_battery_code'):
                    new_battery = Battery.query.filter_by(battery_code=swap_data.get('new_battery_code')).first()
                    if not new_battery:
                        new_battery = Battery(
                            battery_code=swap_data.get('new_battery_code'),
                            status='available'
                        )
                        db.session.add(new_battery)
                        db.session.flush()
                
                if swap_data.get('old_door_number'):
                    old_door = CabinetDoor.query.filter_by(door_number=swap_data.get('old_door_number')).first()
                    if not old_door:
                        old_door = CabinetDoor(door_number=swap_data.get('old_door_number'), status='available')
                        db.session.add(old_door)
                        db.session.flush()
                
                if swap_data.get('new_door_number'):
                    new_door = CabinetDoor.query.filter_by(door_number=swap_data.get('new_door_number')).first()
                    if not new_door:
                        new_door = CabinetDoor(door_number=swap_data.get('new_door_number'), status='available')
                        db.session.add(new_door)
                        db.session.flush()
                
                swap_started_at = parser.parse(swap_data.get('swap_started_at')) if swap_data.get('swap_started_at') else datetime.utcnow()
                swap_completed_at = parser.parse(swap_data.get('swap_completed_at')) if swap_data.get('swap_completed_at') else None
                
                swap = SwapRecord(
                    swap_code=swap_code,
                    user_id=swap_data.get('user_id'),
                    old_battery_id=old_battery.id if old_battery else None,
                    new_battery_id=new_battery.id if new_battery else None,
                    old_door_id=old_door.id if old_door else None,
                    new_door_id=new_door.id if new_door else None,
                    swap_started_at=swap_started_at,
                    swap_completed_at=swap_completed_at,
                    status=swap_data.get('status', 'completed'),
                    amount=swap_data.get('amount', 0.0)
                )
                db.session.add(swap)
                
                if old_battery and new_door:
                    old_battery.current_door_id = new_door.id
                    old_battery.status = 'charging'
                    old_battery.last_swapped_at = swap_completed_at or swap_started_at
                
                if new_battery and old_door:
                    new_battery.current_door_id = None
                    new_battery.status = 'in_use'
                    new_battery.last_swapped_at = swap_completed_at or swap_started_at
                
                imported.append(swap.to_dict())
                
            except Exception as e:
                errors.append({'swap': swap_data, 'error': str(e)})
        
        db.session.commit()
        return jsonify({
            'imported': len(imported),
            'errors': len(errors),
            'imported_swaps': imported,
            'error_details': errors
        })

    @app.route('/api/logs/maintenance', methods=['POST'])
    def import_maintenance_orders():
        data = request.get_json()
        orders = data.get('orders', []) if isinstance(data, dict) else data
        
        imported = []
        errors = []
        
        for order_data in orders:
            try:
                order_code = order_data.get('order_code') or f'MAINT-{uuid.uuid4().hex[:8]}'
                
                door = None
                battery = None
                
                if order_data.get('door_number'):
                    door = CabinetDoor.query.filter_by(door_number=order_data.get('door_number')).first()
                
                if order_data.get('battery_code'):
                    battery = Battery.query.filter_by(battery_code=order_data.get('battery_code')).first()
                
                created_at = parser.parse(order_data.get('created_at')) if order_data.get('created_at') else datetime.utcnow()
                resolved_at = parser.parse(order_data.get('resolved_at')) if order_data.get('resolved_at') else None
                
                order = MaintenanceOrder(
                    order_code=order_code,
                    issue_type=order_data.get('issue_type', 'other'),
                    door_id=door.id if door else None,
                    battery_id=battery.id if battery else None,
                    description=order_data.get('description'),
                    reporter=order_data.get('reporter'),
                    status=order_data.get('status', 'pending'),
                    created_at=created_at,
                    resolved_at=resolved_at,
                    resolution=order_data.get('resolution')
                )
                db.session.add(order)
                imported.append(order.to_dict())
                
            except Exception as e:
                errors.append({'order': order_data, 'error': str(e)})
        
        db.session.commit()
        return jsonify({
            'imported': len(imported),
            'errors': len(errors),
            'imported_orders': imported,
            'error_details': errors
        })

    @app.route('/api/disputes/detect', methods=['POST'])
    def detect_disputes():
        detected = []
        errors = []
        
        try:
            wrong_battery = detect_wrong_battery_misplaced()
            detected.extend(wrong_battery)
        except Exception as e:
            errors.append({'type': 'wrong_battery_misplaced', 'error': str(e)})
        
        try:
            overtemp = detect_overtemp_not_isolated()
            detected.extend(overtemp)
        except Exception as e:
            errors.append({'type': 'overtemp_not_isolated', 'error': str(e)})
        
        try:
            door_jammed = detect_door_jammed_still_lent()
            detected.extend(door_jammed)
        except Exception as e:
            errors.append({'type': 'door_jammed_still_lent', 'error': str(e)})
        
        try:
            duplicate = detect_duplicate_billing()
            detected.extend(duplicate)
        except Exception as e:
            errors.append({'type': 'duplicate_billing', 'error': str(e)})
        
        return jsonify({
            'detected': len(detected),
            'errors': len(errors),
            'disputes': [d.to_dict() for d in detected],
            'error_details': errors
        })

    def detect_wrong_battery_misplaced():
        disputes = []
        
        recent_swaps = SwapRecord.query.filter(
            SwapRecord.swap_completed_at >= datetime.utcnow() - timedelta(hours=24),
            SwapRecord.status == 'completed'
        ).all()
        
        for swap in recent_swaps:
            if swap.old_battery_id and swap.new_door_id:
                old_battery = Battery.query.get(swap.old_battery_id)
                expected_door = CabinetDoor.query.get(swap.new_door_id)
                
                if old_battery and expected_door:
                    if old_battery.current_door_id != swap.new_door_id:
                        existing = Dispute.query.filter(
                            Dispute.dispute_type == 'wrong_battery_misplaced',
                            Dispute.related_swap_id == swap.id,
                            Dispute.status == 'pending_review'
                        ).first()
                        
                        if not existing:
                            dispute = Dispute(
                                dispute_code=f'DISP-WBM-{uuid.uuid4().hex[:8]}',
                                dispute_type='wrong_battery_misplaced',
                                status='pending_review',
                                related_swap_id=swap.id,
                                related_battery_id=swap.old_battery_id,
                                related_door_id=swap.new_door_id,
                                description=f'电池 {old_battery.battery_code} 疑似错放。换电单号 {swap.swap_code} 应归还至柜门 {expected_door.door_number}，实际位置与预期不符。',
                                evidence=json.dumps({
                                    'swap_code': swap.swap_code,
                                    'battery_code': old_battery.battery_code,
                                    'expected_door': expected_door.door_number,
                                    'actual_door_id': old_battery.current_door_id,
                                    'swap_time': swap.swap_completed_at.isoformat() if swap.swap_completed_at else None
                                })
                            )
                            db.session.add(dispute)
                            disputes.append(dispute)
        
        db.session.commit()
        return disputes

    def detect_overtemp_not_isolated():
        disputes = []
        OVERTEMP_THRESHOLD = 45.0
        
        recent_logs = TemperatureLog.query.filter(
            TemperatureLog.log_time >= datetime.utcnow() - timedelta(hours=2),
            TemperatureLog.temperature >= OVERTEMP_THRESHOLD
        ).all()
        
        for log in recent_logs:
            if log.battery_id:
                battery = Battery.query.get(log.battery_id)
                if battery and battery.status != 'maintenance':
                    existing = Dispute.query.filter(
                        Dispute.dispute_type == 'overtemp_not_isolated',
                        Dispute.related_battery_id == battery.id,
                        Dispute.created_at >= datetime.utcnow() - timedelta(hours=1),
                        Dispute.status == 'pending_review'
                    ).first()
                    
                    if not existing:
                        dispute = Dispute(
                            dispute_code=f'DISP-OTI-{uuid.uuid4().hex[:8]}',
                            dispute_type='overtemp_not_isolated',
                            status='pending_review',
                            related_battery_id=battery.id,
                            related_door_id=battery.current_door_id,
                            description=f'电池 {battery.battery_code} 温度异常 ({log.temperature}°C) 但未隔离。当前状态: {battery.status}',
                            evidence=json.dumps({
                                'battery_code': battery.battery_code,
                                'temperature': log.temperature,
                                'threshold': OVERTEMP_THRESHOLD,
                                'log_time': log.log_time.isoformat(),
                                'current_status': battery.status
                            })
                        )
                        db.session.add(dispute)
                        disputes.append(dispute)
        
        db.session.commit()
        return disputes

    def detect_door_jammed_still_lent():
        disputes = []
        
        jammed_doors = CabinetDoor.query.filter_by(is_jammed=True).all()
        
        for door in jammed_doors:
            if door.jammed_at:
                swaps_after_jam = SwapRecord.query.filter(
                    SwapRecord.old_door_id == door.id,
                    SwapRecord.swap_started_at >= door.jammed_at,
                    SwapRecord.status == 'completed'
                ).all()
                
                for swap in swaps_after_jam:
                    existing = Dispute.query.filter(
                        Dispute.dispute_type == 'door_jammed_still_lent',
                        Dispute.related_swap_id == swap.id,
                        Dispute.status == 'pending_review'
                    ).first()
                    
                    if not existing:
                        dispute = Dispute(
                            dispute_code=f'DISP-DJSL-{uuid.uuid4().hex[:8]}',
                            dispute_type='door_jammed_still_lent',
                            status='pending_review',
                            related_swap_id=swap.id,
                            related_door_id=door.id,
                            description=f'柜门 {door.door_number} 在 {door.jammed_at} 报告卡滞后，仍在 {swap.swap_started_at} 出借了电池。换电单号: {swap.swap_code}',
                            evidence=json.dumps({
                                'door_number': door.door_number,
                                'jam_time': door.jammed_at.isoformat(),
                                'swap_code': swap.swap_code,
                                'swap_time': swap.swap_started_at.isoformat(),
                                'user_id': swap.user_id
                            })
                        )
                        db.session.add(dispute)
                        disputes.append(dispute)
        
        db.session.commit()
        return disputes

    def detect_duplicate_billing():
        disputes = []
        
        recent_swaps = SwapRecord.query.filter(
            SwapRecord.swap_started_at >= datetime.utcnow() - timedelta(hours=24),
            SwapRecord.status == 'completed'
        ).order_by(SwapRecord.user_id, SwapRecord.swap_started_at).all()
        
        user_swaps = defaultdict(list)
        for swap in recent_swaps:
            user_swaps[swap.user_id].append(swap)
        
        for user_id, swaps in user_swaps.items():
            for i in range(len(swaps)):
                for j in range(i + 1, len(swaps)):
                    swap1 = swaps[i]
                    swap2 = swaps[j]
                    
                    time_diff = abs((swap2.swap_started_at - swap1.swap_started_at).total_seconds())
                    
                    if time_diff < 300:
                        batteries_match = False
                        if swap1.new_battery_id and swap2.new_battery_id:
                            batteries_match = swap1.new_battery_id == swap2.new_battery_id
                        
                        if batteries_match or time_diff < 60:
                            existing = Dispute.query.filter(
                                Dispute.dispute_type == 'duplicate_billing',
                                Dispute.related_swap_id.in_([swap1.id, swap2.id]),
                                Dispute.status == 'pending_review'
                            ).first()
                            
                            if not existing:
                                dispute = Dispute(
                                    dispute_code=f'DISP-DB-{uuid.uuid4().hex[:8]}',
                                    dispute_type='duplicate_billing',
                                    status='pending_review',
                                    related_swap_id=swap1.id,
                                    description=f'用户 {user_id} 疑似重复计费。换电单 {swap1.swap_code} ({swap1.amount}元) 和 {swap2.swap_code} ({swap2.amount}元) 时间间隔仅 {time_diff:.0f} 秒。',
                                    evidence=json.dumps({
                                        'user_id': user_id,
                                        'swap1': {
                                            'code': swap1.swap_code,
                                            'time': swap1.swap_started_at.isoformat(),
                                            'amount': swap1.amount,
                                            'battery_id': swap1.new_battery_id
                                        },
                                        'swap2': {
                                            'code': swap2.swap_code,
                                            'time': swap2.swap_started_at.isoformat(),
                                            'amount': swap2.amount,
                                            'battery_id': swap2.new_battery_id
                                        },
                                        'time_diff_seconds': time_diff
                                    })
                                )
                                db.session.add(dispute)
                                disputes.append(dispute)
        
        db.session.commit()
        return disputes

    @app.route('/api/export/arbitration/<date_str>', methods=['GET'])
    def export_arbitration_markdown(date_str):
        try:
            target_date = parser.parse(date_str).date()
        except:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
        
        disputes = Dispute.query.filter(
            Dispute.created_at >= start_of_day,
            Dispute.created_at < end_of_day
        ).order_by(Dispute.dispute_type, Dispute.created_at).all()
        
        stats = {
            'total': len(disputes),
            'by_type': defaultdict(int),
            'by_status': defaultdict(int)
        }
        
        for d in disputes:
            stats['by_type'][d.dispute_type] += 1
            stats['by_status'][d.status] += 1
        
        markdown = f"""# 客服仲裁报告 - {target_date.strftime('%Y年%m月%d日')}

## 统计概览

| 指标 | 数值 |
|------|------|
| 总争议数 | {stats['total']} |

### 按类型分布

| 争议类型 | 数量 |
|----------|------|
"""
        
        for dtype, count in stats['by_type'].items():
            type_names = {
                'wrong_battery_misplaced': '疑似错放',
                'overtemp_not_isolated': '过温未隔离',
                'door_jammed_still_lent': '柜门卡滞后仍出借',
                'duplicate_billing': '重复计费'
            }
            markdown += f"| {type_names.get(dtype, dtype)} | {count} |\n"
        
        markdown += """
### 按状态分布

| 状态 | 数量 |
|------|------|
"""
        
        status_names = {
            'pending_review': '待复核',
            'confirmed': '已确认',
            'rejected': '已驳回',
            'resolved': '已解决'
        }
        
        for status, count in stats['by_status'].items():
            markdown += f"| {status_names.get(status, status)} | {count} |\n"
        
        markdown += f"""
## 争议详情

"""
        
        for i, dispute in enumerate(disputes, 1):
            type_name = {
                'wrong_battery_misplaced': '疑似错放',
                'overtemp_not_isolated': '过温未隔离',
                'door_jammed_still_lent': '柜门卡滞后仍出借',
                'duplicate_billing': '重复计费'
            }.get(dispute.dispute_type, dispute.dispute_type)
            
            status_name = status_names.get(dispute.status, dispute.status)
            
            markdown += f"""### 争议 #{i}: {dispute.dispute_code}

- **类型**: {type_name}
- **状态**: {status_name}
- **创建时间**: {dispute.created_at.strftime('%Y-%m-%d %H:%M:%S')}
- **描述**: {dispute.description or '无'}

"""
            
            if dispute.reviewer_id:
                markdown += f"""**复核信息**:
- 复核人: {dispute.reviewer_id}
- 复核时间: {dispute.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if dispute.reviewed_at else '无'}
- 复核意见: {dispute.review_comment or '无'}

"""
            
            markdown += "---\n\n"
        
        return Response(
            markdown,
            mimetype='text/markdown',
            headers={
                'Content-Disposition': f'attachment; filename=arbitration_{date_str}.md'
            }
        )

    @app.route('/api/export/audit/<date_str>', methods=['GET'])
    def export_audit_json(date_str):
        try:
            target_date = parser.parse(date_str).date()
        except:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
        
        audit_data = {
            'export_date': datetime.utcnow().isoformat(),
            'audit_date': target_date.isoformat(),
            'summary': {},
            'batteries': [],
            'doors': [],
            'swap_records': [],
            'maintenance_orders': [],
            'disputes': []
        }
        
        batteries = Battery.query.all()
        audit_data['batteries'] = [b.to_dict() for b in batteries]
        
        doors = CabinetDoor.query.all()
        audit_data['doors'] = [d.to_dict() for d in doors]
        
        swaps = SwapRecord.query.filter(
            SwapRecord.swap_started_at >= start_of_day,
            SwapRecord.swap_started_at < end_of_day
        ).all()
        audit_data['swap_records'] = [s.to_dict() for s in swaps]
        
        maintenance = MaintenanceOrder.query.filter(
            MaintenanceOrder.created_at >= start_of_day,
            MaintenanceOrder.created_at < end_of_day
        ).all()
        audit_data['maintenance_orders'] = [o.to_dict() for o in maintenance]
        
        disputes = Dispute.query.filter(
            Dispute.created_at >= start_of_day,
            Dispute.created_at < end_of_day
        ).all()
        audit_data['disputes'] = [d.to_dict() for d in disputes]
        
        audit_data['summary'] = {
            'total_batteries': len(audit_data['batteries']),
            'total_doors': len(audit_data['doors']),
            'swap_records_count': len(audit_data['swap_records']),
            'maintenance_orders_count': len(audit_data['maintenance_orders']),
            'disputes_count': len(audit_data['disputes'])
        }
        
        return Response(
            json.dumps(audit_data, indent=2, ensure_ascii=False),
            mimetype='application/json',
            headers={
                'Content-Disposition': f'attachment; filename=audit_{date_str}.json'
            }
        )
