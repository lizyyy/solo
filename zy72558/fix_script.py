import ast

with open('verify_3source_consistency.py', 'r') as f:
    lines = f.readlines()

corrections = {
    48: '    snap_header = session.execute(select(FeatureSnapshot).filter(FeatureSnapshot.snapshot_id == snap_id).order_by(FeatureSnapshot.imported_at.asc())).scalars().first()\n',
    49: '    runs = sorted(session.execute(select(ClusteringRun).order_by(ClusteringRun.id)).scalars().all(), key=lambda r: r.id)\n',
    50: '    ver = session.execute(select(FeatureVersion).order_by(FeatureVersion.created_at.desc())).scalars().first()\n',
    51: '    audits = list(session.execute(select(AuditLog)).scalars().all())\n',
    53: '    export_records = list(session.execute(select(ExportRecord)).scalars().all())\n',
    73: '    check(len([a for a in audits if a.snapshot_id == snap_id]) >= 8, "按快照维度查到全链路留痕")\n',
    124: '        db_pending = [r for r in runs if r.review_status == ReviewStatus.PENDING_REVIEW.value]\n',
    182: '        names = [f"{c}-{names_from_disp[c]}" for c in sorted(names_from_disp)]\n',
    183: '        print("  簇命名结果:   " + ", ".join(names))\n',
}

for lineno, new_content in corrections.items():
    lines[lineno - 1] = new_content

with open('verify_3source_consistency.py', 'w') as f:
    f.writelines(lines)

print("Fixed syntax errors. Verifying...")
with open('verify_3source_consistency.py', 'r') as f:
    content = f.read()
try:
    ast.parse(content)
    print("SUCCESS: No syntax errors!")
except SyntaxError as e:
    print(f"STILL HAS ERROR at line {e.lineno}: {e.msg}")
    if e.lineno <= len(lines):
        print(f"  Line content: {lines[e.lineno-1].rstrip()}")
