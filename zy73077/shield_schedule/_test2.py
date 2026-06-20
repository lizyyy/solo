from storage import load_records

for r in load_records('e90a807afae5'):
    if r.part_id == 'HD-001':
        print('=' * 60)
        print('测试2：单独修改状态 → 状态变更被正确记录')
        print('=' * 60)
        print(f'当前状态: {r.status}')
        print(f'排程日期: {r.scheduled_date}')
        print(f'数量: {r.quantity}')
        print(f'审计日志总数: {len(r.audit_log)}')
        print()
        
        print('最新2条审计记录：')
        for i, a in enumerate(r.audit_log[-2:], start=len(r.audit_log)-1):
            print(f'  [{i+1}] {a["timestamp"][5:16]}  {a["operator"]}  改{a["field"]}')
            print(f'       旧值: {a["old_value"]}')
            print(f'       新值: {a["new_value"]}')
            print(f'       原因: {a["reason"][:60]}...')
            print()
        
        status_audits = [a for a in r.audit_log if a['field'] == 'status']
        print(f'状态变更数: {len(status_audits)} (预期: 1)')
        
        ok = (r.status == '已完成' 
              and r.scheduled_date == '2026-06-13' 
              and r.quantity == 4
              and len(status_audits) == 1
              and status_audits[0]['old_value'] == '优先排产'
              and status_audits[0]['new_value'] == '已完成')
        
        if ok:
            print('✅ 测试2通过：状态从优先排产→已完成被正确记录，日期数量保持不变')
        else:
            print('❌ 测试2失败')
