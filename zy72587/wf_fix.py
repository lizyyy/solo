lines = open('app/workflow.py').readlines()
print('total lines:', len(lines))
insert_pos = 248  # after line 248 (0-indexed), before for conflict loop
insert_code = [
    '        parts = record_id.split(chr(58))
',
    '        if len(parts) >= 2:
',
    '            target_sample_id = parts[0]
',
    '            target_feature_id = chr(58).join(parts[1:])
',
    '        else:
',
    '            target_sample_id = record_id
',
    '            target_feature_id = None
',
    '
',
    '        matched_conflict = None
',
]
lines2 = lines[:insert_pos] + insert_code + lines[insert_pos:]
print('after insert 1:', len(lines2))
