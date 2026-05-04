#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
志愿者排班工具 - 本地自动化排班系统
支持导入报名CSV、请假/调班文本，生成排班建议并检测冲突
"""

import argparse
import os
import sys
from pathlib import Path

from .models import Volunteer, Course, ScheduleResult
from .csv_parser import CSVParser
from .text_parser import TextParser
from .scheduler import Scheduler
from .conflict_detector import ConflictDetector
from .data_store import DataStore
from .markdown_exporter import MarkdownExporter


def main():
    parser = argparse.ArgumentParser(
        description='志愿者排班工具 - 自动化排班系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  # 导入志愿者报名CSV
  python -m scheduler import-volunteers volunteers.csv
  
  # 导入课程配置CSV
  python -m scheduler import-courses courses.csv
  
  # 导入请假/调班消息
  python -m scheduler import-leaves leaves.txt
  python -m scheduler import-swaps swaps.txt
  
  # 执行排班
  python -m scheduler schedule
  
  # 导出排班表和异常清单
  python -m scheduler export --schedule schedule.md --anomalies anomalies.md
  
  # 查看数据状态
  python -m scheduler status
  
  # 查看排班结果
  python -m scheduler show
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    import_volunteers_parser = subparsers.add_parser('import-volunteers', help='导入志愿者报名CSV')
    import_volunteers_parser.add_argument('file', help='CSV文件路径')
    import_volunteers_parser.add_argument('--merge', action='store_true', help='合并到现有数据')
    
    import_courses_parser = subparsers.add_parser('import-courses', help='导入课程配置CSV')
    import_courses_parser.add_argument('file', help='CSV文件路径')
    import_courses_parser.add_argument('--merge', action='store_true', help='合并到现有数据')
    
    import_leaves_parser = subparsers.add_parser('import-leaves', help='导入请假消息文本')
    import_leaves_parser.add_argument('file', help='文本文件路径')
    import_leaves_parser.add_argument('--merge', action='store_true', help='合并到现有数据')
    
    import_swaps_parser = subparsers.add_parser('import-swaps', help='导入调班消息文本')
    import_swaps_parser.add_argument('file', help='文本文件路径')
    import_swaps_parser.add_argument('--merge', action='store_true', help='合并到现有数据')
    
    import_jielong_parser = subparsers.add_parser('import-jielong', help='导入微信接龙消息')
    import_jielong_parser.add_argument('file', help='文本文件路径')
    
    schedule_parser = subparsers.add_parser('schedule', help='执行排班')
    schedule_parser.add_argument('--no-backup', action='store_true', help='不创建历史备份')
    
    export_parser = subparsers.add_parser('export', help='导出排班结果')
    export_parser.add_argument('--schedule', help='排班表输出路径（Markdown）')
    export_parser.add_argument('--anomalies', help='异常清单输出路径（Markdown）')
    export_parser.add_argument('--volunteers', help='志愿者汇总输出路径（Markdown）')
    export_parser.add_argument('--courses', help='课程汇总输出路径（Markdown）')
    export_parser.add_argument('--all', help='全部导出到指定目录')
    
    status_parser = subparsers.add_parser('status', help='查看数据状态')
    
    show_parser = subparsers.add_parser('show', help='显示排班结果')
    show_parser.add_argument('--conflicts', action='store_true', help='只显示冲突')
    show_parser.add_argument('--gaps', action='store_true', help='只显示缺口')
    
    clear_parser = subparsers.add_parser('clear', help='清除所有数据')
    clear_parser.add_argument('--force', action='store_true', help='强制清除（不确认）')
    
    args = parser.parse_args()
    
    data_store = DataStore()
    csv_parser = CSVParser()
    text_parser = TextParser()
    scheduler = Scheduler()
    conflict_detector = ConflictDetector()
    markdown_exporter = MarkdownExporter()
    
    if args.command == 'import-volunteers':
        import_volunteers(args, data_store, csv_parser)
    elif args.command == 'import-courses':
        import_courses(args, data_store, csv_parser)
    elif args.command == 'import-leaves':
        import_leaves(args, data_store, text_parser)
    elif args.command == 'import-swaps':
        import_swaps(args, data_store, text_parser)
    elif args.command == 'import-jielong':
        import_jielong(args, data_store, text_parser)
    elif args.command == 'schedule':
        run_schedule(args, data_store, scheduler, conflict_detector)
    elif args.command == 'export':
        export_results(args, data_store, markdown_exporter)
    elif args.command == 'status':
        show_status(data_store)
    elif args.command == 'show':
        show_schedule(args, data_store)
    elif args.command == 'clear':
        clear_data(args, data_store)
    else:
        parser.print_help()


def import_volunteers(args, data_store: DataStore, csv_parser: CSVParser):
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 - {file_path}")
        return
    
    volunteers = csv_parser.parse_volunteers(str(file_path))
    print(f"解析到 {len(volunteers)} 名志愿者")
    
    if args.merge:
        existing = data_store.load_volunteers()
        existing_ids = {v.id for v in existing}
        for v in volunteers:
            if v.id not in existing_ids:
                existing.append(v)
        volunteers = existing
        print(f"合并后共 {len(volunteers)} 名志愿者")
    
    if data_store.save_volunteers(volunteers):
        print("志愿者数据已保存")
    else:
        print("保存失败")


def import_courses(args, data_store: DataStore, csv_parser: CSVParser):
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 - {file_path}")
        return
    
    courses = csv_parser.parse_courses(str(file_path))
    print(f"解析到 {len(courses)} 门课程")
    
    if args.merge:
        existing = data_store.load_courses()
        existing_ids = {c.id for c in existing}
        for c in courses:
            if c.id not in existing_ids:
                existing.append(c)
        courses = existing
        print(f"合并后共 {len(courses)} 门课程")
    
    if data_store.save_courses(courses):
        print("课程数据已保存")
    else:
        print("保存失败")


def import_leaves(args, data_store: DataStore, text_parser: TextParser):
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 - {file_path}")
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    volunteers = data_store.load_volunteers()
    leaves = text_parser.parse_leave_requests(text, volunteers)
    print(f"解析到 {len(leaves)} 条请假记录")
    
    if args.merge:
        existing = data_store.load_leave_requests()
        existing.extend(leaves)
        leaves = existing
        print(f"合并后共 {len(leaves)} 条请假记录")
    
    if data_store.save_leave_requests(leaves):
        print("请假数据已保存")
    else:
        print("保存失败")


def import_swaps(args, data_store: DataStore, text_parser: TextParser):
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 - {file_path}")
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    volunteers = data_store.load_volunteers()
    swaps = text_parser.parse_swap_requests(text, volunteers)
    print(f"解析到 {len(swaps)} 条调班记录")
    
    if args.merge:
        existing = data_store.load_swap_requests()
        existing.extend(swaps)
        swaps = existing
        print(f"合并后共 {len(swaps)} 条调班记录")
    
    if data_store.save_swap_requests(swaps):
        print("调班数据已保存")
    else:
        print("保存失败")


def import_jielong(args, data_store: DataStore, text_parser: TextParser):
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 - {file_path}")
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    existing_volunteers = data_store.load_volunteers()
    new_volunteers, leaves, swaps = text_parser.parse_wechat_jielong(text, existing_volunteers)
    
    print(f"解析到:")
    print(f"  - 新志愿者: {len(new_volunteers)} 名")
    print(f"  - 请假记录: {len(leaves)} 条")
    print(f"  - 调班记录: {len(swaps)} 条")
    
    if new_volunteers:
        existing = data_store.load_volunteers()
        existing_ids = {v.id for v in existing}
        for v in new_volunteers:
            if v.id not in existing_ids:
                existing.append(v)
        if data_store.save_volunteers(existing):
            print("志愿者数据已更新")
    
    if leaves:
        existing_leaves = data_store.load_leave_requests()
        existing_leaves.extend(leaves)
        if data_store.save_leave_requests(existing_leaves):
            print("请假数据已更新")
    
    if swaps:
        existing_swaps = data_store.load_swap_requests()
        existing_swaps.extend(swaps)
        if data_store.save_swap_requests(existing_swaps):
            print("调班数据已更新")


def run_schedule(args, data_store: DataStore, scheduler: Scheduler, conflict_detector: ConflictDetector):
    volunteers = data_store.load_volunteers()
    courses = data_store.load_courses()
    leaves = data_store.load_leave_requests()
    swaps = data_store.load_swap_requests()
    
    if not volunteers:
        print("错误：没有志愿者数据，请先导入志愿者报名数据")
        return
    
    if not courses:
        print("错误：没有课程数据，请先导入课程配置数据")
        return
    
    print(f"开始排班...")
    print(f"  - 志愿者: {len(volunteers)} 名")
    print(f"  - 课程: {len(courses)} 门")
    print(f"  - 请假记录: {len(leaves)} 条")
    print(f"  - 调班记录: {len(swaps)} 条")
    
    schedule_result = scheduler.schedule(
        volunteers=volunteers,
        courses=courses,
        leave_requests=leaves,
        swap_requests=swaps
    )
    
    schedule_result = conflict_detector.detect_and_update(
        schedule_result=schedule_result,
        volunteers=volunteers,
        courses=courses,
        leave_requests=leaves,
        swap_requests=swaps
    )
    
    print(f"\n排班完成：")
    print(f"  - 分配记录: {len(schedule_result.assignments)} 条")
    print(f"  - 冲突: {len(schedule_result.conflicts)} 项")
    print(f"  - 缺口: {len(schedule_result.gaps)} 项")
    
    create_backup = not args.no_backup
    if data_store.save_schedule(schedule_result, create_backup=create_backup):
        if create_backup:
            print("排班结果已保存（已创建历史备份）")
        else:
            print("排班结果已保存")
    else:
        print("保存失败")


def export_results(args, data_store: DataStore, markdown_exporter: MarkdownExporter):
    data = data_store.load_all()
    schedule = data['schedule']
    volunteers = data['volunteers']
    courses = data['courses']
    leaves = data['leave_requests']
    swaps = data['swap_requests']
    
    if args.all:
        output_dir = Path(args.all)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if schedule:
            schedule_content = markdown_exporter.export_schedule(schedule, courses, volunteers)
            schedule_path = output_dir / "排班表.md"
            markdown_exporter.save_to_file(schedule_content, str(schedule_path))
            print(f"排班表已导出: {schedule_path}")
            
            anomalies_content = markdown_exporter.export_anomaly_list(schedule, leaves, swaps)
            anomalies_path = output_dir / "异常清单.md"
            markdown_exporter.save_to_file(anomalies_content, str(anomalies_path))
            print(f"异常清单已导出: {anomalies_path}")
        
        if volunteers:
            volunteer_content = markdown_exporter.export_volunteer_summary(volunteers, schedule)
            volunteer_path = output_dir / "志愿者汇总.md"
            markdown_exporter.save_to_file(volunteer_content, str(volunteer_path))
            print(f"志愿者汇总已导出: {volunteer_path}")
        
        if courses:
            course_content = markdown_exporter.export_course_summary(courses, schedule)
            course_path = output_dir / "课程汇总.md"
            markdown_exporter.save_to_file(course_content, str(course_path))
            print(f"课程汇总已导出: {course_path}")
        
        return
    
    if args.schedule:
        if not schedule:
            print("错误：没有排班数据，请先执行排班")
            return
        content = markdown_exporter.export_schedule(schedule, courses, volunteers)
        if markdown_exporter.save_to_file(content, args.schedule):
            print(f"排班表已导出: {args.schedule}")
        else:
            print("导出失败")
    
    if args.anomalies:
        if not schedule:
            print("错误：没有排班数据，请先执行排班")
            return
        content = markdown_exporter.export_anomaly_list(schedule, leaves, swaps)
        if markdown_exporter.save_to_file(content, args.anomalies):
            print(f"异常清单已导出: {args.anomalies}")
        else:
            print("导出失败")
    
    if args.volunteers:
        if not volunteers:
            print("错误：没有志愿者数据")
            return
        content = markdown_exporter.export_volunteer_summary(volunteers, schedule)
        if markdown_exporter.save_to_file(content, args.volunteers):
            print(f"志愿者汇总已导出: {args.volunteers}")
        else:
            print("导出失败")
    
    if args.courses:
        if not courses:
            print("错误：没有课程数据")
            return
        content = markdown_exporter.export_course_summary(courses, schedule)
        if markdown_exporter.save_to_file(content, args.courses):
            print(f"课程汇总已导出: {args.courses}")
        else:
            print("导出失败")


def show_status(data_store: DataStore):
    status = data_store.get_data_status()
    
    print("=" * 50)
    print("数据状态")
    print("=" * 50)
    print(f"数据目录: {status['data_dir']}")
    print()
    print(f"志愿者数据:")
    print(f"  - 存在: {'是' if status['volunteers']['exists'] else '否'}")
    print(f"  - 数量: {status['volunteers']['count']} 名")
    print()
    print(f"课程数据:")
    print(f"  - 存在: {'是' if status['courses']['exists'] else '否'}")
    print(f"  - 数量: {status['courses']['count']} 门")
    print()
    print(f"排班数据:")
    print(f"  - 存在: {'是' if status['schedule']['exists'] else '否'}")
    if status['schedule']['last_modified']:
        print(f"  - 最后修改: {status['schedule']['last_modified']}")
    print()
    print(f"请假记录:")
    print(f"  - 存在: {'是' if status['leave_requests']['exists'] else '否'}")
    print(f"  - 数量: {status['leave_requests']['count']} 条")
    print()
    print(f"调班记录:")
    print(f"  - 存在: {'是' if status['swap_requests']['exists'] else '否'}")
    print(f"  - 数量: {status['swap_requests']['count']} 条")
    print()
    print(f"历史备份: {status['history_count']} 份")
    print()
    
    history_files = data_store.list_history_files()
    if history_files:
        print("历史文件:")
        for hf in history_files[:5]:
            print(f"  - {hf}")
        if len(history_files) > 5:
            print(f"  ... 还有 {len(history_files) - 5} 份")


def show_schedule(args, data_store: DataStore):
    data = data_store.load_all()
    schedule = data['schedule']
    
    if not schedule:
        print("没有排班数据，请先执行排班")
        return
    
    print("=" * 50)
    print("排班结果")
    print("=" * 50)
    print(f"生成时间: {schedule.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    if args.conflicts or args.gaps:
        if args.conflicts and schedule.conflicts:
            print("冲突列表:")
            for c in schedule.conflicts:
                severity_icon = {
                    "高": "🔴",
                    "中": "🟡",
                    "低": "🟢"
                }.get(c.severity, "⚠️")
                print(f"  {severity_icon} [{c.severity}] {c.conflict_type}: {c.description}")
            print()
        
        if args.gaps and schedule.gaps:
            print("缺口列表:")
            for g in schedule.gaps:
                print(f"  📭 {g.gap_type}: {g.description}")
            print()
        return
    
    print(f"分配记录 ({len(schedule.assignments)} 条):")
    from collections import defaultdict
    
    by_day = defaultdict(list)
    for a in schedule.assignments:
        day = a.time_slot.day.value
        by_day[day].append(a)
    
    day_order = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    for day in day_order:
        if day not in by_day:
            continue
        print(f"\n  {day}:")
        assignments = sorted(by_day[day], key=lambda a: a.time_slot.start_time)
        for a in assignments:
            time_str = f"{a.time_slot.start_time.strftime('%H:%M')}-{a.time_slot.end_time.strftime('%H:%M')}"
            print(f"    {time_str} | {a.course_name} | {a.volunteer_name} ({a.assigned_skill.value})")
    
    if schedule.conflicts:
        print(f"\n冲突 ({len(schedule.conflicts)} 项):")
        for c in schedule.conflicts:
            severity_icon = {
                "高": "🔴",
                "中": "🟡",
                "低": "🟢"
            }.get(c.severity, "⚠️")
            print(f"  {severity_icon} [{c.severity}] {c.conflict_type}: {c.description}")
    
    if schedule.gaps:
        print(f"\n缺口 ({len(schedule.gaps)} 项):")
        for g in schedule.gaps:
            print(f"  📭 {g.gap_type}: {g.description}")
    
    print()
    print(f"总计: {len(schedule.assignments)} 条分配, {len(schedule.conflicts)} 项冲突, {len(schedule.gaps)} 项缺口")


def clear_data(args, data_store: DataStore):
    if not args.force:
        confirm = input("确定要清除所有数据吗？(输入 'yes' 确认): ")
        if confirm != 'yes':
            print("操作已取消")
            return
    
    if data_store.clear_all_data(confirm=True):
        print("所有数据已清除")
    else:
        print("清除失败")


if __name__ == '__main__':
    main()
