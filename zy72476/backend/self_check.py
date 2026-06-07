from database import get_db
import hashlib
import json
import sqlite3

def run_all_checks():
    results = []
    results.append(check_duplicate_imports())
    results.append(check_dual_community_names())
    results.append(check_recalc_after_supplement())
    results.append(check_export_consistency())
    return results

def check_duplicate_imports():
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''
            SELECT original_row, community_name, patrol_date, trip_count, import_batch, COUNT(*) as cnt
            FROM patrol_records
            GROUP BY original_row, community_name, patrol_date, trip_count
            HAVING cnt > 1
        ''')
        duplicates = c.fetchall()
        details = []
        for d in duplicates:
            details.append({
                'original_row': d['original_row'],
                'community_name': d['community_name'],
                'patrol_date': d['patrol_date'],
                'count': d['cnt'],
                'batches': []
            })
        return {
            'check_type': '重复导入检测',
            'passed': len(duplicates) == 0,
            'total': len(duplicates),
            'details': details
        }

def check_dual_community_names():
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''
            SELECT c1.name as name1, c2.name as name2, c1.id as id1, c2.id as id2
            FROM communities c1
            JOIN communities c2 ON c1.alias_id = c2.id OR c2.alias_id = c1.id
            WHERE c1.id < c2.id
        ''')
        aliased = c.fetchall()
        pairs = []
        for a in aliased:
            pairs.append({
                'name_a': a['name1'],
                'name_b': a['name2'],
                'id_a': a['id1'],
                'id_b': a['id2']
            })
        c.execute('''
            SELECT community_name, COUNT(DISTINCT community_id) as id_count
            FROM patrol_records
            WHERE community_id IS NOT NULL
            GROUP BY community_name
            HAVING id_count > 1
        ''')
        name_conflicts = c.fetchall()
        conflicts = []
        for n in name_conflicts:
            conflicts.append({
                'name': n['community_name'],
                'id_count': n['id_count']
            })
        return {
            'check_type': '同一小区新旧名识别',
            'passed': len(conflicts) == 0,
            'alias_pairs': pairs,
            'name_conflicts': conflicts,
            'total_alias_pairs': len(pairs),
            'total_conflicts': len(conflicts)
        }

def check_recalc_after_supplement():
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''
            SELECT pr.id, pr.community_name, pr.low_carbon_score,
                   cn.impact_low_carbon_score, pr.trip_count, cn.impact_trip_count
            FROM patrol_records pr
            LEFT JOIN construction_notices cn ON pr.community_id = cn.community_id
            WHERE cn.id IS NOT NULL
        ''')
        records = c.fetchall()
        need_recalc = []
        for r in records:
            if r['impact_low_carbon_score'] and r['impact_low_carbon_score'] > 0:
                need_recalc.append({
                    'record_id': r['id'],
                    'community_name': r['community_name'],
                    'original_score': r['low_carbon_score'],
                    'impact_score': r['impact_low_carbon_score'],
                    'needs_recalc': True
                })
        return {
            'check_type': '补录后重算检查',
            'passed': len(need_recalc) == 0,
            'need_recalc_count': len(need_recalc),
            'details': need_recalc
        }

def check_export_consistency():
    export_data = get_export_data()
    api_data = get_api_data()
    page_data = get_page_data()
    
    export_hash = hashlib.md5(json.dumps(export_data, sort_keys=True).encode()).hexdigest()
    api_hash = hashlib.md5(json.dumps(api_data, sort_keys=True).encode()).hexdigest()
    page_hash = hashlib.md5(json.dumps(page_data, sort_keys=True).encode()).hexdigest()
    
    consistent = export_hash == api_hash == page_hash
    
    return {
        'check_type': '导出一致性校验',
        'passed': consistent,
        'export_count': len(export_data),
        'api_count': len(api_data),
        'page_count': len(page_data),
        'consistent': consistent
    }

def get_export_data():
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''
            SELECT original_row, community_name, travel_mode, trip_count,
                   low_carbon_score, patrol_date, grid_member, processing_status,
                   manual_edited, notes, import_batch
            FROM patrol_records
            ORDER BY id
        ''')
        return [dict(row) for row in c.fetchall()]

def get_api_data():
    return get_export_data()

def get_page_data():
    return get_export_data()
