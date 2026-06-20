import json
d = json.load(open('/tmp/export.json'))
print('exportedAt:', d.get('exportedAt'))
print('summary:', json.dumps(d.get('summary'), ensure_ascii=False, indent=2))
print('workorders:', len(d.get('workorders', [])), '条')
print('abnormalRecords:', len(d.get('abnormalRecords', [])), '条')
print('duplicatesMerged:', len(d.get('duplicatesMerged', [])), '条')
if d.get('duplicatesMerged'):
    for dup in d['duplicatesMerged']:
        print('  -', dup['workorderId'], dup['dedupHash'], '提交次数:', dup['submitCount'], '说明:', dup.get('note'))
print('timelineFull:', len(d.get('timelineFull', [])), '个节点')
print('最新 5 个 timeline:', [(t['type'], t['title'][:20]) for t in d.get('timelineFull', [])[-5:]])
