from flask import Blueprint, request, jsonify, current_app, send_file
from extensions import db
from models.models import Site, EquipmentType, Equipment, Inventory, Member, Booking, Rental, Maintenance, AuditLog
from datetime import datetime, timedelta
import os
import csv
import json

import_export = Blueprint('import_export', __name__)

# CSV 导入功能
@import_export.route('/import/csv', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    # 获取数据类型
    data_type = request.form.get('type', '').lower()
    
    if not data_type:
        return jsonify({'error': '请指定数据类型'}), 400
    
    # 保存文件
    filename = f"{data_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    try:
        results = import_csv_data(filepath, data_type)
        return jsonify({
            'message': f'成功导入 {results["success"]} 条记录',
            'errors': results.get('errors', []),
            'success_count': results['success'],
            'error_count': results.get('errors_count', 0)
        }), 200
    except Exception as e:
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

def import_csv_data(filepath, data_type):
    results = {'success': 0, 'errors': [], 'errors_count': 0}
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            try:
                if data_type == 'sites':
                    site = Site(
                        name=row.get('name', ''),
                        address=row.get('address'),
                        contact_person=row.get('contact_person'),
                        phone=row.get('phone')
                    )
                    db.session.add(site)
                    
                elif data_type == 'equipment_types':
                    eq_type = EquipmentType(
                        name=row.get('name', ''),
                        description=row.get('description'),
                        deposit_amount=float(row.get('deposit_amount', 0)),
                        daily_rental_fee=float(row.get('daily_rental_fee', 0)),
                        late_fee_per_day=float(row.get('late_fee_per_day', 0))
                    )
                    db.session.add(eq_type)
                    
                elif data_type == 'equipment':
                    equipment = Equipment(
                        equipment_type_id=int(row.get('equipment_type_id', 0)),
                        serial_number=row.get('serial_number'),
                        name=row.get('name', ''),
                        status=row.get('status', 'available'),
                        purchase_date=datetime.strptime(row['purchase_date'], '%Y-%m-%d').date() if row.get('purchase_date') else None,
                        notes=row.get('notes')
                    )
                    db.session.add(equipment)
                    
                elif data_type == 'inventory':
                    inventory = Inventory(
                        site_id=int(row.get('site_id', 0)),
                        equipment_id=int(row.get('equipment_id', 0)),
                        quantity=int(row.get('quantity', 1)),
                        available_quantity=int(row.get('available_quantity', 1)),
                        location=row.get('location')
                    )
                    db.session.add(inventory)
                    
                elif data_type == 'members':
                    member = Member(
                        member_number=row.get('member_number', f"M{datetime.now().strftime('%Y%m%d%H%M%S')}"),
                        name=row.get('name', ''),
                        id_card=row.get('id_card'),
                        phone=row.get('phone'),
                        address=row.get('address'),
                        gender=row.get('gender'),
                        birth_date=datetime.strptime(row['birth_date'], '%Y-%m-%d').date() if row.get('birth_date') else None,
                        is_blacklisted=row.get('is_blacklisted', 'false').lower() == 'true',
                        blacklist_reason=row.get('blacklist_reason')
                    )
                    db.session.add(member)
                    
                else:
                    raise ValueError(f'不支持的数据类型: {data_type}')
                
                results['success'] += 1
                db.session.commit()
                
            except Exception as e:
                db.session.rollback()
                results['errors'].append(f"行 {reader.line_num}: {str(e)}")
                results['errors_count'] += 1
    
    return results

# Markdown 周报导出
@import_export.route('/export/weekly-report', methods=['GET'])
def export_weekly_report():
    # 获取日期范围
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=7)
    
    # 支持自定义日期范围
    if request.args.get('start_date'):
        start_date = datetime.strptime(request.args.get('start_date'), '%Y-%m-%d').date()
    if request.args.get('end_date'):
        end_date = datetime.strptime(request.args.get('end_date'), '%Y-%m-%d').date()
    
    # 生成报告
    report_content = generate_weekly_report(start_date, end_date)
    
    # 保存文件
    filename = f"weekly_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.md"
    filepath = os.path.join(current_app.config['EXPORT_FOLDER'], filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    return send_file(filepath, as_attachment=True, download_name=filename)

def generate_weekly_report(start_date, end_date):
    # 统计数据
    total_rentals = Rental.query.filter(
        Rental.start_date >= start_date,
        Rental.start_date <= end_date
    ).count()
    
    total_returns = Rental.query.filter(
        Rental.actual_return_date >= start_date,
        Rental.actual_return_date <= end_date,
        Rental.status == 'returned'
    ).count()
    
    overdue_rentals = Rental.query.filter(
        Rental.expected_return_date < datetime.now().date(),
        Rental.status != 'returned'
    ).count()
    
    total_income = db.session.query(
        db.func.sum(Rental.total_fee)
    ).filter(
        Rental.actual_return_date >= start_date,
        Rental.actual_return_date <= end_date
    ).scalar() or 0
    
    active_maintenance = Maintenance.query.filter_by(status='in_progress').count()
    blacklisted_members = Member.query.filter_by(is_blacklisted=True).count()
    
    # 生成 Markdown 报告
    report = f"""# 辅具借还风险管家 - 周报

**报告周期**: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}

## 一、借还概览

| 指标 | 数值 |
|------|------|
| 借出次数 | {total_rentals} |
| 归还次数 | {total_returns} |
| 逾期未还 | {overdue_rentals} |
| 本周收入 | ¥{total_income:.2f} |

## 二、设备状态

| 状态 | 数量 |
|------|------|
| 维修/封存中 | {active_maintenance} |

## 三、会员情况

| 状态 | 数量 |
|------|------|
| 黑名单会员 | {blacklisted_members} |

## 四、风险预警

"""
    
    # 逾期预警
    if overdue_rentals > 0:
        report += f"### 4.1 逾期预警\n\n当前有 **{overdue_rentals}** 台设备逾期未还，请及时处理。\n\n"
    
    # 黑名单预警
    if blacklisted_members > 0:
        report += f"### 4.2 黑名单预警\n\n当前有 **{blacklisted_members}** 名会员在黑名单中，这些会员无法借出设备。\n\n"
    
    # 维修预警
    if active_maintenance > 0:
        report += f"### 4.3 维修/封存预警\n\n当前有 **{active_maintenance}** 台设备处于维修或封存状态。\n\n"
    
    report += """
## 五、建议措施

1. 对逾期设备进行跟进催收
2. 定期检查设备状态，及时安排维护
3. 对黑名单会员进行定期评估，考虑是否解除限制

---
**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    return report

# JSON 审计包导出
@import_export.route('/export/audit-package', methods=['GET'])
def export_audit_package():
    # 获取日期范围
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=30)
    
    if request.args.get('start_date'):
        start_date = datetime.strptime(request.args.get('start_date'), '%Y-%m-%d').date()
    if request.args.get('end_date'):
        end_date = datetime.strptime(request.args.get('end_date'), '%Y-%m-%d').date()
    
    # 生成审计包
    audit_package = generate_audit_package(start_date, end_date)
    
    # 保存文件
    filename = f"audit_package_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.json"
    filepath = os.path.join(current_app.config['EXPORT_FOLDER'], filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(audit_package, f, ensure_ascii=False, indent=2, default=str)
    
    return send_file(filepath, as_attachment=True, download_name=filename)

def generate_audit_package(start_date, end_date):
    # 获取审计日志
    audit_logs = AuditLog.query.filter(
        AuditLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        AuditLog.created_at <= datetime.combine(end_date, datetime.max.time())
    ).order_by(AuditLog.created_at).all()
    
    # 获取相关的借出记录
    rentals = Rental.query.filter(
        Rental.created_at >= datetime.combine(start_date, datetime.min.time()),
        Rental.created_at <= datetime.combine(end_date, datetime.max.time())
    ).all()
    
    # 获取会员信息
    members = Member.query.all()
    
    # 获取设备信息
    equipment = Equipment.query.all()
    
    # 生成审计包
    return {
        'package_info': {
            'generated_at': datetime.now().isoformat(),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        },
        'audit_logs': [log.to_dict() for log in audit_logs],
        'rentals': [r.to_dict() for r in rentals],
        'members_summary': {
            'total': len(members),
            'blacklisted': sum(1 for m in members if m.is_blacklisted)
        },
        'equipment_summary': {
            'total': len(equipment),
            'by_status': {
                'available': sum(1 for e in equipment if e.status == 'available'),
                'in_use': sum(1 for e in equipment if e.status == 'in_use'),
                'maintenance': sum(1 for e in equipment if e.status == 'maintenance'),
                'retired': sum(1 for e in equipment if e.status == 'retired')
            }
        },
        'statistics': {
            'total_audit_logs': len(audit_logs),
            'total_rentals': len(rentals),
            'overdue_rentals': sum(1 for r in rentals if r.status == 'overdue')
        }
    }
