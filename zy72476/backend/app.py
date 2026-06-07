from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import uuid
import json
import io
import sqlite3
from datetime import datetime

from database import init_db, get_db
from self_check import run_all_checks, get_export_data

app = Flask(__name__)
CORS(app)

init_db()

def log_operation(operation_type, record_id=None, old_value=None, new_value=None, operator='system', conn=None):
    def do_log(c):
        c.execute('''
            INSERT INTO operation_logs (operation_type, record_id, old_value, new_value, operator)
            VALUES (?, ?, ?, ?, ?)
        ''', (operation_type, record_id, str(old_value) if old_value else None, 
              str(new_value) if new_value else None, operator))
    if conn:
        do_log(conn.cursor())
    else:
        with get_db() as c:
            do_log(c.cursor())
            c.commit()

@app.route('/api/import', methods=['POST'])
def import_patrol():
    if 'file' not in request.files:
        return jsonify({'error': 'no file'}), 400
    file = request.files['file']
    batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    
    df = pd.read_excel(file)
    
    records = []
    communities = {}
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute('INSERT INTO import_batches (batch_id, file_name, record_count) VALUES (?, ?, ?)',
                  (batch_id, file.filename, len(df)))
        
        for idx, row in df.iterrows():
            original_row = idx + 2
            community_name = str(row.get('小区名称', '')).strip()
            travel_mode = str(row.get('出行方式', '')).strip()
            trip_count = int(row.get('出行次数', 0) or 0)
            low_carbon_score = float(row.get('低碳得分', 0) or 0)
            patrol_date = str(row.get('巡查日期', '')).strip()
            grid_member = str(row.get('网格员', '')).strip()
            notes = str(row.get('备注', '')).strip()
            
            if community_name not in communities:
                c.execute('SELECT id FROM communities WHERE name = ?', (community_name,))
                existing = c.fetchone()
                if existing:
                    communities[community_name] = existing['id']
                else:
                    c.execute('INSERT INTO communities (name, status) VALUES (?, ?)',
                              (community_name, 'pending'))
                    communities[community_name] = c.lastrowid
            
            community_id = communities.get(community_name)
            
            c.execute('''
                INSERT INTO patrol_records 
                (original_row, community_name, community_id, travel_mode, trip_count,
                 low_carbon_score, patrol_date, grid_member, import_batch, processing_status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (original_row, community_name, community_id, travel_mode, trip_count,
                  low_carbon_score, patrol_date, grid_member, batch_id, 'imported', notes))
            
            records.append({
                'id': c.lastrowid,
                'original_row': original_row,
                'community_name': community_name,
                'travel_mode': travel_mode,
                'trip_count': trip_count,
                'low_carbon_score': low_carbon_score,
                'patrol_date': patrol_date,
                'grid_member': grid_member,
                'processing_status': 'imported'
            })
        
        conn.commit()
    
    log_operation('import', None, None, f'batch:{batch_id}, count:{len(df)}', 'system')
    
    return jsonify({
        'batch_id': batch_id,
        'record_count': len(df),
        'records': records
    })

@app.route('/api/communities', methods=['GET'])
def get_communities():
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''
            SELECT c.*, 
                   (SELECT name FROM communities WHERE id = c.alias_id) as alias_name,
                   (SELECT COUNT(*) FROM patrol_records WHERE community_id = c.id) as record_count
            FROM communities c
            ORDER BY c.name
        ''')
        return jsonify([dict(row) for row in c.fetchall()])

@app.route('/api/communities/<int:cid>/alias', methods=['POST'])
def set_community_alias(cid):
    data = request.json
    alias_id = data.get('alias_id')
    operator = data.get('operator', '小付')
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute('UPDATE communities SET alias_id = ?, status = ? WHERE id = ?',
                  (alias_id, 'reviewed', cid))
        if alias_id:
            c.execute('UPDATE communities SET status = ? WHERE id = ?',
                      ('reviewed', alias_id))
        conn.commit()
    
    log_operation('set_alias', cid, None, f'alias_id:{alias_id}', operator)
    return jsonify({'success': True})

@app.route('/api/records', methods=['GET'])
def get_records():
    community_id = request.args.get('community_id')
    status = request.args.get('status')
    
    query = '''
        SELECT pr.*, 
               (SELECT name FROM communities WHERE id = pr.community_id) as canonical_name,
               (SELECT alias_id FROM communities WHERE id = pr.community_id) as alias_id
        FROM patrol_records pr
        WHERE 1=1
    '''
    params = []
    
    if community_id:
        query += ' AND pr.community_id = ?'
        params.append(community_id)
    if status:
        query += ' AND pr.processing_status = ?'
        params.append(status)
    
    query += ' ORDER BY pr.id DESC'
    
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute(query, params)
        return jsonify([dict(row) for row in c.fetchall()])

@app.route('/api/records/<int:rid>', methods=['PUT'])
def update_record(rid):
    data = request.json
    operator = data.get('operator', '小付')
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM patrol_records WHERE id = ?', (rid,))
        old = c.fetchone()
        old_dict = dict(old) if old else None
        
        updates = []
        params = []
        for field in ['trip_count', 'low_carbon_score', 'travel_mode', 'notes', 'processing_status']:
            if field in data:
                updates.append(f'{field} = ?')
                params.append(data[field])
        
        if updates:
            updates.append('manual_edited = 1')
            params.append(rid)
            c.execute(f'UPDATE patrol_records SET {", ".join(updates)} WHERE id = ?', params)
            conn.commit()
        
        log_operation('update_record', rid, json.dumps(old_dict, ensure_ascii=False), 
                      json.dumps(data, ensure_ascii=False), operator)
    
    return jsonify({'success': True})

@app.route('/api/construction-notices', methods=['GET'])
def get_notices():
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('SELECT * FROM construction_notices ORDER BY created_at DESC')
        return jsonify([dict(row) for row in c.fetchall()])

@app.route('/api/construction-notices', methods=['POST'])
def add_notice():
    data = request.json
    operator = data.get('operator', '小付')
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''
            INSERT INTO construction_notices
            (community_id, community_name, notice_title, notice_content, notice_date,
             impact_trip_count, impact_low_carbon_score, added_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (data.get('community_id'), data.get('community_name'),
              data.get('notice_title', ''), data.get('notice_content', ''),
              data.get('notice_date', ''), data.get('impact_trip_count', 0),
              data.get('impact_low_carbon_score', 0.0), operator))
        nid = c.lastrowid
        
        if data.get('community_id') and (data.get('impact_trip_count') or data.get('impact_low_carbon_score')):
            c.execute('''
                UPDATE patrol_records 
                SET processing_status = 'needs_recalc'
                WHERE community_id = ? AND processing_status = 'imported'
            ''', (data.get('community_id'),))
        
        conn.commit()
    
    log_operation('add_notice', nid, None, json.dumps(data, ensure_ascii=False), operator)
    return jsonify({'success': True, 'id': nid})

@app.route('/api/recalc', methods=['POST'])
def recalc_scores():
    data = request.json
    operator = data.get('operator', '小付')
    community_id = data.get('community_id')
    
    with get_db() as conn:
        c = conn.cursor()
        query = '''
            SELECT pr.id, pr.trip_count, pr.low_carbon_score,
                   cn.impact_trip_count, cn.impact_low_carbon_score
            FROM patrol_records pr
            JOIN construction_notices cn ON pr.community_id = cn.community_id
            WHERE pr.processing_status = 'needs_recalc'
        '''
        params = []
        if community_id:
            query += ' AND pr.community_id = ?'
            params.append(community_id)
        
        c.execute(query, params)
        records = c.fetchall()
        
        for r in records:
            new_trip = r['trip_count'] + (r['impact_trip_count'] or 0)
            new_score = r['low_carbon_score'] + (r['impact_low_carbon_score'] or 0)
            
            c.execute('''
                UPDATE patrol_records
                SET trip_count = ?, low_carbon_score = ?, processing_status = 'recalculated', manual_edited = 1
                WHERE id = ?
            ''', (new_trip, new_score, r['id']))
            
            log_operation('recalc', r['id'], 
                         f'trip:{r["trip_count"]},score:{r["low_carbon_score"]}',
                         f'trip:{new_trip},score:{new_score}', operator, conn)
        
        conn.commit()
    
    return jsonify({'success': True, 'recalculated': len(records)})

@app.route('/api/self-check', methods=['GET'])
def self_check():
    results = run_all_checks()
    
    with get_db() as conn:
        c = conn.cursor()
        for r in results:
            c.execute('''
                INSERT INTO self_check_results (check_type, check_result, details, passed)
                VALUES (?, ?, ?, ?)
            ''', (r['check_type'], json.dumps(r, ensure_ascii=False), 
                  json.dumps(r.get('details', []), ensure_ascii=False), 1 if r['passed'] else 0))
        conn.commit()
    
    return jsonify(results)

@app.route('/api/summary', methods=['GET'])
def get_summary():
    with get_db() as conn:
        c = conn.cursor()
        
        c.execute('SELECT COUNT(*) as cnt FROM patrol_records')
        total_records = c.fetchone()['cnt']
        
        c.execute('SELECT COUNT(*) as cnt FROM communities')
        total_communities = c.fetchone()['cnt']
        
        c.execute('SELECT COUNT(*) as cnt FROM communities WHERE alias_id IS NOT NULL OR status = "reviewed"')
        reviewed_communities = c.fetchone()['cnt']
        
        c.execute('''
            SELECT processing_status, COUNT(*) as cnt 
            FROM patrol_records 
            GROUP BY processing_status
        ''')
        status_counts = {row['processing_status']: row['cnt'] for row in c.fetchall()}
        
        c.execute('SELECT SUM(trip_count) as total FROM patrol_records')
        total_trips = c.fetchone()['total'] or 0
        
        c.execute('SELECT SUM(low_carbon_score) as total FROM patrol_records')
        total_score = c.fetchone()['total'] or 0
        
        c.execute('SELECT COUNT(*) as cnt FROM construction_notices')
        notice_count = c.fetchone()['cnt']
        
        c.execute('''
            SELECT community_name, SUM(trip_count) as trips, SUM(low_carbon_score) as score
            FROM patrol_records
            GROUP BY community_name
            ORDER BY score DESC
            LIMIT 10
        ''')
        top_communities = [dict(row) for row in c.fetchall()]
        
        c.execute('SELECT COUNT(*) as cnt FROM patrol_records WHERE processing_status = "needs_recalc"')
        needs_recalc = c.fetchone()['cnt']
        
        return jsonify({
            'total_records': total_records,
            'total_communities': total_communities,
            'reviewed_communities': reviewed_communities,
            'status_counts': status_counts,
            'total_trips': total_trips,
            'total_score': round(total_score, 2),
            'notice_count': notice_count,
            'top_communities': top_communities,
            'needs_recalc': needs_recalc,
            'generated_at': datetime.now().isoformat()
        })

@app.route('/api/export', methods=['GET'])
def export_data():
    data = get_export_data()
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame(data).to_excel(writer, sheet_name='出行账本明细', index=False)
        
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute('SELECT * FROM communities ORDER BY name')
            communities = [dict(row) for row in c.fetchall()]
            pd.DataFrame(communities).to_excel(writer, sheet_name='小区名录', index=False)
            
            c.execute('SELECT * FROM construction_notices ORDER BY created_at')
            notices = [dict(row) for row in c.fetchall()]
            pd.DataFrame(notices).to_excel(writer, sheet_name='施工告示', index=False)
            
            c.execute('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 500')
            logs = [dict(row) for row in c.fetchall()]
            pd.DataFrame(logs).to_excel(writer, sheet_name='操作日志', index=False)
    
    output.seek(0)
    
    log_operation('export', None, None, f'exported {len(data)} records', 'system')
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'低碳街区出行账本_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
    )

@app.route('/api/operation-logs', methods=['GET'])
def get_logs():
    limit = request.args.get('limit', 100, type=int)
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ?', (limit,))
        return jsonify([dict(row) for row in c.fetchall()])

if __name__ == '__main__':
    app.run(debug=True, port=5000)
