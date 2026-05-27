import pathlib
p = pathlib.Path('app/main.py')
L = p.read_text().splitlines()
NL = []
for line in L:
    NL.append(line)
    if line.startswith('def log_state(db'):
        NL.insert(len(NL)-1, '')
        NL.insert(len(NL)-1, "def log_cat(db, t, s, aid, reason, old, new):")
        NL.insert(len(NL)-1, "    l = ChangeLog(task_id=t.id, submission_id=s.id, actor_id=aid, change_type='category', reason=reason, before_value={'category':old}, after_value={'category':new})")
        NL.insert(len(NL)-1, '    db.add(l); db.flush(); return l')
p.write_text(chr(10).join(NL))
