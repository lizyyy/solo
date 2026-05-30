import pandas as pd
from datetime import datetime
from models import Rental, Student, Equipment, DamageRecord, Anomaly, Reminder
from app import app, db
import os

class ReportExporter:
    @staticmethod
    def export_rental_report(filter_params=None, filename=None):
        query = Rental.query
        
        if filter_params:
            if filter_params.get('status'):
                query = query.filter(Rental.status == filter_params['status'])
            if filter_params.get('student_id'):
                query = query.filter(Rental.student_id == filter_params['student_id'])
            if filter_params.get('equipment_id'):
                query = query.filter(Rental.equipment_id == filter_params['equipment_id'])
            if filter_params.get('date_from'):
                query = query.filter(Rental.rent_date >= filter_params['date_from'])
            if filter_params.get('date_to'):
                query = query.filter(Rental.rent_date <= filter_params['date_to'])
            if filter_params.get('overdue_only'):
                query = query.filter(Rental.status == 'overdue')
        
        rentals = query.all()
        
        data = []
        for rental in rentals:
            deposit_balance = rental.deposit_paid - rental.deposit_refunded - rental.rental_fee - rental.damage_fee
            
            data.append({
                '租赁单号': rental.rental_number or f'R{rental.id:06d}',
                '学生姓名': rental.student.name if rental.student else '',
                '学号': rental.student.student_id if rental.student else '',
                '设备编号': rental.equipment.serial_number if rental.equipment else '',
                '设备名称': rental.equipment.name if rental.equipment else '',
                '设备类型': rental.equipment.type if rental.equipment else '',
                '租赁日期': rental.rent_date.strftime('%Y-%m-%d') if rental.rent_date else '',
                '应还日期': rental.due_date.strftime('%Y-%m-%d') if rental.due_date else '',
                '实际归还日期': rental.return_date.strftime('%Y-%m-%d') if rental.return_date else '',
                '状态': rental.status,
                '已交押金': rental.deposit_paid,
                '已退押金': rental.deposit_refunded,
                '租金': rental.rental_fee,
                '损坏赔偿': rental.damage_fee,
                '押金余额': deposit_balance,
                '确认人': rental.confirmed_by or '',
                '确认时间': rental.confirmed_at.strftime('%Y-%m-%d %H:%M') if rental.confirmed_at else '',
                '备注': rental.notes or ''
            })
        
        df = pd.DataFrame(data)
        
        if filename is None:
            filename = f'rental_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        
        filepath = os.path.join(app.config['EXPORT_FOLDER'], filename)
        
        with pd.ExcelWriter(filepath, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='租赁记录', index=False)
            
            workbook = writer.book
            worksheet = writer.sheets['租赁记录']
            
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#4472C4',
                'font_color': 'white',
                'border': 1
            })
            
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
            
            for i, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
                worksheet.set_column(i, i, min(max_len, 30))
        
        return filepath, len(data)

    @staticmethod
    def export_deposit_tracking_report(filename=None):
        rentals = Rental.query.filter(Rental.deposit_paid > 0).all()
        
        data = []
        for rental in rentals:
            total_charges = rental.rental_fee + rental.damage_fee
            expected_refund = rental.deposit_paid - total_charges
            actual_refund = rental.deposit_refunded
            refund_diff = expected_refund - actual_refund
            
            status = '正常'
            if refund_diff > 0.01:
                status = '待退款'
            elif refund_diff < -0.01:
                status = '超额退款'
            elif rental.return_date is None:
                status = '租赁中'
            
            data.append({
                '租赁单号': rental.rental_number or f'R{rental.id:06d}',
                '学生姓名': rental.student.name if rental.student else '',
                '设备名称': rental.equipment.name if rental.equipment else '',
                '租赁状态': rental.status,
                '押金标准': rental.equipment.deposit_amount if rental.equipment else 0,
                '已交押金': rental.deposit_paid,
                '租金': rental.rental_fee,
                '损坏赔偿': rental.damage_fee,
                '应退押金': round(expected_refund, 2),
                '已退押金': actual_refund,
                '差额': round(refund_diff, 2),
                '退款状态': status,
                '租赁日期': rental.rent_date.strftime('%Y-%m-%d') if rental.rent_date else '',
                '归还日期': rental.return_date.strftime('%Y-%m-%d') if rental.return_date else ''
            })
        
        df = pd.DataFrame(data)
        
        if filename is None:
            filename = f'deposit_tracking_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        
        filepath = os.path.join(app.config['EXPORT_FOLDER'], filename)
        
        with pd.ExcelWriter(filepath, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='押金追踪', index=False)
            
            summary_data = [
                ['统计项', '数量', '金额'],
                ['租赁单数', len(rentals), ''],
                ['押金总额', '', sum(r.deposit_paid for r in rentals)],
                ['已退总额', '', sum(r.deposit_refunded for r in rentals)],
                ['待退总额', '', sum(max(0, r.deposit_paid - r.deposit_refunded - r.rental_fee - r.damage_fee) for r in rentals)],
                ['待退款单数', '', sum(1 for r in rentals if (r.deposit_paid - r.deposit_refunded - r.rental_fee - r.damage_fee) > 0.01)]
            ]
            
            summary_df = pd.DataFrame(summary_data[1:], columns=summary_data[0])
            summary_df.to_excel(writer, sheet_name='统计汇总', index=False)
        
        return filepath, len(data)

    @staticmethod
    def export_anomaly_report(filename=None):
        anomalies = Anomaly.query.order_by(Anomaly.severity.desc(), Anomaly.detected_at.desc()).all()
        
        data = []
        for anomaly in anomalies:
            severity_map = {'error': '严重', 'warning': '警告', 'info': '提示'}
            data.append({
                '异常ID': anomaly.id,
                '类型': anomaly.type,
                '严重程度': severity_map.get(anomaly.severity, anomaly.severity),
                '描述': anomaly.description,
                '建议处理方案': anomaly.suggested_action or '',
                '检测时间': anomaly.detected_at.strftime('%Y-%m-%d %H:%M') if anomaly.detected_at else '',
                '状态': '已解决' if anomaly.resolved else '未解决',
                '解决人': anomaly.resolved_by or '',
                '解决时间': anomaly.resolved_at.strftime('%Y-%m-%d %H:%M') if anomaly.resolved_at else '',
                '解决说明': anomaly.resolution or ''
            })
        
        df = pd.DataFrame(data)
        
        if filename is None:
            filename = f'anomaly_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        
        filepath = os.path.join(app.config['EXPORT_FOLDER'], filename)
        
        with pd.ExcelWriter(filepath, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='异常报告', index=False)
            
            workbook = writer.book
            red_format = workbook.add_format({'bg_color': '#FFC7CE', 'font_color': '#9C0006'})
            yellow_format = workbook.add_format({'bg_color': '#FFEB9C', 'font_color': '#9C5700'})
            
            worksheet = writer.sheets['异常报告']
            for row_num, anomaly in enumerate(anomalies, 1):
                if anomaly.severity == 'error' and not anomaly.resolved:
                    worksheet.set_row(row_num, None, red_format)
                elif anomaly.severity == 'warning' and not anomaly.resolved:
                    worksheet.set_row(row_num, None, yellow_format)
        
        return filepath, len(data)

    @staticmethod
    def export_damage_report(filename=None):
        damages = DamageRecord.query.order_by(DamageRecord.reported_date.desc()).all()
        
        data = []
        for damage in damages:
            data.append({
                '记录ID': damage.id,
                '租赁单号': damage.rental.rental_number if damage.rental else '',
                '设备编号': damage.equipment.serial_number if damage.equipment else '',
                '设备名称': damage.equipment.name if damage.equipment else '',
                '学生姓名': damage.rental.student.name if damage.rental and damage.rental.student else '',
                '报告日期': damage.reported_date.strftime('%Y-%m-%d') if damage.reported_date else '',
                '损坏描述': damage.description,
                '严重程度': damage.severity,
                '维修费用': damage.repair_cost,
                '赔偿费用': damage.fee_charged,
                '报告人': damage.reported_by or '',
                '是否解决': '是' if damage.resolved else '否',
                '解决日期': damage.resolved_date.strftime('%Y-%m-%d') if damage.resolved_date else '',
                '解决说明': damage.resolution_notes or ''
            })
        
        df = pd.DataFrame(data)
        
        if filename is None:
            filename = f'damage_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        
        filepath = os.path.join(app.config['EXPORT_FOLDER'], filename)
        df.to_excel(filepath, index=False)
        
        return filepath, len(data)

    @staticmethod
    def export_full_report(filename=None):
        if filename is None:
            filename = f'full_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        
        filepath = os.path.join(app.config['EXPORT_FOLDER'], filename)
        
        with pd.ExcelWriter(filepath, engine='xlsxwriter') as writer:
            rentals = Rental.query.all()
            rental_data = []
            for r in rentals:
                rental_data.append({
                    '租赁单号': r.rental_number or f'R{r.id:06d}',
                    '学生': r.student.name if r.student else '',
                    '设备': r.equipment.name if r.equipment else '',
                    '租赁日期': r.rent_date.strftime('%Y-%m-%d') if r.rent_date else '',
                    '状态': r.status,
                    '押金': r.deposit_paid,
                    '租金': r.rental_fee
                })
            pd.DataFrame(rental_data).to_excel(writer, sheet_name='租赁概览', index=False)
            
            students = Student.query.all()
            student_data = []
            for s in students:
                student_data.append({
                    '姓名': s.name,
                    '学号': s.student_id or '',
                    '电话': s.phone or '',
                    '邮箱': s.email or '',
                    '租赁次数': len(s.rentals)
                })
            pd.DataFrame(student_data).to_excel(writer, sheet_name='学生名单', index=False)
            
            equipment = Equipment.query.all()
            eq_data = []
            for e in equipment:
                eq_data.append({
                    '编号': e.serial_number,
                    '名称': e.name,
                    '类型': e.type or '',
                    '品牌': e.brand or '',
                    '押金': e.deposit_amount,
                    '日租金': e.daily_rate,
                    '状态': e.status
                })
            pd.DataFrame(eq_data).to_excel(writer, sheet_name='设备清单', index=False)
        
        return filepath
