from storage import load_records

for r in load_records('e90a807afae5'):
    if r.part_id == 'HD-001':
        print('=' * 60)
        print('测试1：只改日期，不改状态 → 状态应保持优先排产')
        print('=' * 60)
        print(f'当前状态: {r.status}')
        print(f'排程日期: {r.scheduled_date}')
        print(f'数量: {r.quantity}')
        print(f'审计日志总数: {len(r.audit_log)}')
        print()
        
        print('所有审计记录：')
        for i, a in enumerate(r.audit_log):
            print(f'  [{i+1}] {a["timestamp"][5:16]}  {a["operator"]}  改{a["field"]}')
            print(f'       旧值: {a["old_value"]}')
            print(f'       新值: {a["new_value"]}')
            print(f'       原因: {a["reason"][:50]}...')
            print()
        
        status_audits = [a for a in r.audit_log if a['field'] == 'status']
        date_audits = [a for a in r.audit_log if a['field'] == 'scheduled_date']
        print(f'状态变更数: {len(status_audits)} (预期: 0)')
        print(f'日期变更数: {len(date_audits)} (预期: >=2)')
        print()
        
        latest = r.audit_log[-1]
        if latest['field'] == 'scheduled_date' and r.status == '优先排产' and len(status_audits) == 0:
            print('✅ 测试1通过：只改日期，状态保持优先排产，审计无状态误记录')
        else:
            print('❌ 测试1失败')
