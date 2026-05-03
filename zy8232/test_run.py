#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_importer import (
    import_students_csv, import_swipe_jsonl,
    import_routes_yaml, import_teacher_notes_csv
)
from database import (
    save_students, save_swipe_records, save_routes, save_teacher_notes,
    get_issues, get_trip_status, get_student_by_id
)
from trip_processor import process_all_trips

sample_dir = os.path.join(os.path.dirname(__file__), 'sample_data')

print('=' * 60)
print('  幼儿园校车晨检复核系统 - 功能测试')
print('=' * 60)

print('\n【1/4】导入数据...')

students = import_students_csv(os.path.join(sample_dir, 'students.csv'))
print(f'  ✓ 学生数据: {len(students)} 条')
save_students(students)

swipe = import_swipe_jsonl(os.path.join(sample_dir, 'swipe_records.jsonl'))
print(f'  ✓ 刷卡记录: {len(swipe)} 条')
save_swipe_records(swipe)

routes = import_routes_yaml(os.path.join(sample_dir, 'routes.yaml'))
print(f'  ✓ 路线数据: {len(routes)} 条')
save_routes(routes)

notes = import_teacher_notes_csv(os.path.join(sample_dir, 'teacher_notes.csv'))
print(f'  ✓ 老师备注: {len(notes)} 条')
save_teacher_notes(notes)

print('\n【2/4】处理行程数据...')
result = process_all_trips()
print(f'  ✓ 总行程数: {result["total_trips"]}')
print(f'  ✓ 总学生数: {result["total_students"]}')
print(f'  ✓ 发现异常: {result["total_issues"]} 个')

print('\n【3/4】异常检测验证...')
issues = get_issues()
issue_types = {}

for issue in issues:
    itype = issue['issue_type']
    if itype not in issue_types:
        issue_types[itype] = 0
    issue_types[itype] += 1

print('\n  异常类型统计:')
for itype, count in issue_types.items():
    print(f'    - {itype}: {count} 个')

print('\n  详细异常列表:')
for i, issue in enumerate(issues, 1):
    status = '✓ 已处理' if issue['is_handled'] else '○ 待处理'
    print(f'\n  {i}. [{issue["issue_type"]}] {issue["student_name"] or "未知"}')
    print(f'     状态: {status}')
    print(f'     描述: {issue["description"]}')

print('\n【4/4】演示场景验证...')

print('\n  场景1: 跨午夜晚托路线 (R004, 学生S011/S012)')
night_issues = [i for i in issues if '跨午夜晚托' in i['issue_type']]
if night_issues:
    print(f'    ✓ 检测到 {len(night_issues)} 个跨午夜晚托异常')
    for issue in night_issues:
        print(f'      - {issue["student_name"]}: {issue["description"]}')
else:
    print('    ✗ 未检测到跨午夜晚托异常')

print('\n  场景2: 重复刷卡 (学生S001, 2026-05-04)')
duplicate_issues = [i for i in issues if '重复刷卡' in i['issue_type']]
if duplicate_issues:
    print(f'    ✓ 检测到 {len(duplicate_issues)} 个重复刷卡异常')
    for issue in duplicate_issues:
        print(f'      - {issue["student_name"]}: {issue["description"]}')
else:
    print('    ✗ 未检测到重复刷卡异常')

print('\n  场景3: 错线路 (学生S002, 应R001实R002)')
wrong_route_issues = [i for i in issues if '错线路' in i['issue_type']]
if wrong_route_issues:
    print(f'    ✓ 检测到 {len(wrong_route_issues)} 个错线路异常')
    for issue in wrong_route_issues:
        print(f'      - {issue["student_name"]}: {issue["description"]}')
else:
    print('    ✗ 未检测到错线路异常')

print('\n  场景4: 未下车 (学生S007/S010)')
not_alight_issues = [i for i in issues if '未下车' in i['issue_type']]
if not_alight_issues:
    print(f'    ✓ 检测到 {len(not_alight_issues)} 个未下车异常')
    for issue in not_alight_issues:
        print(f'      - {issue["student_name"]}: {issue["description"]}')
else:
    print('    ✗ 未检测到未下车异常')

print('\n  场景5: 请假仍上车 (学生S010, 2026-05-03)')
leave_issues = [i for i in issues if '请假仍上车' in i['issue_type']]
if leave_issues:
    print(f'    ✓ 检测到 {len(leave_issues)} 个请假仍上车异常')
    for issue in leave_issues:
        print(f'      - {issue["student_name"]}: {issue["description"]}')
else:
    print('    ✗ 未检测到请假仍上车异常')

print('\n' + '=' * 60)
print('  测试完成!')
print('  系统准备就绪，可以启动 Flask 服务')
print('  启动命令: python app.py')
print('  访问地址: http://localhost:5000')
print('=' * 60)
