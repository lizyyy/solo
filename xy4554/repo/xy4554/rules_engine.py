import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
from database import get_db

class RulesEngine:
    def __init__(self, config: Dict = None):
        self.config = config or {
            'min_oven_temp': 180.0,
            'min_oven_duration': 120,
            'max_moisture': 5.0,
            'time_conflict_gap': 5
        }
    
    def check_undried(self) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, oven_no, batch_no, log_time, temperature, target_temp, duration_min, mold_nos
            FROM oven_temperature_logs
            WHERE temperature < ? OR duration_min < ?
        ''', (self.config['min_oven_temp'], self.config['min_oven_duration']))
        
        results = []
        for row in cursor.fetchall():
            mold_nos = row[7].split(',') if row[7] else []
            for mold_no in mold_nos:
                mold_no = mold_no.strip()
                if mold_no:
                    results.append({
                        'mold_no': mold_no,
                        'rule_type': 'undried',
                        'rule_name': '未烘透检测',
                        'is_violation': 1,
                        'severity': 'high',
                        'description': f"烘干温度{row[4]}℃低于阈值{self.config['min_oven_temp']}℃ 或 时间{row[6]}分钟低于阈值{self.config['min_oven_duration']}分钟",
                        'raw_data': json.dumps(dict(zip([desc[0] for desc in cursor.description], row)))
                    })
        
        conn.close()
        return results
    
    def check_moisture_rebound(self) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, mold_no, inspect_time, moisture_content, inspector, location, remark
            FROM moisture_inspections
            WHERE moisture_content > ?
        ''', (self.config['max_moisture'],))
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'mold_no': row[1],
                'rule_type': 'moisture_rebound',
                'rule_name': '复潮检测',
                'is_violation': 1,
                'severity': 'high',
                'description': f"水分含量{row[3]}%超过阈值{self.config['max_moisture']}%",
                'raw_data': json.dumps(dict(zip([desc[0] for desc in cursor.description], row)))
            })
        
        conn.close()
        return results
    
    def check_furnace_mismatch(self) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT p.id, p.schedule_no, p.mold_no, p.furnace_no, p.planned_start_time, 
                   s.part_name, s.material
            FROM pouring_schedules p
            LEFT JOIN sand_mold_orders s ON p.mold_no = s.mold_no
            ORDER BY p.mold_no, p.planned_start_time
        ''')
        
        results = []
        furnace_history = {}
        
        for row in cursor.fetchall():
            mold_no = row[2]
            furnace_no = row[3]
            start_time = row[4]
            
            if mold_no not in furnace_history:
                furnace_history[mold_no] = []
            
            furnace_history[mold_no].append({
                'furnace': furnace_no,
                'time': start_time,
                'row': dict(zip([desc[0] for desc in cursor.description], row))
            })
        
        for mold_no, history in furnace_history.items():
            if len(history) > 1:
                history_sorted = sorted(history, key=lambda x: x['time'])
                for i in range(1, len(history_sorted)):
                    prev_furnace = history_sorted[i-1]['furnace']
                    curr_furnace = history_sorted[i]['furnace']
                    
                    if prev_furnace != curr_furnace:
                        results.append({
                            'mold_no': mold_no,
                            'rule_type': 'furnace_mismatch',
                            'rule_name': '炉次串号检测',
                            'is_violation': 1,
                            'severity': 'medium',
                            'description': f"炉次从{prev_furnace}切换到{curr_furnace}，存在串号风险",
                            'raw_data': json.dumps({
                                'previous': history_sorted[i-1]['row'],
                                'current': history_sorted[i]['row']
                            })
                        })
        
        conn.close()
        return results
    
    def check_time_conflict(self) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, schedule_no, mold_no, furnace_no, 
                   planned_start_time, planned_end_time, status
            FROM pouring_schedules
            WHERE status NOT IN ('completed', 'cancelled')
            ORDER BY planned_start_time
        ''')
        
        schedules = []
        for row in cursor.fetchall():
            schedules.append(dict(zip([desc[0] for desc in cursor.description], row)))
        
        conn.close()
        
        results = []
        for i in range(len(schedules)):
            for j in range(i + 1, len(schedules)):
                s1 = schedules[i]
                s2 = schedules[j]
                
                if s1['mold_no'] == s2['mold_no']:
                    try:
                        s1_start = datetime.strptime(s1['planned_start_time'], '%Y-%m-%d %H:%M')
                        s1_end = datetime.strptime(s1['planned_end_time'], '%Y-%m-%d %H:%M')
                        s2_start = datetime.strptime(s2['planned_start_time'], '%Y-%m-%d %H:%M')
                        s2_end = datetime.strptime(s2['planned_end_time'], '%Y-%m-%d %H:%M')
                        
                        if (s1_start <= s2_end and s2_start <= s1_end):
                            results.append({
                                'mold_no': s1['mold_no'],
                                'rule_type': 'time_conflict',
                                'rule_name': '开浇时间冲突',
                                'is_violation': 1,
                                'severity': 'high',
                                'description': f"排程{s1['schedule_no']}({s1['planned_start_time']}~{s1['planned_end_time']}) 与 {s2['schedule_no']}({s2['planned_start_time']}~{s2['planned_end_time']}) 时间冲突",
                                'raw_data': json.dumps({'schedule1': s1, 'schedule2': s2})
                            })
                    except Exception as e:
                        continue
        
        return results
    
    def check_reinspection_needed(self) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, mold_no, note_time, note_type, content, reporter
            FROM quality_notes
            WHERE note_type IN ('需复检', 'reinspection', 'REINSPECTION')
               OR content LIKE '%复检%'
               OR content LIKE '%reinspect%'
        ''')
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'mold_no': row[1],
                'rule_type': 'reinspection_needed',
                'rule_name': '需复检砂型',
                'is_violation': 1,
                'severity': 'medium',
                'description': f"质检备注要求复检: {row[4][:100] if len(row[4]) > 100 else row[4]}",
                'raw_data': json.dumps(dict(zip([desc[0] for desc in cursor.description], row)))
            })
        
        conn.close()
        return results
    
    def run_all_rules(self) -> Dict[str, List]:
        all_violations = {
            'undried': [],
            'moisture_rebound': [],
            'furnace_mismatch': [],
            'time_conflict': [],
            'reinspection_needed': []
        }
        
        all_violations['undried'] = self.check_undried()
        all_violations['moisture_rebound'] = self.check_moisture_rebound()
        all_violations['furnace_mismatch'] = self.check_furnace_mismatch()
        all_violations['time_conflict'] = self.check_time_conflict()
        all_violations['reinspection_needed'] = self.check_reinspection_needed()
        
        return all_violations
    
    def save_results(self, violations: Dict[str, List]) -> Dict:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM rule_results')
        
        total_count = 0
        summary = {}
        
        for rule_type, items in violations.items():
            count = 0
            for item in items:
                cursor.execute('''
                    INSERT INTO rule_results 
                    (mold_no, rule_type, rule_name, is_violation, severity, description, raw_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    item['mold_no'],
                    item['rule_type'],
                    item['rule_name'],
                    item['is_violation'],
                    item['severity'],
                    item['description'],
                    item['raw_data']
                ))
                count += 1
            
            summary[rule_type] = count
            total_count += count
        
        conn.commit()
        conn.close()
        
        return {
            'total_violations': total_count,
            'by_rule_type': summary
        }

if __name__ == '__main__':
    from database import init_db
    init_db()
    
    engine = RulesEngine()
    violations = engine.run_all_rules()
    print('Rule violations:')
    for rule_type, items in violations.items():
        print(f'  {rule_type}: {len(items)} items')
    
    result = engine.save_results(violations)
    print(f'\nSaved {result["total_violations"]} violations to database.')
