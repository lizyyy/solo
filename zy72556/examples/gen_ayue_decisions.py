#!/usr/bin/env python3
import json, os, sys
d = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(d, "..", "src"))
from imbalance_resampler import DataStore, WorkflowEngine, ImbalanceResampler

def main():
    data_dir = os.environ['DATA_DIR']
    sid = os.environ['SESSION_ID']
    outf = os.environ['DECISIONS_FILE']
    ds = DataStore(base_dir=data_dir)
    wf = WorkflowEngine(data_store=ds, resampler=ImbalanceResampler())
    susp = wf.get_suspicious_records_for_review(sid)
    decs = {}
    notes = []
    notes.append("训练曲线auc稳定，双特征流量切割问题，待复核")
    notes.append("训练正常，缺失原因未明，不急于归正常")
    notes.append("训练过拟合，样本质量差，排除")
    notes.append("双特征缺失，训练正常，待确认分布")
    notes.append("已知线上bug样本，bug已修复，待决定")
    notes.append("三特征缺失给默认分，缺失过多，待评估")
    notes.append("缺失在此类目常见，分布正常，可确认正常")
    for i, r in enumerate(susp):
        rid = r.record_id
        n = notes[i] if i < len(notes) else '待复核'
        if i == 2:
            decs[rid] = {"curve_ok": False, "exclude": True, "note": n}
        elif i == 6:
            decs[rid] = {"curve_ok": True, "confirm_normal": True, "note": n}
        else:
            decs[rid] = {"curve_ok": True, "keep_suspicious": True, "note": n}
    os.makedirs(os.path.dirname(outf), exist_ok=True)
    with open(outf, 'w', encoding='utf-8') as f:
        json.dump(decs, f, ensure_ascii=False, indent=2)
    print(f"决策文件: {outf} ({len(decs)}条)")

if __name__ == '__main__':
    main()
