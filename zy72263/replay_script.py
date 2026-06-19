#!/usr/bin/env python3
# 机场廊桥停靠预演 - 重放脚本
# 生成时间: 2026-06-19T10:59:59.749270

import sys
import json

sys.path.insert(0, '.')

from airbridge import PreflightManager, ReviewManager, Visualizer, WorkflowEngine
from airbridge.models import CoordinateOrigin, InspectionPhoto


REPLAY_DATA = json.loads('{\n  "coordinate_origins": [\n    {\n      "id": "origin_001",\n      "name": "T2航站楼D10廊桥",\n      "x": 125.6,\n      "y": 89.3,\n      "z": 5.2,\n      "description": "主廊桥",\n      "metadata": {},\n      "created_at": "2026-06-19T10:59:59.748751",\n      "version": 1\n    }\n  ],\n  "inspection_photos": [\n    {\n      "id": "photo_002",\n      "photo_number": "INSP-2024-002",\n      "coordinate_origin_id": "origin_001",\n      "url": "",\n      "remark": "移动端复核截图",\n      "has_mobile_screenshot": true,\n      "alert_label_visible": false,\n      "alert_label_area": null,\n      "metadata": {},\n      "created_at": "2026-06-19T10:59:59.748916",\n      "updated_at": "2026-06-19T10:59:59.748972"\n    }\n  ],\n  "remark_updates": []\n}')

def replay():
    pm = PreflightManager()
    rm = ReviewManager(pm)
    vz = Visualizer(pm)
    we = WorkflowEngine(pm, rm, vz)

    # ===== 步骤 1: 导入坐标原点说明 =====
    print('[步骤 1] 导入坐标原点说明...')
    print('-' * 60)
    for origin_dict in REPLAY_DATA['coordinate_origins']:
        origin = CoordinateOrigin(
            id=origin_dict['id'],
            name=origin_dict['name'],
            x=origin_dict['x'],
            y=origin_dict['y'],
            z=origin_dict['z'],
            description=origin_dict.get('description', ''),
        )
        created, skipped = pm.import_coordinate_origins([origin], actor='system_initial')
        print(f'  导入 {origin.name}: 创建={len(created)}, 跳过={len(skipped)}')
    print()

    # ===== 步骤 2: 展陈设计师阿景补看巡检照片编号 =====
    print('[步骤 2] 展陈设计师阿景补看巡检照片编号...')
    print('-' * 60)
    for photo_dict in REPLAY_DATA['inspection_photos']:
        original_remark = photo_dict['remark']
        for upd in REPLAY_DATA['remark_updates']:
            if upd['photo_id'] == photo_dict['id'] and upd['old_remark'] != upd['new_remark']:
                original_remark = upd['old_remark']
                break
        photo = InspectionPhoto(
            id=photo_dict['id'],
            photo_number=photo_dict['photo_number'],
            coordinate_origin_id=photo_dict['coordinate_origin_id'],
            remark=original_remark,
            has_mobile_screenshot=photo_dict['has_mobile_screenshot'],
            alert_label_visible=photo_dict['alert_label_visible'],
        )
        rec = pm.add_inspection_photo(photo, actor='designer_ajing')
        if rec:
            blocked = '遮挡' if photo.is_alert_label_blocked() else '正常'
            print(f'  添加照片 {photo.photo_number}: {blocked}')
    print()

    # ===== 步骤 3: 安全距离报告更新 + 备注修改 =====
    print('[步骤 3] 安全距离报告更新...')
    print('-' * 60)
    for upd in REPLAY_DATA['remark_updates']:
        result = pm.update_photo_remark(
            upd['photo_id'], upd['new_remark'], actor=upd['actor'],
        )
        if result and result.get('changed'):
            print(f"  备注更新: 照片={upd['photo_id']}, 改前={result['old']}, 改后={result['new']}")

    # 提交施工经理复核
    need_review = rm.get_records_needing_review()
    for rec in need_review:
        photos = pm.get_photos_by_origin_id(rec.coordinate_origin_id)
        for p in photos:
            if p.is_alert_label_blocked():
                rm.submit_for_manager_review(rec.id, p.id, submitter='designer_ajing')
                print(f'  提交复核: 照片={p.photo_number}')
    print()

    # ===== 输出结果摘要 =====
    print('=' * 60)
    print('重放完成！结果摘要：')
    print('=' * 60)
    all_records = pm.get_all_preflight_records()
    print(f'  预演记录总数: {len(all_records)}')
    for r in all_records:
        o = pm.get_coordinate_origin(r.coordinate_origin_id)
        ps = pm.get_photos_by_origin_id(r.coordinate_origin_id)
        blocked_photos = [p for p in ps if p.is_alert_label_blocked()]
        origin_name = o.name if o else '未知'
        review_flag = '是' if r.status in ('needs_review', 'manager_review') else '否'
        print(f'  记录 {r.id}:')
        print(f'    坐标原点: {origin_name}')
        print(f'    状态: {r.status}')
        print(f'    照片数: {len(ps)}, 其中遮挡: {len(blocked_photos)}')
        print(f'    待复核: {review_flag}')
    print(f'  待复核记录数: {len(rm.get_records_needing_review())}')


if __name__ == '__main__':
    replay()
