"""
偏差追溯模块
- 定位哪一行维修照片"拖偏了"结论（影响结论权重最大的照片行）
- 建立 归因结论 → 照片明细 → CSV原始行号 的追溯链
"""
import csv
import os
from datetime import datetime, timedelta
from collections import defaultdict

TRACE_FIELDS = [
    "attribution_id", "cabinet_id", "skew_photo_id", "skew_photo_row_in_csv",
    "skew_photo_source", "skew_reason", "impact_weight", "raw_csv_filename"
]

def _p(s):
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None

def load_csv(pth):
    with open(pth, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def build_photo_row_index(photos_csv_path):
    """
    返回 {photo_id: {"row_num": 行号(从2开始算,因为表头1), "source": 来源, "raw": 原始行}}
    报告里用 row_num 让阿敏能直接跳转到维修照片CSV的那一行
    """
    rows = load_csv(photos_csv_path)
    idx = {}
    for i, r in enumerate(rows):
        pid = r.get("photo_id", "").strip()
        if pid:
            idx[pid] = {
                "row_num": i + 2,
                "source": r.get("source", r.get("数据来源", "")),
                "raw": r,
                "csv_file": os.path.basename(photos_csv_path),
                "part_name": r.get("part_name", ""),
                "suggestion": r.get("suggestion", ""),
                "temperature": r.get("temperature", "")
            }
    return idx

def evaluate_photo_impact(photo_info, attribution_row, anomaly_start, anomaly_end):
    """
    给一张关联照片打"偏差影响权重"分：
    - 拍摄时间越接近异常开始前，权重越高（是诱因）
    - 处理意见是"待备件/需更换"权重高（说明有未解决问题）
    - 温度读数高权重高
    - 部位是散热风扇/电容（直接关联温升）权重高
    """
    w = 0.0
    reasons = []
    try:
        t_photo = _p(photo_info["raw"].get("shoot_time", ""))
        t_start = _p(anomaly_start)
        t_end = _p(anomaly_end)
        if t_photo and t_start:
            diff_h = (t_start - t_photo).total_seconds() / 3600.0
            if 0 <= diff_h <= 6:
                w += 40
                reasons.append(f"异常发生前{diff_h:.1f}h拍摄（紧邻异常窗口）")
            elif 6 < diff_h <= 24:
                w += 20
                reasons.append(f"异常发生前{diff_h:.1f}h拍摄")
            elif t_photo >= t_start and t_photo <= t_end:
                w += 30
                reasons.append("拍摄时间在异常持续区间内")
    except Exception:
        pass
    
    sug = (photo_info.get("suggestion") or photo_info["raw"].get("suggestion") or "").strip()
    if sug in ("待备件", "需更换"):
        w += 30
        reasons.append(f"处理意见='{sug}'，说明问题未闭环")
    elif sug == "观察运行":
        w += 10
        reasons.append(f"处理意见='{sug}'，问题可能延续")
    
    try:
        tv = float(photo_info.get("temperature") or photo_info["raw"].get("temperature") or 0)
        if tv >= 85:
            w += 20
            reasons.append(f"现场读数{tv}℃，属严重过热")
        elif tv >= 70:
            w += 10
            reasons.append(f"现场读数{tv}℃，已过阈值")
    except ValueError:
        pass
    
    pn = (photo_info.get("part_name") or photo_info["raw"].get("part_name") or "").strip()
    if pn in ("散热风扇", "电容柜"):
        w += 15
        reasons.append(f"部位='{pn}'，直接关联散热/发热")
    elif pn in ("母线排", "进线端子"):
        w += 8
        reasons.append(f"部位='{pn}'，属传导过热关联")
    
    return w, ";".join(reasons)

def run_trace(attribution_csv, normalized_photos_csv, output_csv):
    """
    对每条归因结论，找出"拖偏结论"（权重最高）的那张照片
    并记录它在CSV中的行号，方便阿敏直接打开CSV核对
    """
    attrs = load_csv(attribution_csv)
    photo_idx = build_photo_row_index(normalized_photos_csv)
    
    trace_rows = []
    for a in attrs:
        photo_ids = [p.strip() for p in (a.get("linked_photo_ids") or "").split(",") if p.strip()]
        best = None
        best_score = -1
        best_reason = ""
        for pid in photo_ids:
            if pid not in photo_idx:
                continue
            info = photo_idx[pid]
            score, reason = evaluate_photo_impact(
                info, a, a.get("anomaly_start", ""), a.get("anomaly_end", "")
            )
            if score > best_score:
                best_score = score
                best = (pid, info)
                best_reason = reason
        
        if best:
            pid, info = best
            trace_rows.append({
                "attribution_id": a.get("attribution_id", ""),
                "cabinet_id": a.get("cabinet_id", ""),
                "skew_photo_id": pid,
                "skew_photo_row_in_csv": info["row_num"],
                "skew_photo_source": info["source"],
                "skew_reason": best_reason,
                "impact_weight": best_score,
                "raw_csv_filename": info["csv_file"]
            })
    
    with open(output_csv, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=TRACE_FIELDS)
        w.writeheader()
        w.writerows(trace_rows)
    return trace_rows

def build_temp_trace_index(sampling_csv):
    """给阿敏从结论倒查CSV明细用：{cabinet_id+date: [行号列表]}"""
    rows = load_csv(sampling_csv)
    idx = defaultdict(list)
    for i, r in enumerate(rows):
        key = f"{r.get('cabinet_id','')}|{r.get('timestamp','')[:10]}"
        idx[key].append(i + 2)
    return idx

if __name__ == "__main__":
    tr = run_trace(
        "output/attribution_result.csv",
        "output/normalized_photos.csv",
        "output/skew_trace.csv"
    )
    print(f"生成追溯行: {len(tr)}")
    for t in tr[:3]:
        print(f"  {t['attribution_id']}: 照片{t['skew_photo_id']} @ CSV行{t['skew_photo_row_in_csv']} 权重{t['impact_weight']}")
