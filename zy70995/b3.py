import pathlib
p = pathlib.Path('app/main.py')
L = p.read_text().splitlines()
L.append('')
L.append('def log_state(db, t, s, aid, reason, old, new):')
L.append("    l = ChangeLog(task_id=t.id, submission_id=s.id, actor_id=aid, change_type='state', reason=reason, before_value={'state':old}, after_value={'state':new})")
L.append('    db.add(l); db.flush(); return l')
L.append('')
p.write_text(chr(10).join(L))
