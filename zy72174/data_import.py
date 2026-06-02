import json
from datetime import datetime, timedelta
from database import get_db

SAMPLE_GIS_POINTS = [
    {
        "point_no": "CQ-2026-001",
        "address": "城西区朝阳街道新华街123号",
        "district": "城西区",
        "gis_lng": 116.4074,
        "gis_lat": 39.9042,
        "property_type": "住宅",
        "area": 85.5,
        "households": 3,
        "data_source": "gis_system",
        "source_name": "2026年城市更新GIS点位普查_第3批"
    },
    {
        "point_no": "CQ-2026-002",
        "address": "城东区和平街道人民路456号",
        "district": "城东区",
        "gis_lng": 116.4174,
        "gis_lat": 39.9142,
        "property_type": "商住混合",
        "area": 240.0,
        "households": 6,
        "data_source": "gis_system",
        "source_name": "2026年城市更新GIS点位普查_第3批"
    },
    {
        "point_no": "CQ-2026-003",
        "address": "城北区建设街道解放路789号",
        "district": "城北区",
        "gis_lng": 116.3974,
        "gis_lat": 39.9242,
        "property_type": "工业厂房",
        "area": 680.0,
        "households": 0,
        "data_source": "gis_old",
        "source_name": "2023年拆迁遗留点位补录_旧口径"
    }
]

SAMPLE_RESIDENT_FEEDBACK = [
    {
        "point_no": "CQ-2026-001",
        "feedback_type": "居民诉求",
        "feedback_content": "家中有老人和残疾人，希望在回迁时能够安排低楼层房源",
        "feedback_source": "社区居委会转办",
        "feedback_time": "2026-05-15 09:30:00",
        "handler": "王主任",
        "handle_note": "已登记，安置时优先考虑",
        "handled_at": "2026-05-16 14:20:00",
        "is_resolved": 1
    },
    {
        "point_no": "CQ-2026-002",
        "feedback_type": "面积异议",
        "feedback_content": "房产证面积86平米，但实测只有82平米，要求重新测量",
        "feedback_source": "12345热线工单",
        "feedback_time": "2026-05-20 11:45:00",
        "handler": None,
        "handle_note": None,
        "handled_at": None,
        "is_resolved": 0
    },
    {
        "point_no": "CQ-2026-003",
        "feedback_type": "历史遗留",
        "feedback_content": "该厂房2023年已纳入拆迁范围，但因产权纠纷未完成，本次需要重新确权",
        "feedback_source": "档案室调阅",
        "feedback_time": "2026-04-10 08:00:00",
        "handler": "何工",
        "handle_note": "已调取2023年档案，需要现场复核产权边界",
        "handled_at": "2026-04-15 16:30:00",
        "is_resolved": 0
    }
]

SAMPLE_INSPECTION_PHOTOS = [
    {
        "point_no": "CQ-2026-001",
        "photo_path": "photos/CQ-2026-001_1.jpg",
        "photo_desc": "房屋外观正面照",
        "taken_at": "2026-05-10 10:30:00",
        "taken_by": "巡检组李队"
    },
    {
        "point_no": "CQ-2026-001",
        "photo_path": "photos/CQ-2026-001_2.jpg",
        "photo_desc": "室内结构及面积复核",
        "taken_at": "2026-05-10 10:45:00",
        "taken_by": "巡检组李队"
    },
    {
        "point_no": "CQ-2026-002",
        "photo_path": "photos/CQ-2026-002_1.jpg",
        "photo_desc": "一层商铺经营现状",
        "taken_at": "2026-05-12 14:20:00",
        "taken_by": "巡检组张队"
    },
    {
        "point_no": "CQ-2026-003",
        "photo_path": "photos/CQ-2026-003_1.jpg",
        "photo_desc": "厂房外观及周边环境",
        "taken_at": "2026-04-20 09:15:00",
        "taken_by": "何工"
    },
    {
        "point_no": "CQ-2026-003",
        "photo_path": "photos/CQ-2026-003_2.jpg",
        "photo_desc": "2023年拆迁红线标记残留",
        "taken_at": "2026-04-20 09:30:00",
        "taken_by": "何工"
    }
]

SAMPLE_MANUAL_NOTES = [
    {
        "point_no": "CQ-2026-001",
        "street_name": "朝阳街道",
        "note_content": "该户积极配合拆迁工作，属于首批签约户，建议按政策给予提前签约奖励",
        "operator": "朝阳街道刘书记",
        "created_at": "2026-05-18 11:00:00"
    },
    {
        "point_no": "CQ-2026-002",
        "street_name": "和平街道",
        "note_content": "该处二楼为违规加建，约15平米，需明确是否纳入补偿范围。请何工现场确认。",
        "operator": "和平街道赵主任",
        "created_at": "2026-05-22 16:45:00"
    },
    {
        "point_no": "CQ-2026-003",
        "street_name": "建设街道",
        "note_content": "原土地使用证记载面积720平米，GIS实测680平米，差异原因待查。旧口径按720平米统计，本次需核实。",
        "operator": "建设街道孙主任",
        "created_at": "2026-04-25 10:30:00"
    }
]

OLD_VERSION_DATA = [
    {
        "point_no": "CQ-2026-003",
        "field_name": "area",
        "old_value": "720.0",
        "new_value": "680.0",
        "operation_note": "2026年GIS实测更新，原2023年旧口径为720平米",
        "source_name": "2023年拆迁遗留点位补录_旧口径",
        "operator": "何工"
    },
    {
        "point_no": "CQ-2026-003",
        "field_name": "status",
        "old_value": "pending",
        "new_value": "need_onsite",
        "operation_note": "因面积差异和历史产权纠纷，需现场复看",
        "source_name": "2023年拆迁遗留点位补录_旧口径",
        "operator": "何工"
    },
    {
        "point_no": "CQ-2026-002",
        "field_name": "status",
        "old_value": "pending",
        "new_value": "need_verify",
        "operation_note": "居民提出面积异议且存在违规加建，需要人工复核确认",
        "source_name": "街道手改备注",
        "operator": "系统自动判定"
    }
]

def import_sample_data():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as cnt FROM points")
    if cursor.fetchone()['cnt'] > 0:
        print("数据已存在，跳过样例数据导入")
        conn.close()
        return
    
    source_map = {}
    for pt in SAMPLE_GIS_POINTS:
        source_key = pt['data_source'] + '_' + pt['source_name']
        if source_key not in source_map:
            cursor.execute(
                "INSERT INTO data_sources (source_type, source_name, imported_by) VALUES (?, ?, ?)",
                (pt['data_source'], pt['source_name'], '系统初始化')
            )
            source_map[source_key] = cursor.lastrowid
    
    point_id_map = {}
    for pt in SAMPLE_GIS_POINTS:
        status = 'processed' if pt['point_no'] == 'CQ-2026-001' else 'pending'
        if pt['point_no'] == 'CQ-2026-002':
            status = 'need_verify'
        elif pt['point_no'] == 'CQ-2026-003':
            status = 'need_onsite'
            
        cursor.execute(
            '''INSERT INTO points 
               (point_no, address, district, gis_lng, gis_lat, property_type, area, households, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (pt['point_no'], pt['address'], pt['district'], pt['gis_lng'], pt['gis_lat'],
             pt['property_type'], pt['area'], pt['households'], status)
        )
        point_id_map[pt['point_no']] = cursor.lastrowid
        
        source_key = pt['data_source'] + '_' + pt['source_name']
        source_id = source_map.get(source_key)
        for field in ['address', 'area', 'property_type']:
            cursor.execute(
                '''INSERT INTO point_versions 
                   (point_id, version, field_name, old_value, new_value, source_id, operator, operation_note)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (point_id_map[pt['point_no']], 1, field, None, str(pt[field]), source_id, 
                 '系统导入', 'GIS点位数据初始导入')
            )
    
    for fb in SAMPLE_RESIDENT_FEEDBACK:
        pid = point_id_map.get(fb['point_no'])
        if pid:
            cursor.execute(
                '''INSERT INTO feedback 
                   (point_id, feedback_type, feedback_content, feedback_source, feedback_time,
                    handler, handle_note, handled_at, is_resolved)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (pid, fb['feedback_type'], fb['feedback_content'], fb['feedback_source'],
                 fb['feedback_time'], fb['handler'], fb['handle_note'], fb['handled_at'], fb['is_resolved'])
            )
    
    cursor.execute(
        "INSERT INTO data_sources (source_type, source_name, imported_by) VALUES (?, ?, ?)",
        ('inspection', '2026年城市更新现场巡检照片_第1批', '巡检组')
    )
    photo_source_id = cursor.lastrowid
    
    for photo in SAMPLE_INSPECTION_PHOTOS:
        pid = point_id_map.get(photo['point_no'])
        if pid:
            cursor.execute(
                '''INSERT INTO inspection_photos 
                   (point_id, photo_path, photo_desc, taken_at, taken_by)
                   VALUES (?, ?, ?, ?, ?)''',
                (pid, photo['photo_path'], photo['photo_desc'], photo['taken_at'], photo['taken_by'])
            )
    
    cursor.execute(
        "INSERT INTO data_sources (source_type, source_name, imported_by) VALUES (?, ?, ?)",
        ('manual', '各街道拆迁安置手改备注汇总', '街道办')
    )
    note_source_id = cursor.lastrowid
    
    for note in SAMPLE_MANUAL_NOTES:
        pid = point_id_map.get(note['point_no'])
        if pid:
            cursor.execute(
                '''INSERT INTO manual_notes 
                   (point_id, street_name, note_content, operator, created_at)
                   VALUES (?, ?, ?, ?, ?)''',
                (pid, note['street_name'], note['note_content'], note['operator'], note['created_at'])
            )
    
    for ov in OLD_VERSION_DATA:
        pid = point_id_map.get(ov['point_no'])
        if pid:
            cursor.execute("SELECT current_version FROM points WHERE id = ?", (pid,))
            current_ver = cursor.fetchone()['current_version']
            new_ver = current_ver + 1
            
            cursor.execute(
                '''INSERT INTO point_versions 
                   (point_id, version, field_name, old_value, new_value, source_id, operator, operation_note)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (pid, new_ver, ov['field_name'], ov['old_value'], ov['new_value'], 
                 note_source_id, ov['operator'], ov['operation_note'])
            )
            
            if ov['field_name'] == 'status':
                cursor.execute(
                    "UPDATE points SET status = ?, current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (ov['new_value'], new_ver, pid)
                )
            else:
                cursor.execute(
                    "UPDATE points SET current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (new_ver, pid)
                )
    
    cursor.execute(
        '''INSERT INTO review_records 
           (point_id, reviewer, review_result, review_note)
           VALUES (?, ?, ?, ?)''',
        (point_id_map['CQ-2026-001'], '何工', 'pass', 
         '资料齐全，面积无异议，居民诉求已登记，可进入下一流程')
    )
    
    conn.commit()
    conn.close()
    print("样例数据导入完成！共导入点位3个，反馈3条，照片5张，备注3条，版本记录8条")
