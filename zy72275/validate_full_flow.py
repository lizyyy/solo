#!/usr/bin/env python3
import os
import shutil
import json
import sys
from archive_manager import ArchiveManager

def run_full_validation():
    if os.path.exists('./data'):
        shutil.rmtree('./data')
    
    manager = ArchiveManager()
    
    test_data = """热力井5号 无坐标 待补录
39.9042, 116.4074 X=123.45, Y=678.90 热力井6号 经纬度米制混合
"""
    
    lines = test_data.strip().split('\n')
    
    print("=" * 80)
    print("【步骤1】导入两条热力井记录")
    print("=" * 80)
    
    batch = manager.import_origin_points(
        source_file='thermal_wells_v2.txt',
        lines=lines,
        operator='系统导入员'
    )
    print(f"导入批次: {batch.batch_id}")
    print(f"新增: {batch.new_records}, 跳过: {batch.skipped_records}")
    print()
    
    points = manager.get_all_points()
    unknown_point = None
    mixed_point = None
    
    for p in points:
        print(f"  记录 {p.id}:")
        print(f"    原始行号: {p.original_line_number}")
        print(f"    原始内容: {p.raw_content}")
        print(f"    坐标类型: {p.coordinate_type}")
        print(f"    处理状态: {p.processing_status}")
        print(f"    经纬度: lat={p.latitude}, lng={p.longitude}")
        print(f"    米制: X={p.metric_x}, Y={p.metric_y}")
        print()
        
        if '无坐标' in p.raw_content:
            unknown_point = p
        elif 'X=' in p.raw_content and ',' in p.raw_content:
            mixed_point = p
    
    print("=" * 80)
    print("【断言1】无坐标记录判断")
    print("=" * 80)
    
    assert unknown_point is not None, "未找到无坐标记录"
    assert unknown_point.coordinate_type == 'unknown', f"无坐标记录应判为unknown，实为{unknown_point.coordinate_type}"
    assert unknown_point.processing_status == 'abnormal', f"无坐标记录状态应为abnormal，实为{unknown_point.processing_status}"
    print("✓ 断言1通过：无坐标记录被判为 unknown / ABNORMAL，没有因'坐标'二字误判为米制")
    print()
    
    print("=" * 80)
    print("【断言2】混合坐标记录判断")
    print("=" * 80)
    
    assert mixed_point is not None, "未找到混合坐标记录"
    assert mixed_point.coordinate_type == 'mixed', f"混合坐标应判为mixed，实为{mixed_point.coordinate_type}"
    assert mixed_point.processing_status == 'needs_review', f"混合坐标状态应为needs_review，实为{mixed_point.processing_status}"
    assert mixed_point.latitude == 39.9042, f"纬度提取错误: {mixed_point.latitude}"
    assert mixed_point.longitude == 116.4074, f"经度提取错误: {mixed_point.longitude}"
    assert mixed_point.metric_x == 123.45, f"米制X提取错误: {mixed_point.metric_x}"
    assert mixed_point.metric_y == 678.90, f"米制Y提取错误: {mixed_point.metric_y}"
    print("✓ 断言2通过：混合坐标被判为 mixed / needs_review，坐标值正确提取")
    print()
    
    print("=" * 80)
    print("【步骤2】许工补录：照片编号、备注、现场说明（对mixed记录）")
    print("=" * 80)
    
    manager.update_point_field(
        point_id=mixed_point.id,
        field_name='inspection_photo_id',
        new_value='PHOTO-XJ-2026-006',
        operator='许工',
        reason='现场补拍热力井6号'
    )
    manager.update_point_field(
        point_id=mixed_point.id,
        field_name='remark',
        new_value='井盖完好，管道无泄漏',
        operator='许工',
        reason='巡检备注'
    )
    manager.update_point_field(
        point_id=mixed_point.id,
        field_name='site_instruction',
        new_value='坐标待巡检组复核后施工',
        operator='许工',
        reason='给现场班组的说明'
    )
    
    p_after = manager.get_point(mixed_point.id)
    print(f"  补录后:")
    print(f"    inspection_photo_id = {p_after.inspection_photo_id}")
    print(f"    remark              = {p_after.remark}")
    print(f"    site_instruction    = {p_after.site_instruction}")
    print(f"    manual_modified     = {p_after.manual_modified}")
    print(f"    version             = {p_after.version}")
    print(f"    change_history 条数 = {len(p_after.change_history)}")
    print()
    
    print("=" * 80)
    print("【断言3】补录字段正确保存")
    print("=" * 80)
    
    assert p_after.inspection_photo_id == 'PHOTO-XJ-2026-006'
    assert p_after.remark == '井盖完好，管道无泄漏'
    assert p_after.site_instruction == '坐标待巡检组复核后施工'
    assert p_after.manual_modified == True
    assert p_after.version == 4  # 初始1 + 3次更新
    print("✓ 断言3通过：许工补录的三个字段都正确保存，版本号+3")
    print()
    
    print("=" * 80)
    print("【步骤3】保存 → 刷新 → 验证数据持久化")
    print("=" * 80)
    
    manager2 = ArchiveManager()
    p_reloaded = manager2.get_point(mixed_point.id)
    print(f"  重新加载后:")
    print(f"    inspection_photo_id = {p_reloaded.inspection_photo_id}")
    print(f"    remark              = {p_reloaded.remark}")
    print(f"    site_instruction    = {p_reloaded.site_instruction}")
    print(f"    version             = {p_reloaded.version}")
    print()
    
    assert p_reloaded.inspection_photo_id == 'PHOTO-XJ-2026-006'
    assert p_reloaded.remark == '井盖完好，管道无泄漏'
    assert p_reloaded.site_instruction == '坐标待巡检组复核后施工'
    assert p_reloaded.version == 4
    print("✓ 持久化验证通过：重新加载后数据一致")
    print()
    
    print("=" * 80)
    print("【步骤4】第一次默认全量回滚")
    print("=" * 80)
    
    rollback1 = manager2.rollback_point(mixed_point.id, '巡检组管理员')
    print(f"  回滚结果:")
    print(f"    回滚步数: {rollback1['steps_reverted']}")
    print(f"    恢复字段: {list(rollback1['reverted_fields'].keys())}")
    for f, d in rollback1['reverted_fields'].items():
        print(f"      {f}: {d['before_rollback']} → {d['after_rollback']}")
    print()
    
    p_rb1 = manager2.get_point(mixed_point.id)
    print(f"  回滚后字段:")
    print(f"    inspection_photo_id = {p_rb1.inspection_photo_id}")
    print(f"    remark              = {p_rb1.remark}")
    print(f"    site_instruction    = {p_rb1.site_instruction}")
    print(f"    processing_status   = {p_rb1.processing_status}")
    print(f"    coordinate_type     = {p_rb1.coordinate_type}")
    print(f"    version             = {p_rb1.version}")
    print(f"    change_history 条数 = {len(p_rb1.change_history)}")
    print()
    
    print("=" * 80)
    print("【断言4】第一次回滚后状态正确")
    print("=" * 80)
    
    assert rollback1['steps_reverted'] == 3, f"应回滚3步业务变更，实为{rollback1['steps_reverted']}"
    assert p_rb1.inspection_photo_id is None
    assert p_rb1.remark is None
    assert p_rb1.site_instruction is None
    assert p_rb1.processing_status == 'needs_review', f"processing_status应为needs_review，实为{p_rb1.processing_status}"
    assert p_rb1.coordinate_type == 'mixed', f"coordinate_type不应改变，实为{p_rb1.coordinate_type}"
    assert p_rb1.version == 5
    print("✓ 断言4通过：三个业务字段恢复为None，状态按mixed重算为needs_review")
    print()
    
    print("=" * 80)
    print("【步骤5】再次执行默认全量回滚（验证_rollback记录不污染业务）")
    print("=" * 80)
    
    print(f"  当前 change_history 内容:")
    for i, ch in enumerate(p_rb1.change_history):
        print(f"    [{i}] field={ch.field_name}, op={ch.operator}, from={ch.old_value}, to={ch.new_value[:50] if ch.new_value else None}")
    print()
    
    rollback2 = manager2.rollback_point(mixed_point.id, '巡检组管理员')
    print(f"  第二次回滚结果:")
    if rollback2:
        print(f"    回滚步数: {rollback2['steps_reverted']}")
        print(f"    恢复字段: {list(rollback2['reverted_fields'].keys())}")
    else:
        print(f"    无可回滚的业务变更（符合预期）")
    print()
    
    p_rb2 = manager2.get_point(mixed_point.id)
    print(f"  第二次回滚后:")
    print(f"    inspection_photo_id = {p_rb2.inspection_photo_id}")
    print(f"    remark              = {p_rb2.remark}")
    print(f"    site_instruction    = {p_rb2.site_instruction}")
    print(f"    processing_status   = {p_rb2.processing_status}")
    print(f"    coordinate_type     = {p_rb2.coordinate_type}")
    print(f"    version             = {p_rb2.version}")
    print(f"    change_history 条数 = {len(p_rb2.change_history)}")
    print()
    
    print("=" * 80)
    print("【断言5】第二次回滚不污染业务字段")
    print("=" * 80)
    
    assert rollback2 is None or rollback2['steps_reverted'] == 0, f"第二次回滚不应恢复任何业务字段，实为{rollback2}"
    assert p_rb2.inspection_photo_id is None, f"inspection_photo_id 被污染: {p_rb2.inspection_photo_id}"
    assert p_rb2.remark is None, f"remark 被污染: {p_rb2.remark}"
    assert p_rb2.site_instruction is None, f"site_instruction 被污染: {p_rb2.site_instruction}"
    assert p_rb2.coordinate_type == 'mixed', f"coordinate_type 不应改变"
    
    no_rollback_attr = not hasattr(p_rb2, '_rollback') or getattr(p_rb2, '_rollback', None) is None
    assert no_rollback_attr, "对象被污染了_rollback属性"
    
    print("✓ 断言5通过：第二次回滚时_rollback记录被跳过，业务字段保持None")
    print()
    
    print("=" * 80)
    print("【步骤6】重算并导出巡检结果")
    print("=" * 80)
    
    inspection = manager2.export_for_inspection()
    print(f"  待复核记录数: {len(inspection['needs_inspection'])}")
    print(f"  汇总: {inspection['summary']}")
    print()
    
    for item in inspection['needs_inspection']:
        print(f"  {item['point_id']}:")
        print(f"    原始行号: {item['original_line']}")
        print(f"    原始内容: {item['raw_content']}")
        print(f"    坐标类型: {item['coordinate_type']}")
        print(f"    处理状态: {item['processing_status']}")
        print()
    
    print("=" * 80)
    print("【断言6】巡检导出结果正确")
    print("=" * 80)
    
    assert inspection['summary']['by_coordinate_type']['unknown'] == 1
    assert inspection['summary']['by_coordinate_type']['mixed'] == 1
    assert inspection['summary']['by_status']['abnormal'] == 1
    assert inspection['summary']['by_status']['needs_review'] == 1
    assert len(inspection['needs_inspection']) >= 1, "mixed记录应在待复核列表中"
    
    mixed_in_inspection = [i for i in inspection['needs_inspection'] if i['point_id'] == mixed_point.id]
    assert len(mixed_in_inspection) == 1, "mixed记录应出现在巡检导出中"
    assert mixed_in_inspection[0]['coordinate_type'] == 'mixed'
    assert mixed_in_inspection[0]['processing_status'] == 'needs_review'
    print("✓ 断言6通过：巡检导出包含mixed记录，坐标类型和处理状态一致")
    print()
    
    print("=" * 80)
    print("【步骤7】重复导入验证（同一条记录不翻倍）")
    print("=" * 80)
    
    batch2 = manager2.import_origin_points(
        source_file='thermal_wells_v2.txt',
        lines=lines,
        operator='系统导入员'
    )
    print(f"  重复导入批次: {batch2.batch_id}")
    print(f"  新增: {batch2.new_records}, 跳过: {batch2.skipped_records}")
    print(f"  当前总记录数: {manager2.get_summary().total_records}")
    print()
    
    assert batch2.skipped_records == 2
    assert batch2.new_records == 0
    assert manager2.get_summary().total_records == 2
    print("✓ 重复导入验证通过：记录不翻倍")
    print()
    
    print("=" * 80)
    print("【步骤8】完整历史记录检查（证据链可复盘）")
    print("=" * 80)
    
    history = manager2.compare_versions(mixed_point.id)
    print(f"  记录ID: {history['point_id']}")
    print(f"  版本: {history['current_version']}")
    print(f"  原始行号: {history['original_line']}")
    print(f"  原始内容: {history['raw_content']}")
    print(f"  当前值: {json.dumps(history['current_values'], ensure_ascii=False)}")
    print(f"  历史记录 ({len(history['change_history'])} 条):")
    for i, c in enumerate(history['change_history']):
        ts = c['timestamp'].strftime('%Y-%m-%d %H:%M:%S') if hasattr(c['timestamp'], 'strftime') else str(c['timestamp'])[:19]
        print(f"    [{i}] {ts} | {c['operator']} | {c['field']}: {c['from']} -> {str(c['to'])[:60]}")
    print()
    
    print("=" * 80)
    print("✅ 所有验证通过！")
    print("=" * 80)
    print()
    print("核对要点汇总:")
    print("  ✓ 无坐标记录 → unknown / ABNORMAL（未误判为米制）")
    print("  ✓ 混合坐标记录 → mixed / needs_review")
    print("  ✓ 许工补录的三个字段正确保存")
    print("  ✓ 第一次回滚恢复了所有业务字段")
    print("  ✓ 第二次回滚跳过了_rollback系统记录，未污染业务字段")
    print("  ✓ processing_status 按 coordinate_type 重算，保持一致")
    print("  ✓ 巡检导出结果与记录状态一致")
    print("  ✓ 重复导入不翻倍")
    print("  ✓ 完整历史记录可复盘")
    
    return 0

if __name__ == '__main__':
    sys.exit(run_full_validation())
