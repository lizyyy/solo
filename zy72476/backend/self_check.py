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

def _get_alias_groups():
    with get_db() as conn:
        c = conn.cursor()
        c.execute('SELECT id, name, alias_id FROM communities')
        all_comms = {row['id']: {'name': row['name'], 'alias_id': row['alias_id']} for row in c.fetchall()}
    
    visited = set()
    groups = {}
    
    def bfs_group(start_id):
        group_ids = set()
        queue = [start_id]
        while queue:
            current = queue.pop()
            if current in group_ids or current not in all_comms:
                continue
            group_ids.add(current)
            alias_id = all_comms[current]['alias_id']
            if alias_id and alias_id not in group_ids:
                queue.append(alias_id)
            for cid, info in all_comms.items():
                if info['alias_id'] == current and cid not in group_ids:
                    queue.append(cid)
        return group_ids
    
    for cid in all_comms:
        if cid in visited:
            continue
        group = bfs_group(cid)
        visited.update(group)
        for gid in group:
            groups[gid] = {
                'ids': list(group),
                'names': [all_comms[x]['name'] for x in group]
            }
    return groups, all_comms

def check_recalc_after_supplement():
    with get_db() as conn:
        c = conn.cursor()
        
        alias_groups, all_comms = _get_alias_groups()
        
        c.execute('SELECT * FROM construction_notices ORDER BY created_at')
        notices = [dict(row) for row in c.fetchall()]
        
        need_recalc = []
        ok_records = []
        
        for notice in notices:
            notice_cid = notice['community_id']
            group = alias_groups.get(notice_cid, {'ids': [notice_cid], 'names': [notice['community_name']]})
            group_ids = group['ids']
            group_names = group['names']
            
            has_impact = (notice['impact_trip_count'] and notice['impact_trip_count'] != 0) or \
                         (notice['impact_low_carbon_score'] and notice['impact_low_carbon_score'] != 0)
            
            if not has_impact:
                continue
            
            placeholders = ','.join('?' * len(group_ids))
            c.execute(f'''
                SELECT pr.id, pr.community_name, pr.community_id, pr.trip_count, 
                       pr.low_carbon_score, pr.processing_status, pr.notes,
                       pr.original_row, pr.import_batch
                FROM patrol_records pr
                WHERE pr.community_id IN ({placeholders})
            ''', group_ids)
            
            group_records = [dict(row) for row in c.fetchall()]
            
            for rec in group_records:
                if rec['processing_status'] in ('needs_recalc', 'imported'):
                    need_recalc.append({
                        'record_id': rec['id'],
                        'original_row': rec['original_row'],
                        'community_name': rec['community_name'],
                        'canonical_group_names': group_names,
                        'notice_title': notice['notice_title'],
                        'impact_trip_count': notice['impact_trip_count'],
                        'impact_low_carbon_score': notice['impact_low_carbon_score'],
                        'current_status': rec['processing_status'],
                        'current_trip_count': rec['trip_count'],
                        'current_score': rec['low_carbon_score'],
                        'processing_status': rec['processing_status'],
                        'import_batch': rec['import_batch'],
                        'notes': rec['notes']
                    })
                elif rec['processing_status'] == 'recalculated':
                    ok_records.append({
                        'record_id': rec['id'],
                        'community_name': rec['community_name'],
                        'notice_title': notice['notice_title'],
                        'status': '已重算'
                    })
        
        return {
            'check_type': '补录后重算检查',
            'passed': len(need_recalc) == 0,
            'need_recalc_count': len(need_recalc),
            'ok_count': len(ok_records),
            'total_notices': len(notices),
            'pending_details': need_recalc,
            'completed_details': ok_records,
            'hint': '请执行重算操作应用施工告示影响。别名组内的所有小区会一起检查。'
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
        
        alias_groups, all_communities = _get_alias_groups()
        
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
        
        c.execute('SELECT community_id, notice_title, notice_content, notice_date, impact_trip_count, impact_low_carbon_score, added_by, created_at FROM construction_notices')
        notice_map = {}
        for n in c.fetchall():
            nd = dict(n)
            cid = nd['community_id']
            group = alias_groups.get(cid, {'ids': [cid]})
            for gid in group['ids']:
                if gid not in notice_map:
                    notice_map[gid] = []
                notice_map[gid].append(nd)
        
        c.execute('''
            SELECT pr.id, pr.original_row, pr.community_name, pr.community_id,
                   pr.travel_mode, pr.trip_count, pr.low_carbon_score,
                   pr.patrol_date, pr.grid_member, pr.import_batch,
                   pr.manual_edited, pr.processing_status, pr.notes,
                   ib.file_name as source_file
            FROM patrol_records pr
            LEFT JOIN import_batches ib ON pr.import_batch = ib.batch_id
            ORDER BY pr.id
        ''')
        records_rows = [dict(row) for row in c.fetchall()]
        
        c.execute('SELECT operation_type, record_id, old_value, new_value, operator, created_at FROM operation_logs ORDER BY created_at')
        log_map = {}
        for l in c.fetchall():
            ld = dict(l)
            rid = ld['record_id']
            if rid:
                if rid not in log_map:
                    log_map[rid] = []
                log_map[rid].append(ld)
        
        result = []
        for d in records_rows:
            cid = d['community_id']
            group = alias_groups.get(cid, {'ids': [cid], 'names': [d['community_name']]})
            
            d['canonical_community_name'] = get_canonical_name(cid)
            d['processing_status_text'] = get_status_text(d['processing_status'])
            d['data_source'] = f'导入批次:{d["import_batch"]}, 文件:{d["source_file"] or "未知"}, 原始行号:{d["original_row"]}'
            d['conclusion'] = d['notes'] or '无特殊处理'
            d['is_alias_merged'] = d['canonical_community_name'] != d['community_name'] if d['canonical_community_name'] else False
            d['alias_group_names'] = ' / '.join(group['names'])
            d['alias_group_ids'] = ','.join(str(x) for x in group['ids'])
            
            related_notices = notice_map.get(cid, [])
            if related_notices:
                d['has_construction_notice'] = True
                d['notice_titles'] = '; '.join(n['notice_title'] for n in related_notices)
                d['notice_impact_trip'] = sum(n['impact_trip_count'] or 0 for n in related_notices)
                d['notice_impact_score'] = sum(n['impact_low_carbon_score'] or 0 for n in related_notices)
            else:
                d['has_construction_notice'] = False
                d['notice_titles'] = ''
                d['notice_impact_trip'] = 0
                d['notice_impact_score'] = 0.0
            
            related_logs = log_map.get(d['id'], [])
            d['operation_count'] = len(related_logs)
            d['operation_history'] = '; '.join(f"[{l['created_at']}]{l['operator']}:{l['operation_type']}" for l in related_logs)
            
            d['self_check_conclusion'] = ''
            if d['processing_status'] == 'needs_recalc' and d['has_construction_notice']:
                d['self_check_conclusion'] = f'待处理：已补录施工告示({d["notice_titles"]})，影响出行{d["notice_impact_trip"]:+d}、得分{d["notice_impact_score"]:+.1f}，尚未重算'
            elif d['processing_status'] == 'recalculated' and d['has_construction_notice']:
                d['self_check_conclusion'] = f'已完成：已重算，已应用施工告示({d["notice_titles"]})影响'
            elif d['processing_status'] == 'imported' and d['has_construction_notice']:
                d['self_check_conclusion'] = f'待处理：已补录施工告示({d["notice_titles"]})，记录尚未标记重算'
            elif d['is_alias_merged']:
                d['self_check_conclusion'] = f'已复核：{d["community_name"]} 已关联到 {d["canonical_community_name"]}'
            else:
                d['self_check_conclusion'] = '正常'
            
            result.append(d)
        return result

def get_api_data():
    return get_export_data()

def get_page_data():
    return get_export_data()
