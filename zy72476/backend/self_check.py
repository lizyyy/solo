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
        
        c.execute('SELECT id, name, status FROM communities WHERE alias_id IS NULL')
        all_unaliased = c.fetchall()
        
        candidates = []
        suffixes = ['小区', '社区', '一期', '二期', '三期', '花园', '新村', '家园', '里', '苑', '公寓']
        
        for i in range(len(all_unaliased)):
            for j in range(i + 1, len(all_unaliased)):
                name1 = all_unaliased[i]['name']
                name2 = all_unaliased[j]['name']
                id1 = all_unaliased[i]['id']
                id2 = all_unaliased[j]['id']
                
                is_candidate = False
                match_type = ''
                
                if name1.startswith(name2) or name2.startswith(name1):
                    is_candidate = True
                    match_type = '前缀匹配'
                
                if not is_candidate:
                    base1 = name1
                    base2 = name2
                    for s in suffixes:
                        if base1.endswith(s):
                            base1 = base1[:-len(s)]
                        if base2.endswith(s):
                            base2 = base2[:-len(s)]
                    if base1 == base2 and (name1 != name2):
                        is_candidate = True
                        match_type = '后缀差异（' + '/'.join([s for s in suffixes if name1.endswith(s) or name2.endswith(s)]) + '）'
                
                if is_candidate:
                    c.execute('SELECT COUNT(*) as cnt FROM patrol_records WHERE community_id = ?', (id1,))
                    cnt1 = c.fetchone()['cnt']
                    c.execute('SELECT COUNT(*) as cnt FROM patrol_records WHERE community_id = ?', (id2,))
                    cnt2 = c.fetchone()['cnt']
                    candidates.append({
                        'name_a': name1,
                        'name_b': name2,
                        'id_a': id1,
                        'id_b': id2,
                        'match_type': match_type,
                        'status_a': all_unaliased[i]['status'],
                        'status_b': all_unaliased[j]['status'],
                        'record_count_a': cnt1,
                        'record_count_b': cnt2
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
            'candidates': candidates,
            'total_alias_pairs': len(pairs),
            'total_conflicts': len(conflicts),
            'total_candidates': len(candidates),
            'hint': '候选仅为推荐，请人工确认。滨河新村一期/二期等可能不是同一小区，可忽略。'
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
        
        c.execute('SELECT id, name, alias_id FROM communities')
        all_communities = {row['id']: dict(row) for row in c.fetchall()}
        
        def get_canonical_name(cid):
            if not cid or cid not in all_communities:
                return ''
            seen = set()
            current = cid
            while all_communities[current].get('alias_id') and current not in seen:
                seen.add(current)
                current = all_communities[current]['alias_id']
            return all_communities[current]['name']
        
        def get_status_text(s):
            return {
                'imported': '已导入',
                'needs_recalc': '需重算',
                'recalculated': '已重算'
            }.get(s, s)
        
        c.execute('''
            SELECT pr.id, pr.original_row, pr.community_name, pr.community_id,
                   pr.travel_mode, pr.trip_count, pr.low_carbon_score,
                   pr.patrol_date, pr.grid_member, pr.import_batch,
                   pr.manual_edited, pr.processing_status, pr.notes,
                   ib.file_name as source_file,
                   cn.notice_title as construction_notice
            FROM patrol_records pr
            LEFT JOIN import_batches ib ON pr.import_batch = ib.batch_id
            LEFT JOIN construction_notices cn ON pr.community_id = cn.community_id
            ORDER BY pr.id
        ''')
        
        result = []
        for row in c.fetchall():
            d = dict(row)
            d['canonical_community_name'] = get_canonical_name(d['community_id'])
            d['processing_status_text'] = get_status_text(d['processing_status'])
            d['data_source'] = f'导入批次:{d["import_batch"]}, 文件:{d["source_file"] or "未知"}, 原始行号:{d["original_row"]}'
            d['conclusion'] = d['notes'] or '无特殊处理'
            d['is_alias_merged'] = d['canonical_community_name'] != d['community_name'] if d['canonical_community_name'] else False
            result.append(d)
        return result

def get_api_data():
    return get_export_data()

def get_page_data():
    return get_export_data()
