#!/usr/bin/env python3
import argparse
import json
import sys
from archive_manager import ArchiveManager


def cmd_import(args):
    manager = ArchiveManager()
    with open(args.file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    batch = manager.import_origin_points(
        source_file=args.file,
        lines=lines,
        operator=args.operator,
        skip_duplicates=not args.force_update
    )
    print(f"导入批次: {batch.batch_id}")
    print(f"总计: {batch.total_records} 条")
    print(f"新增: {batch.new_records} 条")
    print(f"更新: {batch.updated_records} 条")
    print(f"跳过: {batch.skipped_records} 条")


def cmd_update(args):
    manager = ArchiveManager()
    success = manager.update_point_field(
        point_id=args.point_id,
        field_name=args.field,
        new_value=args.value,
        operator=args.operator,
        reason=args.reason
    )
    if success:
        print(f"更新成功: {args.point_id}")
    else:
        print(f"更新失败: 记录不存在或值未变化")
        sys.exit(1)


def cmd_rollback(args):
    manager = ArchiveManager()
    result = manager.rollback_point(args.point_id, args.operator, steps=args.steps or 0)
    if result is None:
        print(f"回滚失败: 记录不存在或无变更历史")
        sys.exit(1)
    
    print(f"回滚成功: {result['point_id']}")
    print(f"回滚步数: {result['steps_reverted']}")
    print(f"当前状态: {result['current_status']} (坐标类型: {result['current_coordinate_type']})")
    print()
    print("恢复字段详情:")
    for field, detail in result['reverted_fields'].items():
        print(f"  {field}:")
        print(f"    回滚前: {detail['before_rollback']}")
        print(f"    回滚后: {detail['after_rollback']}")
        print(f"    原改动人: {detail['original_change_operator']}")


def cmd_history(args):
    manager = ArchiveManager()
    history = manager.compare_versions(args.point_id)
    if not history:
        print(f"未找到记录: {args.point_id}")
        sys.exit(1)
    
    print(json.dumps(history, ensure_ascii=False, indent=2, default=str))


def cmd_list(args):
    manager = ArchiveManager()
    points = manager.get_all_points()
    
    if args.status:
        points = [p for p in points if p.processing_status == args.status]
    if args.type:
        points = [p for p in points if p.coordinate_type == args.type]
    
    for p in points:
        print(f"{p.id} | 行{p.original_line_number} | {p.coordinate_type} | {p.processing_status} | {p.raw_content[:50]}...")


def cmd_summary(args):
    manager = ArchiveManager()
    summary = manager.get_summary()
    print(json.dumps(summary.model_dump(mode='json'), ensure_ascii=False, indent=2))


def cmd_inspection(args):
    manager = ArchiveManager()
    result = manager.export_for_inspection()
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


def cmd_batches(args):
    manager = ArchiveManager()
    batches = manager.get_batches()
    for b in batches:
        print(f"{b.batch_id} | {b.imported_at.strftime('%Y-%m-%d %H:%M:%S')} | {b.operator} | 总计{b.total_records}/新增{b.new_records}/跳过{b.skipped_records}")


def cmd_demo(args):
    import os
    import shutil
    
    demo_data = """39.9042, 116.4074 主井1号
X=100.5, Y=200.3 副井2号
39.9042, 116.4074 X=50, Y=80 混合坐标井3号
40.0000, 117.0000 备用井4号
"""
    
    if os.path.exists('./data'):
        shutil.rmtree('./data')
    
    manager = ArchiveManager()
    
    print("=" * 60)
    print("步骤1: 坐标原点说明第一次导入")
    print("=" * 60)
    
    lines = demo_data.strip().split('\n')
    batch1 = manager.import_origin_points(
        source_file='demo_coords.txt',
        lines=lines,
        operator='系统导入员'
    )
    print(f"批次: {batch1.batch_id}")
    print(f"新增: {batch1.new_records} 条")
    print()
    
    points = manager.get_all_points()
    mixed_point = None
    for p in points:
        print(f"  {p.id} | 行{p.original_line_number} | {p.coordinate_type} | {p.processing_status}")
        if p.coordinate_type == 'mixed':
            mixed_point = p
    
    print()
    print("=" * 60)
    print("步骤2: 设备工程师许工补看巡检照片编号")
    print("=" * 60)
    
    if mixed_point:
        manager.update_point_field(
            point_id=mixed_point.id,
            field_name='inspection_photo_id',
            new_value='PHOTO-2024-001',
            operator='许工',
            reason='补录巡检照片编号'
        )
        print(f"许工更新记录 {mixed_point.id}:")
        print(f"  - 新增巡检照片编号: PHOTO-2024-001")
        print(f"  - 坐标类型仍为: mixed (待巡检组复核，不归为normal)")
        print(f"  - 处理状态仍为: needs_review")
    
    print()
    print("=" * 60)
    print("步骤3: 给现场班组看的说明更新")
    print("=" * 60)
    
    for p in points:
        if p.coordinate_type != 'mixed':
            manager.update_point_field(
                point_id=p.id,
                field_name='site_instruction',
                new_value='按坐标定位施工',
                operator='施工管理员',
                reason='更新现场施工说明'
            )
    print("已为正常坐标记录更新现场施工说明")
    
    print()
    print("=" * 60)
    print("验证: 重复导入同一批不翻倍")
    print("=" * 60)
    
    batch2 = manager.import_origin_points(
        source_file='demo_coords.txt',
        lines=lines,
        operator='系统导入员'
    )
    print(f"重复导入批次: {batch2.batch_id}")
    print(f"新增: {batch2.new_records} 条, 跳过: {batch2.skipped_records} 条")
    print(f"当前总记录数: {manager.get_summary().total_records}")
    
    print()
    print("=" * 60)
    print("验证: 查看单条记录的改前改后差别")
    print("=" * 60)
    
    if mixed_point:
        history = manager.compare_versions(mixed_point.id)
        print(f"记录ID: {history['point_id']}")
        print(f"原始行号: {history['original_line']}")
        print(f"原始内容: {history['raw_content']}")
        print(f"变更历史:")
        for c in history['change_history']:
            print(f"  - {c['timestamp'].strftime('%H:%M:%S')} | {c['operator']} | {c['field']}: {c['from']} -> {c['to']}")
    
    print()
    print("=" * 60)
    print("回放复盘: 回滚mixed记录，验证人工改动字段被恢复")
    print("=" * 60)
    
    if mixed_point:
        p_before = manager.get_point(mixed_point.id)
        print(f"回滚前状态:")
        print(f"  processing_status  = {p_before.processing_status}")
        print(f"  inspection_photo_id = {p_before.inspection_photo_id}")
        print(f"  remark             = {p_before.remark}")
        print(f"  site_instruction   = {p_before.site_instruction}")
        print(f"  coordinate_type    = {p_before.coordinate_type}")
        print()
        
        rollback_result = manager.rollback_point(mixed_point.id, '巡检组管理员')
        
        p_after = manager.get_point(mixed_point.id)
        print(f"回滚后状态 (回滚 {rollback_result['steps_reverted']} 步):")
        print(f"  processing_status  = {p_after.processing_status}")
        print(f"  inspection_photo_id = {p_after.inspection_photo_id}")
        print(f"  remark             = {p_after.remark}")
        print(f"  site_instruction   = {p_after.site_instruction}")
        print(f"  coordinate_type    = {p_after.coordinate_type}")
        print()
        
        print("字段恢复详情:")
        for field, detail in rollback_result['reverted_fields'].items():
            print(f"  {field}: {detail['before_rollback']} -> {detail['after_rollback']} (原改动人: {detail['original_change_operator']})")
        print()
        
        assert p_after.inspection_photo_id is None, f"回滚失败: inspection_photo_id 未恢复, 仍为 {p_after.inspection_photo_id}"
        assert p_after.processing_status == 'needs_review', f"回滚失败: processing_status 应为 needs_review, 实为 {p_after.processing_status}"
        assert p_after.coordinate_type == 'mixed', f"回滚失败: coordinate_type 被改掉了, 实为 {p_after.coordinate_type}"
        print("✓ 断言通过: inspection_photo_id 已恢复为 None")
        print("✓ 断言通过: processing_status 按坐标类型重算为 needs_review (mixed → needs_review)")
        print("✓ 断言通过: coordinate_type 未被改动，仍为 mixed")
    
    print()
    print("=" * 60)
    print("回放复盘: 回滚normal坐标记录，验证现场说明被恢复")
    print("=" * 60)
    
    normal_points = [p for p in manager.get_all_points() if p.coordinate_type != 'mixed']
    if normal_points:
        np = normal_points[0]
        p_before = manager.get_point(np.id)
        print(f"回滚前 ({np.id}):")
        print(f"  site_instruction   = {p_before.site_instruction}")
        print(f"  processing_status  = {p_before.processing_status}")
        print()
        
        rollback_result = manager.rollback_point(np.id, '巡检组管理员')
        
        p_after = manager.get_point(np.id)
        print(f"回滚后:")
        print(f"  site_instruction   = {p_after.site_instruction}")
        print(f"  processing_status  = {p_after.processing_status}")
        print()
        
        assert p_after.site_instruction is None, f"回滚失败: site_instruction 未恢复, 仍为 {p_after.site_instruction}"
        assert p_after.processing_status == 'pending', f"回滚失败: processing_status 应为 pending, 实为 {p_after.processing_status}"
        print("✓ 断言通过: site_instruction 已恢复为 None")
        print("✓ 断言通过: processing_status 按坐标类型重算为 pending (lat_lng → pending)")
    
    print()
    print("=" * 60)
    print("导出巡检组复核数据 (mixed坐标不自动归为normal)")
    print("=" * 60)
    inspection = manager.export_for_inspection()
    print(f"待复核记录数: {len(inspection['needs_inspection'])}")
    for item in inspection['needs_inspection']:
        print(f"  {item['point_id']} | {item['coordinate_type']} | {item['processing_status']}")
        print(f"    原始内容: {item['raw_content']}")
        print(f"    经纬度: {item['latitude']}, {item['longitude']}")
        print(f"    米制: X={item['metric_x']}, Y={item['metric_y']}")


def main():
    parser = argparse.ArgumentParser(description='园区热力井空间归档系统')
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    import_parser = subparsers.add_parser('import', help='导入坐标原点说明')
    import_parser.add_argument('file', help='源文件路径')
    import_parser.add_argument('--operator', required=True, help='操作人')
    import_parser.add_argument('--force-update', action='store_true', help='强制更新重复记录')
    
    update_parser = subparsers.add_parser('update', help='更新记录字段')
    update_parser.add_argument('point_id', help='记录ID')
    update_parser.add_argument('field', help='字段名')
    update_parser.add_argument('value', help='新值')
    update_parser.add_argument('--operator', required=True, help='操作人')
    update_parser.add_argument('--reason', help='变更原因')
    
    rollback_parser = subparsers.add_parser('rollback', help='回滚记录')
    rollback_parser.add_argument('point_id', help='记录ID')
    rollback_parser.add_argument('--operator', required=True, help='操作人')
    rollback_parser.add_argument('--steps', type=int, default=0, help='回滚步数(0=全部)')
    
    history_parser = subparsers.add_parser('history', help='查看记录历史')
    history_parser.add_argument('point_id', help='记录ID')
    
    list_parser = subparsers.add_parser('list', help='列出所有记录')
    list_parser.add_argument('--status', help='按状态过滤')
    list_parser.add_argument('--type', help='按坐标类型过滤')
    
    subparsers.add_parser('summary', help='查看汇总统计')
    subparsers.add_parser('inspection', help='导出巡检复核数据')
    subparsers.add_parser('batches', help='查看导入批次')
    subparsers.add_parser('demo', help='运行完整演示流程')
    
    args = parser.parse_args()
    
    if args.command == 'import':
        cmd_import(args)
    elif args.command == 'update':
        cmd_update(args)
    elif args.command == 'rollback':
        cmd_rollback(args)
    elif args.command == 'history':
        cmd_history(args)
    elif args.command == 'list':
        cmd_list(args)
    elif args.command == 'summary':
        cmd_summary(args)
    elif args.command == 'inspection':
        cmd_inspection(args)
    elif args.command == 'batches':
        cmd_batches(args)
    elif args.command == 'demo':
        cmd_demo(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
