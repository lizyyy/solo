from collections import defaultdict
from dataclasses import dataclass, field
from typing import List, Dict, Set, Tuple


@dataclass
class BottleDupReport:
    bottle_id: str
    rows: List[int]
    stations: Set[str] = field(default_factory=set)
    timestamps: List[str] = field(default_factory=list)
    values_diff: bool = False
    value_pairs: List[Tuple[str, str]] = field(default_factory=list)
    impact_scope: str = ''
    cleanup_suggestion: str = ''


def detect_duplicates(records: List[dict], bottle_field: str = '采样瓶编号', line_field: str = '_original_line') -> List[BottleDupReport]:
    groups: Dict[str, List[int]] = defaultdict(list)
    for rec in records:
        bid = str(rec.get(bottle_field, '')).strip()
        if bid and bid not in ['-', '无', 'N/A', '缺失']:
            ln = rec.get(line_field)
            if ln is None:
                ln = -1
            groups[bid].append(int(ln))

    reports = []
    for bid, lines in groups.items():
        if len(lines) < 2:
            continue
        sorted_lines = sorted(lines)
        stations = set()
        timestamps = []
        values = []
        line_to_rec = {int(rec.get(line_field, -1)): rec for rec in records if rec.get(line_field) is not None}
        for ln in sorted_lines:
            rec = line_to_rec.get(ln, {})
            stations.add(str(rec.get('站点名称', '未知站点')).strip())
            ts = f"{rec.get('采样日期', '')} {rec.get('采样时间', '')}".strip()
            timestamps.append(ts if ts.strip() else f'第{ln}行(无时间)')
            val = f"{rec.get('流速(m/s)', '')}|{rec.get('潮高(m)', '')}|{rec.get('水温(℃)', '')}"
            values.append(val)

        values_diff = len(set(values)) > 1
        value_pairs = [(timestamps[k], values[k]) for k in range(len(sorted_lines))]

        if len(stations) > 1:
            scope = f"跨{len(stations)}个站点 ({', '.join(sorted(stations))})，可能站点记录串瓶"
            cleanup = "建议核对现场采样单，确认哪条记录归属哪个站点，错误记录整行删除或更正采样瓶号"
        elif values_diff:
            scope = f"同站点 {next(iter(stations))} 同一瓶号出现{len(sorted_lines)}组数值不一致"
            cleanup = "建议对照原始手写记录与仪器导出日志，保留正确那一条，其余标记为作废不入库"
        else:
            scope = f"同站点数值完全一致，共{len(sorted_lines)}条，疑似重复录入"
            cleanup = "建议删除重复行，保留行号最小的一条，其余备份后清理"

        reports.append(BottleDupReport(
            bottle_id=bid,
            rows=sorted_lines,
            stations=stations,
            timestamps=timestamps,
            values_diff=values_diff,
            value_pairs=value_pairs,
            impact_scope=scope,
            cleanup_suggestion=cleanup
        ))
    return reports
