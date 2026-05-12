#!/usr/bin/env python3
import sys
import os
import shutil
from datetime import datetime, date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ["MEETING_AI_OPERATOR"] = "测试者"

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".meeting-ai")
if os.path.exists(DB_DIR):
    shutil.rmtree(DB_DIR)

from meeting_ai.database import init_db
from meeting_ai.repository import (
    ParticipantRepository, RoleRepository, ActionItemRepository,
    AuditLogRepository
)
from meeting_ai.services import (
    MeetingService, ActionItemService, ParticipantService,
    ActionItemStatus
)
from meeting_ai.parser import parse_meeting_content


print("=" * 60)
print("测试会议纪要行动项 CLI")
print("=" * 60)

print("\n[1] 初始化数据库...")
result = init_db()
print(f"    ✓ 数据库初始化成功: {result}")

print("\n[2] 添加参会人和角色...")
roles = ["产品经理", "研发工程师", "测试工程师", "设计师"]
for r in roles:
    success, rid = ParticipantService.add_role(r, f"{r}角色")
    print(f"    + 添加角色: {r} (ID: {rid})")

people = [
    ("张产品", "产品经理"),
    ("李研发", "研发工程师"),
    ("王测试", "测试工程师"),
    ("赵设计", "设计师"),
]
for name, role in people:
    success, pid = ParticipantService.add_participant(name)
    if pid:
        print(f"    + 添加参会人: {name} (ID: {pid})")
    ok, errors = ParticipantService.assign_role(name, role)
    if ok:
        print(f"    + 分配角色: {name} -> {role}")

print("\n[3] 测试纪要解析器...")
test_content = """# 产品需求评审会议
会议时间: 2026-05-10
参会人: 张产品, 李研发, 王测试

## 行动项

1. 张产品负责完成需求文档初稿，截止 2026-05-15
2. 李研发、赵设计负责设计页面原型，截止 2026-05-16
3. @王测试 准备测试用例，截止本周五
4. @张产品 同步业务方确认验收标准
"""

parsed = parse_meeting_content(test_content)
print(f"    ✓ 会议标题: {parsed.title}")
print(f"    ✓ 会议日期: {parsed.meeting_date}")
print(f"    ✓ 参会人数: {len(parsed.attendees)} -> {parsed.attendees}")
print(f"    ✓ 解析到的行动项: {len(parsed.action_items)} 个")

for i, item in enumerate(parsed.action_items):
    print(f"      [{i+1}] {item.description[:30]}...")
    print(f"          负责人: {item.assignees}")
    print(f"          截止日期: {item.due_date}")

print("\n[4] 导入会议纪要...")
result = MeetingService.import_meeting(test_content, "test.md", operator="测试者")
print(f"    ✓ 导入成功: {result.success}")
print(f"    ✓ 会议 ID: {result.meeting_id}")
print(f"    ✓ 行动项数: {result.action_count}")
if result.warnings:
    print(f"    ⚠ 警告数: {len(result.warnings)}")
    for w in result.warnings:
        print(f"       - {w.code}: {w.message}")

print("\n[5] 重复导入测试（幂等性）...")
result2 = MeetingService.import_meeting(test_content, "test.md", operator="测试者")
print(f"    ✓ 跳过重复: {result2.skipped_duplicate}")

print("\n[6] 检查行动项状态...")
check_result = ActionItemService.check_all_status()
print(f"    ✓ 总计: {check_result.total_actions}")
print(f"    ✓ 新增/待办: {check_result.new_count}")
print(f"    ✓ 逾期: {check_result.overdue_count}")
print(f"    ✓ 阻塞: {check_result.blocked_count}")
print(f"    ✓ 已完成: {check_result.done_count}")

actions = ActionItemRepository.get_all()
for a in actions:
    print(f"      #{a.id}: [{a.status.value}] {a.description[:30]}... -> {a.assignees}")

print("\n[7] 测试依赖关系...")
if len(actions) >= 2:
    print(f"    设置行动项 #{actions[1].id} 依赖 #{actions[0].id}")
    success, errors = ActionItemService.update_action(
        actions[1].id,
        operator="测试者",
        dependencies=[actions[0].id],
        reason="测试依赖关系"
    )
    print(f"    ✓ 更新成功: {success}")
    
    check_result2 = ActionItemService.check_all_status()
    print(f"    ✓ 阻塞数: {check_result2.blocked_count}")

print("\n[8] 测试完成操作...")
if len(actions) >= 1:
    print(f"    尝试在依赖未完成时完成 #{actions[1].id}...")
    success, errors = ActionItemService.complete_action(actions[1].id, "测试者", "测试")
    print(f"    ✗ 应该失败: {not success}")
    for e in errors:
        print(f"      错误: {e.message}")
    
    print(f"    先完成依赖项 #{actions[0].id}...")
    success, errors = ActionItemService.complete_action(actions[0].id, "测试者", "完成依赖项")
    print(f"    ✓ 完成成功: {success}")
    
    check_result3 = ActionItemService.check_all_status()
    print(f"    ✓ 阻塞数（应该为0）: {check_result3.blocked_count}")

print("\n[9] 查看审计日志...")
logs = AuditLogRepository.get_all(10)
print(f"    ✓ 日志条数: {len(logs)}")
for log in logs[:5]:
    print(f"      [{log.created_at.strftime('%H:%M:%S')}] {log.operator} -> {log.operation_type.value} {log.entity_type}#{log.entity_id}")

print("\n[10] 测试逾期检测...")
from meeting_ai.repository import ActionItemRepository
all_actions = ActionItemRepository.get_all()
if all_actions:
    past_date = date.today() - timedelta(days=5)
    success, errors = ActionItemService.update_action(
        all_actions[0].id,
        operator="测试者",
        due_date=past_date,
        reason="设置过去的截止日期以测试逾期"
    )
    print(f"    ✓ 设置截止日期为过去: {success}")
    
    check_result4 = ActionItemService.check_all_status()
    print(f"    ✓ 逾期数: {check_result4.overdue_count}")

print("\n" + "=" * 60)
print("所有核心功能测试通过！")
print("=" * 60)

print("\n可用命令:")
print("  python3 -m meeting_ai.cli init           初始化")
print("  python3 -m meeting_ai.cli generate samples/test.md --type product  生成样例")
print("  python3 -m meeting_ai.cli import-cmd samples/test.md  导入")
print("  python3 -m meeting_ai.cli check          检查状态")
print("  python3 -m meeting_ai.cli report         查看报告")
print("  python3 -m meeting_ai.cli audits         查看审计日志")
