with open('demo.py', 'r', encoding='utf-8') as f:
    content = f.read()

old1 = '        batch, conflicts, self_check_summary = step2_xiaomeng_review_gray_batch(\n            db, gray_batch.id, "模型评测-小孟", "审阅完成，发现冲突需确认"\n        )\n        print(f"✓ 审阅人: {batch.reviewed_by}")\n        print(f"✓ 审阅时间: {batch.reviewed_at}")\n        print(f"✓ 发现冲突: {len(conflicts)} 个")'

new1 = '        batch, conflicts, self_check_summary, conflict_summary, reconcile_result = step2_xiaomeng_review_gray_batch(\n            db, gray_batch.id, "模型评测-小孟", "审阅完成，发现冲突需确认"\n        )\n        print(f"✓ 审阅人: {batch.reviewed_by}")\n        print(f"✓ 审阅时间: {batch.reviewed_at}")\n        print(f"✓ 发现冲突: {len(conflicts)} 个")\n        print(f"✓ 待办冲突汇总: {conflict_summary[\'unique_todos_with_pending\']} 条待办有未处理冲突")\n        if reconcile_result["auto_resolved"] > 0:\n            print(f"✓ 自动对齐过期冲突: {reconcile_result[\'auto_resolved\']} 条")'

if old1 in content:
    content = content.replace(old1, new1)
    print('Fix 1 done: step2 return values')
else:
    print('Fix 1 NOT applied: pattern not found')

old2 = '            resolved = resolve_conflict(\n                db, conflicts[0].id, "confirm",\n                "确认按业务备注的例外处理，提交安全审核",\n                "模型评测-小孟"\n            )\n            print(f"✓ 冲突 #{conflicts[0].id} 已确认")\n            print(f"  处理方式: {resolved.resolution}")'

new2 = '            resolved, sibling_resolved = resolve_conflict(\n                db, conflicts[0].id, "confirm",\n                "确认按业务备注的例外处理，提交安全审核",\n                "模型评测-小孟"\n            )\n            print(f"✓ 冲突 #{conflicts[0].id} 已确认")\n            print(f"  处理方式: {resolved.resolution}")\n            if sibling_resolved:\n                print(f"  自动关闭同待办其他冲突: {len(sibling_resolved)} 条")'

if old2 in content:
    content = content.replace(old2, new2)
    print('Fix 2 done: resolve_conflict return 1')
else:
    print('Fix 2 NOT applied: pattern not found')

old3 = '                resolved2 = resolve_conflict(\n                    db, conflicts[1].id, "reject",\n                    "按灰度批次降低脱敏级别，此条无需例外",\n                    "模型评测-小孟"\n                )\n                print(f"✓ 冲突 #{conflicts[1].id} 已驳回")\n                print(f"  处理方式: {resolved2.resolution}")'

new3 = '                resolved2, sibling_resolved2 = resolve_conflict(\n                    db, conflicts[1].id, "reject",\n                    "按灰度批次降低脱敏级别，此条无需例外",\n                    "模型评测-小孟"\n                )\n                print(f"✓ 冲突 #{conflicts[1].id} 已驳回")\n                print(f"  处理方式: {resolved2.resolution}")\n                if sibling_resolved2:\n                    print(f"  自动关闭同待办其他冲突: {len(sibling_resolved2)} 条")'

if old3 in content:
    content = content.replace(old3, new3)
    print('Fix 3 done: resolve_conflict return 2')
else:
    print('Fix 3 NOT applied: pattern not found')

with open('demo.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('demo.py updated')
