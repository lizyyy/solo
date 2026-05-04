from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
import os
from datetime import datetime, timedelta
import io
import json

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///queue_analysis.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)


class QueueRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket_number = db.Column(db.String(20))
    patient_type = db.Column(db.String(50))
    specimen_type = db.Column(db.String(100))
    is_fasting = db.Column(db.Boolean, default=False)
    is_elderly = db.Column(db.Boolean, default=False)
    arrival_time = db.Column(db.DateTime)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    window_number = db.Column(db.Integer)
    status = db.Column(db.String(50))
    is_abnormal = db.Column(db.Boolean, default=False)
    abnormal_reason = db.Column(db.String(200))
    wait_minutes = db.Column(db.Integer)
    service_minutes = db.Column(db.Integer)
    import_date = db.Column(db.DateTime, default=datetime.utcnow)


class WindowSchedule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    window_number = db.Column(db.Integer)
    date = db.Column(db.Date)
    open_time = db.Column(db.Time)
    close_time = db.Column(db.Time)
    is_open = db.Column(db.Boolean, default=True)
    import_date = db.Column(db.DateTime, default=datetime.utcnow)


class ManualNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    record_date = db.Column(db.Date)
    time_slot = db.Column(db.String(20))
    window_number = db.Column(db.Integer, nullable=True)
    note_type = db.Column(db.String(50))
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ShiftRecommendation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date)
    time_slot = db.Column(db.String(20))
    recommendation_type = db.Column(db.String(50))
    current_windows = db.Column(db.Integer)
    recommended_windows = db.Column(db.Integer)
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


with app.app_context():
    db.create_all()


def parse_time(time_str):
    if pd.isna(time_str) or time_str == '':
        return None
    try:
        for fmt in ['%H:%M:%S', '%H:%M', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S']:
            try:
                dt = datetime.strptime(str(time_str).strip(), fmt)
                if dt.year == 1900:
                    dt = dt.replace(year=datetime.now().year, month=datetime.now().month, day=datetime.now().day)
                return dt
            except ValueError:
                continue
        return pd.to_datetime(time_str)
    except:
        return None


def calculate_wait_metrics(df):
    if df.empty:
        return {}
    
    metrics = {
        'total_patients': len(df),
        'elderly_patients': len(df[df['is_elderly'] == True]),
        'fasting_patients': len(df[df['is_fasting'] == True]),
        'abnormal_samples': len(df[df['is_abnormal'] == True]),
        'avg_wait_time': df['wait_minutes'].mean() if 'wait_minutes' in df.columns else 0,
        'max_wait_time': df['wait_minutes'].max() if 'wait_minutes' in df.columns and not df.empty else 0,
        'avg_service_time': df['service_minutes'].mean() if 'service_minutes' in df.columns else 0,
    }
    
    if 'abnormal_reason' in df.columns:
        abnormal_counts = df[df['is_abnormal'] == True]['abnormal_reason'].value_counts()
        metrics['abnormal_reasons'] = abnormal_counts.to_dict()
    
    return metrics


def calculate_window_utilization(records_df, schedule_df, analysis_date):
    utilization_data = []
    
    if schedule_df.empty:
        windows = records_df['window_number'].dropna().unique()
        for window in windows:
            window_records = records_df[records_df['window_number'] == window]
            if not window_records.empty:
                first_time = window_records['start_time'].min()
                last_time = window_records['end_time'].max()
                if pd.notna(first_time) and pd.notna(last_time):
                    total_minutes = (last_time - first_time).total_seconds() / 60
                    service_minutes = window_records['service_minutes'].sum()
                    utilization = (service_minutes / total_minutes * 100) if total_minutes > 0 else 0
                    utilization_data.append({
                        'window': window,
                        'utilization': round(utilization, 2),
                        'total_minutes': round(total_minutes, 2),
                        'service_minutes': round(service_minutes, 2),
                        'patient_count': len(window_records)
                    })
    else:
        for _, schedule in schedule_df.iterrows():
            window = schedule['window_number']
            window_records = records_df[records_df['window_number'] == window]
            
            open_time = schedule.get('open_time')
            close_time = schedule.get('close_time')
            
            if isinstance(open_time, str):
                open_time = parse_time(open_time)
            if isinstance(close_time, str):
                close_time = parse_time(close_time)
            
            if open_time and close_time:
                total_minutes = (close_time - open_time).total_seconds() / 60
                service_minutes = window_records['service_minutes'].sum() if not window_records.empty else 0
                utilization = (service_minutes / total_minutes * 100) if total_minutes > 0 else 0
                
                utilization_data.append({
                    'window': window,
                    'utilization': round(utilization, 2),
                    'total_minutes': round(total_minutes, 2),
                    'service_minutes': round(service_minutes, 2),
                    'patient_count': len(window_records),
                    'is_open': schedule.get('is_open', True)
                })
    
    return utilization_data


def calculate_time_slot_metrics(df):
    if df.empty or 'start_time' not in df.columns:
        return {}
    
    df = df.copy()
    df['hour'] = df['start_time'].apply(lambda x: x.hour if pd.notna(x) else None)
    df['time_slot'] = df['hour'].apply(lambda h: f"{h:02d}:00-{h+1:02d}:00" if pd.notna(h) else None)
    
    slot_metrics = {}
    for slot in df['time_slot'].dropna().unique():
        slot_df = df[df['time_slot'] == slot]
        slot_metrics[slot] = {
            'patient_count': len(slot_df),
            'elderly_count': len(slot_df[slot_df['is_elderly'] == True]),
            'fasting_count': len(slot_df[slot_df['is_fasting'] == True]),
            'avg_wait': round(slot_df['wait_minutes'].mean(), 2) if 'wait_minutes' in slot_df.columns else 0,
            'max_wait': slot_df['wait_minutes'].max() if 'wait_minutes' in slot_df.columns and not slot_df.empty else 0,
            'abnormal_count': len(slot_df[slot_df['is_abnormal'] == True]),
        }
    
    return slot_metrics


def calculate_timeout_risk(df, wait_threshold=30):
    risk_data = {
        'high_risk_count': len(df[df['wait_minutes'] > wait_threshold]) if 'wait_minutes' in df.columns else 0,
        'medium_risk_count': len(df[(df['wait_minutes'] >= 20) & (df['wait_minutes'] <= wait_threshold)]) if 'wait_minutes' in df.columns else 0,
        'low_risk_count': len(df[df['wait_minutes'] < 20]) if 'wait_minutes' in df.columns else 0,
    }
    
    if 'is_elderly' in df.columns and 'wait_minutes' in df.columns:
        elderly_wait = df[df['is_elderly'] == True]['wait_minutes']
        risk_data['elderly_high_risk'] = len(elderly_wait[elderly_wait > wait_threshold])
    
    if 'is_fasting' in df.columns and 'wait_minutes' in df.columns:
        fasting_wait = df[df['is_fasting'] == True]['wait_minutes']
        risk_data['fasting_high_risk'] = len(fasting_wait[fasting_wait > wait_threshold])
    
    return risk_data


def calculate_specimen_type_metrics(df):
    if 'specimen_type' not in df.columns:
        return {}
    
    specimen_metrics = {}
    for specimen in df['specimen_type'].dropna().unique():
        specimen_df = df[df['specimen_type'] == specimen]
        specimen_metrics[specimen] = {
            'count': len(specimen_df),
            'avg_wait': round(specimen_df['wait_minutes'].mean(), 2) if 'wait_minutes' in specimen_df.columns else 0,
            'max_wait': specimen_df['wait_minutes'].max() if 'wait_minutes' in specimen_df.columns and not specimen_df.empty else 0,
            'abnormal_rate': round(len(specimen_df[specimen_df['is_abnormal'] == True]) / len(specimen_df) * 100, 2) if len(specimen_df) > 0 else 0,
        }
    
    return specimen_metrics


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_files():
    try:
        queue_file = request.files.get('queue_file')
        window_file = request.files.get('window_file')
        specimen_file = request.files.get('specimen_file')
        abnormal_file = request.files.get('abnormal_file')
        
        if not queue_file:
            return jsonify({'success': False, 'message': '请提供叫号记录文件'})
        
        analysis_date_str = request.form.get('analysis_date', datetime.now().strftime('%Y-%m-%d'))
        analysis_date = datetime.strptime(analysis_date_str, '%Y-%m-%d').date()
        
        QueueRecord.query.filter(db.func.date(QueueRecord.import_date) == analysis_date).delete()
        WindowSchedule.query.filter(WindowSchedule.date == analysis_date).delete()
        db.session.commit()
        
        queue_path = os.path.join(app.config['UPLOAD_FOLDER'], queue_file.filename)
        queue_file.save(queue_path)
        
        df_queue = pd.read_csv(queue_path, encoding='utf-8')
        
        for col in ['is_fasting', 'is_elderly', 'is_abnormal']:
            if col in df_queue.columns:
                df_queue[col] = df_queue[col].astype(bool)
            else:
                df_queue[col] = False
        
        for idx, row in df_queue.iterrows():
            arrival_time = parse_time(row.get('arrival_time'))
            start_time = parse_time(row.get('start_time'))
            end_time = parse_time(row.get('end_time'))
            
            wait_minutes = 0
            if arrival_time and start_time:
                wait_minutes = int((start_time - arrival_time).total_seconds() / 60)
            
            service_minutes = 0
            if start_time and end_time:
                service_minutes = int((end_time - start_time).total_seconds() / 60)
            
            record = QueueRecord(
                ticket_number=str(row.get('ticket_number', '')),
                patient_type=str(row.get('patient_type', '')),
                specimen_type=str(row.get('specimen_type', '')),
                is_fasting=row.get('is_fasting', False),
                is_elderly=row.get('is_elderly', False),
                arrival_time=arrival_time,
                start_time=start_time,
                end_time=end_time,
                window_number=int(row['window_number']) if pd.notna(row.get('window_number')) else None,
                status=str(row.get('status', '')),
                is_abnormal=row.get('is_abnormal', False),
                abnormal_reason=str(row.get('abnormal_reason', '')),
                wait_minutes=wait_minutes,
                service_minutes=service_minutes
            )
            db.session.add(record)
        
        if window_file:
            window_path = os.path.join(app.config['UPLOAD_FOLDER'], window_file.filename)
            window_file.save(window_path)
            df_window = pd.read_csv(window_path, encoding='utf-8')
            
            for idx, row in df_window.iterrows():
                open_time = parse_time(row.get('open_time'))
                close_time = parse_time(row.get('close_time'))
                
                schedule = WindowSchedule(
                    window_number=int(row['window_number']) if pd.notna(row.get('window_number')) else 0,
                    date=analysis_date,
                    open_time=open_time.time() if open_time else None,
                    close_time=close_time.time() if close_time else None,
                    is_open=bool(row.get('is_open', True))
                )
                db.session.add(schedule)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'成功导入 {len(df_queue)} 条叫号记录',
            'analysis_date': analysis_date_str
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/analyze', methods=['GET'])
def analyze():
    try:
        analysis_date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        analysis_date = datetime.strptime(analysis_date_str, '%Y-%m-%d').date()
        
        records = QueueRecord.query.all()
        schedules = WindowSchedule.query.filter(WindowSchedule.date == analysis_date).all()
        
        if not records:
            return jsonify({'success': False, 'message': '没有找到数据，请先导入'})
        
        records_data = []
        for r in records:
            records_data.append({
                'ticket_number': r.ticket_number,
                'patient_type': r.patient_type,
                'specimen_type': r.specimen_type,
                'is_fasting': r.is_fasting,
                'is_elderly': r.is_elderly,
                'arrival_time': r.arrival_time,
                'start_time': r.start_time,
                'end_time': r.end_time,
                'window_number': r.window_number,
                'status': r.status,
                'is_abnormal': r.is_abnormal,
                'abnormal_reason': r.abnormal_reason,
                'wait_minutes': r.wait_minutes,
                'service_minutes': r.service_minutes,
            })
        
        df_records = pd.DataFrame(records_data)
        
        schedules_data = []
        for s in schedules:
            schedules_data.append({
                'window_number': s.window_number,
                'open_time': s.open_time,
                'close_time': s.close_time,
                'is_open': s.is_open
            })
        df_schedules = pd.DataFrame(schedules_data)
        
        wait_metrics = calculate_wait_metrics(df_records)
        window_utilization = calculate_window_utilization(df_records, df_schedules, analysis_date)
        time_slot_metrics = calculate_time_slot_metrics(df_records)
        timeout_risk = calculate_timeout_risk(df_records)
        specimen_metrics = calculate_specimen_type_metrics(df_records)
        
        notes = ManualNote.query.filter(ManualNote.record_date == analysis_date).all()
        notes_data = []
        for n in notes:
            notes_data.append({
                'id': n.id,
                'time_slot': n.time_slot,
                'window_number': n.window_number,
                'note_type': n.note_type,
                'content': n.content,
                'created_at': n.created_at.isoformat() if n.created_at else None
            })
        
        return jsonify({
            'success': True,
            'analysis_date': analysis_date_str,
            'wait_metrics': wait_metrics,
            'window_utilization': window_utilization,
            'time_slot_metrics': time_slot_metrics,
            'timeout_risk': timeout_risk,
            'specimen_metrics': specimen_metrics,
            'notes': notes_data
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/notes', methods=['POST'])
def add_note():
    try:
        data = request.get_json()
        note_date_str = data.get('date', datetime.now().strftime('%Y-%m-%d'))
        note_date = datetime.strptime(note_date_str, '%Y-%m-%d').date()
        
        note = ManualNote(
            record_date=note_date,
            time_slot=data.get('time_slot'),
            window_number=data.get('window_number'),
            note_type=data.get('note_type'),
            content=data.get('content')
        )
        db.session.add(note)
        db.session.commit()
        
        return jsonify({'success': True, 'id': note.id, 'message': '备注保存成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    try:
        note = ManualNote.query.get(note_id)
        if not note:
            return jsonify({'success': False, 'message': '备注不存在'})
        
        data = request.get_json()
        note.content = data.get('content', note.content)
        note.note_type = data.get('note_type', note.note_type)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '备注更新成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    try:
        note = ManualNote.query.get(note_id)
        if not note:
            return jsonify({'success': False, 'message': '备注不存在'})
        
        db.session.delete(note)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '备注删除成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/export/markdown', methods=['GET'])
def export_markdown():
    try:
        analysis_date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        analysis_date = datetime.strptime(analysis_date_str, '%Y-%m-%d').date()
        
        records = QueueRecord.query.all()
        notes = ManualNote.query.filter(ManualNote.record_date == analysis_date).all()
        
        if not records:
            return jsonify({'success': False, 'message': '没有数据可导出'})
        
        records_data = []
        for r in records:
            records_data.append({
                'is_fasting': r.is_fasting,
                'is_elderly': r.is_elderly,
                'wait_minutes': r.wait_minutes,
                'service_minutes': r.service_minutes,
                'is_abnormal': r.is_abnormal,
                'specimen_type': r.specimen_type,
                'window_number': r.window_number
            })
        df = pd.DataFrame(records_data)
        
        total_patients = len(df)
        elderly_patients = len(df[df['is_elderly'] == True])
        fasting_patients = len(df[df['is_fasting'] == True])
        abnormal_count = len(df[df['is_abnormal'] == True])
        
        avg_wait = df['wait_minutes'].mean() if not df.empty else 0
        max_wait = df['wait_minutes'].max() if not df.empty else 0
        
        elderly_high_risk = len(df[(df['is_elderly'] == True) & (df['wait_minutes'] > 30)])
        fasting_high_risk = len(df[(df['is_fasting'] == True) & (df['wait_minutes'] > 30)])
        
        md_content = f"""# 采血窗口排队复盘报告

**分析日期**: {analysis_date_str}
**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 一、整体概况

| 指标 | 数值 |
|------|------|
| 总患者数 | {total_patients} |
| 老年患者数 | {elderly_patients} |
| 空腹项目数 | {fasting_patients} |
| 异常样本数 | {abnormal_count} |
| 平均等待时间 | {avg_wait:.1f} 分钟 |
| 最长等待时间 | {max_wait} 分钟 |

---

## 二、超时风险分析

### 2.1 风险等级分布
- **高风险 (>30分钟)**: {len(df[df['wait_minutes'] > 30]) if not df.empty else 0} 人
- **中风险 (20-30分钟)**: {len(df[(df['wait_minutes'] >= 20) & (df['wait_minutes'] <= 30)]) if not df.empty else 0} 人
- **低风险 (<20分钟)**: {len(df[df['wait_minutes'] < 20]) if not df.empty else 0} 人

### 2.2 重点关注人群
- **老年患者超时 (>30分钟)**: {elderly_high_risk} 人 ({elderly_high_risk/elderly_patients*100:.1f}%)
- **空腹项目超时 (>30分钟)**: {fasting_high_risk} 人 ({fasting_high_risk/fasting_patients*100:.1f}%)

---

## 三、窗口利用率分析

"""
        
        windows = df['window_number'].dropna().unique()
        for w in sorted(windows):
            w_df = df[df['window_number'] == w]
            if not w_df.empty:
                service_total = w_df['service_minutes'].sum()
                md_content += f"""
### 窗口 {w}
- 服务患者数: {len(w_df)}
- 累计服务时间: {service_total} 分钟
- 平均等待时间: {w_df['wait_minutes'].mean():.1f} 分钟
"""
        
        md_content += """
---

## 四、标本类型分析

"""
        
        if 'specimen_type' in df.columns:
            specimens = df['specimen_type'].dropna().unique()
            for s in specimens:
                if s and s != 'nan':
                    s_df = df[df['specimen_type'] == s]
                    abnormal_rate = len(s_df[s_df['is_abnormal'] == True]) / len(s_df) * 100 if len(s_df) > 0 else 0
                    md_content += f"""
### {s}
- 样本数: {len(s_df)}
- 平均等待时间: {s_df['wait_minutes'].mean():.1f} 分钟
- 异常率: {abnormal_rate:.1f}%
"""
        
        md_content += """
---

## 五、人工备注

"""
        
        if notes:
            for n in notes:
                md_content += f"""
### {n.note_type or '备注'} - {n.time_slot or '全天'}
**窗口**: {n.window_number if n.window_number else '全部'}
**内容**: {n.content}

"""
        else:
            md_content += "暂无人工备注\n"
        
        md_content += """
---

## 六、改进建议

1. **窗口调配**: 根据高峰时段增加开放窗口数量
2. **老年优先**: 考虑为老年患者设立专用窗口或优先通道
3. **空腹管理**: 提前开放空腹项目窗口，减少空腹患者等待时间
4. **异常追踪**: 对异常样本进行根源分析，减少重复采血

"""
        
        output = io.BytesIO()
        output.write(md_content.encode('utf-8'))
        output.seek(0)
        
        return send_file(
            output,
            as_attachment=True,
            download_name=f'queue_analysis_{analysis_date_str}.md',
            mimetype='text/markdown'
        )
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/export/shift_recommendation', methods=['GET'])
def export_shift_recommendation():
    try:
        analysis_date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        analysis_date = datetime.strptime(analysis_date_str, '%Y-%m-%d').date()
        
        records = QueueRecord.query.all()
        
        if not records:
            return jsonify({'success': False, 'message': '没有数据可导出'})
        
        records_data = []
        for r in records:
            records_data.append({
                'start_time': r.start_time,
                'is_elderly': r.is_elderly,
                'is_fasting': r.is_fasting,
                'wait_minutes': r.wait_minutes,
                'window_number': r.window_number
            })
        df = pd.DataFrame(records_data)
        
        df['hour'] = df['start_time'].apply(lambda x: x.hour if pd.notna(x) else None)
        df['time_slot'] = df['hour'].apply(lambda h: f"{h:02d}:00-{h+1:02d}:00" if pd.notna(h) else None)
        
        recommendations = []
        current_windows = df['window_number'].nunique()
        
        for slot in df['time_slot'].dropna().unique():
            slot_df = df[df['time_slot'] == slot]
            
            patient_count = len(slot_df)
            elderly_count = len(slot_df[slot_df['is_elderly'] == True])
            fasting_count = len(slot_df[slot_df['is_fasting'] == True])
            avg_wait = slot_df['wait_minutes'].mean()
            
            recommendation_type = '正常'
            recommended_windows = current_windows
            reason = '患者流量正常'
            
            if patient_count > 15 or avg_wait > 20:
                recommendation_type = '增开窗口'
                recommended_windows = min(current_windows + 1, 5)
                reason = f'患者数 {patient_count} 人，平均等待 {avg_wait:.1f} 分钟，建议增开窗口'
            elif elderly_count > 5:
                recommendation_type = '老年高峰'
                recommended_windows = current_windows
                reason = f'老年患者 {elderly_count} 人，建议关注老年患者等待情况'
            elif fasting_count > 8:
                recommendation_type = '空腹高峰'
                recommended_windows = current_windows
                reason = f'空腹项目 {fasting_count} 人，建议提前开放窗口'
            elif patient_count < 5:
                recommendation_type = '可减少'
                recommended_windows = max(current_windows - 1, 1)
                reason = f'患者数 {patient_count} 人，可考虑减少窗口'
            
            recommendations.append({
                '日期': analysis_date_str,
                '时段': slot,
                '当前窗口数': current_windows,
                '建议窗口数': recommended_windows,
                '患者数': patient_count,
                '老年患者': elderly_count,
                '空腹项目': fasting_count,
                '平均等待(分钟)': round(avg_wait, 1),
                '建议类型': recommendation_type,
                '建议原因': reason
            })
        
        df_rec = pd.DataFrame(recommendations)
        df_rec = df_rec.sort_values('时段')
        
        output = io.BytesIO()
        df_rec.to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)
        
        return send_file(
            output,
            as_attachment=True,
            download_name=f'shift_recommendation_{analysis_date_str}.csv',
            mimetype='text/csv'
        )
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/sample_data', methods=['GET'])
def get_sample_data():
    sample_path = os.path.join(os.path.dirname(__file__), 'sample_data', 'queue_records.csv')
    return send_file(
        sample_path,
        as_attachment=True,
        download_name='queue_records_sample.csv'
    )


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
