#!/usr/bin/env python3
import argparse
import csv
import os
import sys
from datetime import datetime
from typing import List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.coords import parse_coord
from src.bottles import detect_duplicates
from src.names import normalize_station_names, list_standard_names
from src.dataio import load_csv, export_csv, backup_file, diff_exports
from src.queue import QueueItem, add_items, read_queue, summary, ensure_queue_files, now_str

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
EXPORT_DIR = os.path.join(DATA_DIR, 'exports')
QUEUE_DIR = os.path.join(BASE_DIR, 'queue')
LOG_DIR = os.path.join(BASE_DIR, 'logs')


def _print_sep(char='=', width=72):
    print(char * width)


def _cmd_run(args):
    _print_sep()
    print(f" 潮汐能站异常预警 — 数据处理流水线")
    _print_sep('-')

    raw_file = args.input or os.path.join(RAW_DIR, 'station_readings.csv')
    export_file = os.path.join(EXPORT_DIR, 'cleaned_export.csv')
    coord_report = os.path.join(LOG_DIR, f"coord_format_report_{datetime.now().strftime('%Y%m%d')}.md")

    print(f"[1/6] 加载原始数据: {os.path.relpath(raw_file, BASE_DIR)}")
    if not os.path.exists(raw_file):
        print(f"  × 找不到原始数据文件: {raw_file}")
        print(f"  → 请先把现场导出的 CSV 放到 data/raw/ 目录")
        sys.exit(1)

    load_result = load_csv(raw_file)
    total_raw = load_result.total_raw - 1
    processed_count = len(load_result.records)
    skipped_count = len(load_result.skipped_rows)
    bad_count = len(load_result.bad_rows)

    print(f"  原始行数(不含表头): {total_raw}")
    print(f"  ├─ 已处理: {processed_count} 行")
    print(f"  ├─ 跳过行: {skipped_count} 行")
    if skipped_count > 0:
        for ln, reason in load_result.skipped_rows:
            print(f"  │   · 第{ln}行 — {reason}")
    print(f"  └─ 坏  行: {bad_count} 行")
    if bad_count > 0:
        for ln, reason in load_result.bad_rows:
            print(f"      · 第{ln}行 — {reason}")

    if processed_count == 0:
        print("\n  × 没有可处理的有效记录，流程终止")
        sys.exit(2)

    _print_sep('-')
    print(f"[2/6] 站点名称统一 (原始写法 → 标准名)")
    records, name_issues = normalize_station_names(load_result.records)
    alias_count = sum(1 for x in name_issues if x.confidence == 'ALIAS')
    fuzzy_count = sum(1 for x in name_issues if x.confidence == 'FUZZY')
    unknown_count = sum(1 for x in name_issues if x.confidence in ('UNKNOWN', 'NONE'))
    print(f"  别名自动替换: {alias_count} 条")
    print(f"  模糊匹配待确认: {fuzzy_count} 条")
    print(f"  未知/空名需补齐: {unknown_count} 条")
    for ni in name_issues:
        if ni.confidence == 'EXACT':
            continue
        tag = {
            'ALIAS': '  OK替换',
            'FUZZY': '  ?待确认',
            'UNKNOWN': '  !!未知',
            'NONE': '  !!缺失',
        }.get(ni.confidence, '  ?')
        print(f"{tag} 第{ni.row}行 [{ni.raw_name}] → [{ni.standard or '无法匹配'}] ({ni.note})")

    _print_sep('-')
    print(f"[3/6] 经纬度格式校验与统一写法")
    coord_issues_lines = []
    coord_format_map = {}
    lat_field = '纬度' if '纬度' in load_result.headers else '站点纬度'
    lon_field = '经度' if '经度' in load_result.headers else '站点经度'
    if lat_field not in load_result.headers or lon_field not in load_result.headers:
        lat_field, lon_field = '纬度', '经度'

    lat_format_counts = {}
    lon_format_counts = {}
    coord_bad = 0
    for i, rec in enumerate(records):
        ln = i + 2
        lat_raw = rec.get(lat_field, '')
        lon_raw = rec.get(lon_field, '')
        lat_r = parse_coord(lat_raw, 'lat')
        lon_r = parse_coord(lon_raw, 'lon')
        if lat_r.is_valid:
            rec['纬度(统一格式)'] = lat_r.normalized
            lat_format_counts[lat_r.source_format] = lat_format_counts.get(lat_r.source_format, 0) + 1
        else:
            coord_bad += 1
            coord_issues_lines.append((ln, '纬度', lat_raw, lat_r.issue))
        if lon_r.is_valid:
            rec['经度(统一格式)'] = lon_r.normalized
            lon_format_counts[lon_r.source_format] = lon_format_counts.get(lon_r.source_format, 0) + 1
        else:
            coord_bad += 1
            coord_issues_lines.append((ln, '经度', lon_raw, lon_r.issue))

    def _fmt_counts(d):
        return ', '.join(f"{k}:{v}" for k, v in sorted(d.items())) or '无'

    print(f"  纬度写法分布: {_fmt_counts(lat_format_counts)}")
    print(f"  经度写法分布: {_fmt_counts(lon_format_counts)}")
    print(f"  解析失败坐标: {coord_bad} 个")
    for ln, kind, raw, issue in coord_issues_lines:
        print(f"  !! 第{ln}行 {kind}=[{raw}] — {issue}")

    with open(coord_report, 'w', encoding='utf-8') as f:
        f.write(f"# 经纬度格式统一报告 ({datetime.now().strftime('%Y-%m-%d')})\n\n")
        f.write("值班员小宋对照遥感截图时可直接参考下面的对应关系：\n\n")
        f.write("| 行号 | 原始纬度 | 原始经度 | 统一后纬度 | 统一后经度 | 备注 |\n")
        f.write("|---|---|---|---|---|---|\n")
        for i, rec in enumerate(records):
            ln = i + 2
            lat_n = rec.get('纬度(统一格式)', '')
            lon_n = rec.get('经度(统一格式)', '')
            note = ''
            for cln, ck, crw, cis in coord_issues_lines:
                if cln == ln:
                    note = f"{ck}:{cis}"
                    break
            f.write(f"| {ln} | {rec.get(lat_field, '')} | {rec.get(lon_field, '')} | {lat_n} | {lon_n} | {note} |\n")
        f.write("\n## 写法分布\n")
        f.write(f"- 纬度: {_fmt_counts(lat_format_counts)}\n")
        f.write(f"- 经度: {_fmt_counts(lon_format_counts)}\n")
    print(f"  → 详细对照表已写入 logs/{os.path.basename(coord_report)}")

    _print_sep('-')
    print(f"[4/6] 采样瓶编号重复检测")
    dups = detect_duplicates(records)
    print(f"  发现重复瓶号: {len(dups)} 组")
    for dp in dups:
        print(f"  ※ 瓶号 [{dp.bottle_id}] 出现 {len(dp.rows)} 次 (行号: {', '.join(map(str, dp.rows))})")
        print(f"    影响范围: {dp.impact_scope}")
        print(f"    收尾建议: {dp.cleanup_suggestion}")
        for ts, val in dp.value_pairs:
            print(f"      · {ts} → {val}")

    _print_sep('-')
    print(f"[5/6] 生成异常队列 (写入 queue/ 目录)")
    ensure_queue_files(QUEUE_DIR)
    qitems: List[QueueItem] = []
    for ln, kind, raw, issue in coord_issues_lines:
        qitems.append(QueueItem(
            queue_type='coord', level='高', row_no=ln,
            category=f'{kind}格式异常',
            detail=f"原始值「{raw}」—— {issue}",
            suggestion='对照遥感截图上的坐标标注，核对采样日志中的原始记录，再重新录入',
            created_at=now_str(),
            can_release=False,
            materials_missing='需提供遥感截图原件的拍摄时间戳'
        ))
    for ni in name_issues:
        if ni.confidence == 'EXACT':
            continue
        qitems.append(QueueItem(
            queue_type='name',
            level='中' if ni.confidence in ('ALIAS', 'FUZZY') else '高',
            row_no=ni.row,
            category='站点名称不一致',
            detail=f"原始「{ni.raw_name}」→ 匹配「{ni.standard or '无'}」({ni.note})",
            suggestion='查现场交接单第2页"站点名称对照表"，确认后在导出文件中修改为标准名',
            created_at=now_str(),
            can_release=(ni.confidence == 'ALIAS'),
            materials_missing='无' if ni.confidence == 'ALIAS' else '需补充现场照片或手写记录表扫描件',
            handover_note='自动别名替换的已放行，模糊和未知的需小宋确认后签字'
        ))
    for dp in dups:
        qitems.append(QueueItem(
            queue_type='bottle', level='高', row_no=dp.rows[0],
            category='采样瓶重复',
            detail=f"瓶号「{dp.bottle_id}」涉及行 {dp.rows}，{dp.impact_scope}",
            suggestion=dp.cleanup_suggestion,
            created_at=now_str(),
            can_release=False,
            materials_missing='需要原始采样记录单及仪器导出日志'
        ))
    for ln, reason in load_result.bad_rows:
        qitems.append(QueueItem(
            queue_type='data', level='高', row_no=ln,
            category='坏行(结构异常)',
            detail=reason,
            suggestion='检查原始CSV是否被Excel截断或被编辑过字符编码',
            created_at=now_str(),
            can_release=False,
            materials_missing='需重新导出原始数据'
        ))
    add_items(QUEUE_DIR, qitems)
    s = summary(QUEUE_DIR)
    print(f"  队列总数: {s['total']} 条 | 待处理: {s['pending']} | 可放行: {s['can_release']} | 缺材料: {s['missing']}")

    _print_sep('-')
    print(f"[6/6] 导出清洗结果 (写入 data/exports/)")
    old_exists = os.path.exists(export_file)
    bak = backup_file(export_file)
    if bak:
        print(f"  旧文件已备份: data/backups/{os.path.basename(bak)}")
    headers_out = list(load_result.headers)
    if '纬度(统一格式)' not in headers_out and lat_field in headers_out:
        idx = headers_out.index(lat_field) + 1
        headers_out.insert(idx, '纬度(统一格式)')
    if '经度(统一格式)' not in headers_out and lon_field in headers_out:
        idx = headers_out.index(lon_field) + 1
        headers_out.insert(idx, '经度(统一格式)')
    export_csv(export_file, records, headers_out)

    if args.append_note:
        diff = diff_exports(bak if bak else '', records, headers_out)
        diff_log = os.path.join(LOG_DIR, f"diff_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md")
        with open(diff_log, 'w', encoding='utf-8') as f:
            f.write(f"# 本次补录备注: {args.append_note}\n\n")
            f.write(f"补录时间: {now_str()}\n")
            f.write(f"操作人员: {os.environ.get('USER', '值班员')}\n\n")
            f.write("## 对导出文件的变更\n\n")
            if not old_exists:
                f.write("首次导出，无旧版本可比较，全部记录为新增。\n")
            else:
                f.write(f"- 新增行数: {len(diff.added_rows)}\n")
                f.write(f"- 删除行数: {len(diff.removed_rows)}\n")
                f.write(f"- 修改单元格: {len(diff.modified_cells)} 处\n\n")
                if diff.modified_cells:
                    f.write("### 修改明细\n\n")
                    f.write("| 行号 | 字段 | 原值 | 新值 |\n|---|---|---|---|\n")
                    for rn, field, ov, nv in diff.modified_cells:
                        f.write(f"| {rn} | {field} | {ov} | {nv} |\n")
        print(f"  补录变更追踪已写入: logs/{os.path.basename(diff_log)}")
    print(f"  → 导出文件: data/exports/{os.path.basename(export_file)} ({len(records)} 行)")

    _print_sep()
    print(f" 处理完成。下一步请执行: python tidal_warning.py status")
    print(f" 或查看 queue/ 目录下的异常队列 CSV")
    _print_sep()


def _cmd_status(args):
    ensure_queue_files(QUEUE_DIR)
    s = summary(QUEUE_DIR)
    _print_sep()
    print(f" 潮汐能站异常预警 — 交接状态看板")
    _print_sep('-')
    print(f" 总条目 : {s['total']}")
    print(f" 待处理 : {s['pending']}")
    print(f" 可放行 : {s['can_release']}")
    print(f" 缺材料 : {s['missing']}")
    _print_sep('-')

    type_labels = {
        'coord': ('经纬度格式', '异常队列-经纬度格式.csv'),
        'name': ('站点名称', '异常队列-站点名称.csv'),
        'bottle': ('采样瓶重复', '异常队列-采样瓶重复.csv'),
        'data': ('数据质量', '异常队列-数据质量.csv'),
        'general': ('待补充材料', '异常队列-待补充材料.csv'),
    }

    all_q = read_queue(QUEUE_DIR)
    for qtype, qdata in all_q.items():
        label, fname = type_labels.get(qtype, (qtype, ''))
        stat = s['by_type'].get(qtype, {})
        print(f"\n ▌ {label} (queue/{fname})")
        print(f"   共{stat.get('total',0)}条 | 待处理{stat.get('pending',0)} | 可放行{stat.get('can_release',0)} | 缺材料{stat.get('missing',0)}")
        if not qdata:
            print("   (暂无条目)")
            continue
        for it in qdata:
            mark = '✓' if it.get('放行标记') == '是' else ('⚠' if it.get('缺材料说明') and it.get('缺材料说明').strip() not in ['','无'] else '○')
            print(f"   {mark} 第{it.get('行号','?')}行 [{it.get('级别','?')}] {it.get('分类','')}")
            print(f"     详情: {it.get('详情','')}")
            print(f"     建议: {it.get('处理建议','')}")
            if it.get('放行标记') == '是':
                print(f"     → 已标记可放行，交接时无需再核对")
            if it.get('缺材料说明') and it.get('缺材料说明').strip() not in ['','无']:
                print(f"     → 还缺: {it.get('缺材料说明')}")
            if it.get('交接备注'):
                print(f"     → 备注: {it.get('交接备注')}")

    _print_sep('-')
    print(f" 可放行的 {s['can_release']} 条：已由系统自动核对，可直接归档。")
    print(f" 缺材料的 {s['missing']} 条：请先联系现场补齐，再补录后重跑。")
    print(f" 其余 {s['pending'] - s['missing']} 条：需小宋对照现场记录人工确认。")
    _print_sep()


def _cmd_list_stations(args):
    print("标准站点名称（别名 → 标准名）：")
    from src.names import STANDARD_NAMES
    for std, aliases in STANDARD_NAMES.items():
        print(f"  ★ {std}")
        for a in aliases:
            if a != std:
                print(f"    ↳ {a}")


def main():
    parser = argparse.ArgumentParser(
        prog='tidal-warning',
        description='潮汐能站异常预警：值班员小宋专用数据处理流水线'
    )
    sub = parser.add_subparsers(dest='command', required=True)

    p_run = sub.add_parser('run', help='运行完整处理流程')
    p_run.add_argument('-i', '--input', help='原始CSV文件路径（默认 data/raw/station_readings.csv）')
    p_run.add_argument('--append-note', help='本次处理的备注说明，用于追踪补录引起的导出变更')
    p_run.set_defaults(func=_cmd_run)

    p_stat = sub.add_parser('status', help='查看交接状态看板（放行/缺材料/待确认）')
    p_stat.set_defaults(func=_cmd_status)

    p_stat = sub.add_parser('stations', help='列出标准站点名与别名对照')
    p_stat.set_defaults(func=_cmd_list_stations)

    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
