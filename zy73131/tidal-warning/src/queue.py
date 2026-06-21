import csv
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Dict, Optional


@dataclass
class QueueItem:
    queue_type: str
    level: str
    row_no: int
    category: str
    detail: str
    suggestion: str
    created_at: str
    source_file: str = ''
    status: str = '待处理'
    assigned_to: str = '小宋'
    handled_at: str = ''
    handover_note: str = ''
    can_release: bool = False
    materials_missing: str = ''


QUEUE_FILES = {
    'coord': '异常队列-经纬度格式.csv',
    'name': '异常队列-站点名称.csv',
    'bottle': '异常队列-采样瓶重复.csv',
    'data': '异常队列-数据质量.csv',
    'general': '异常队列-待补充材料.csv',
}

QUEUE_HEADERS = ['队列类型', '级别', '行号', '分类', '详情', '处理建议', '来源文件',
                '创建时间', '状态', '处理人', '处理时间', '放行标记', '缺材料说明', '交接备注']


def _queue_path(queue_dir: str, qtype: str) -> str:
    fname = QUEUE_FILES.get(qtype, QUEUE_FILES['general'])
    return os.path.join(queue_dir, fname)


def ensure_queue_files(queue_dir: str) -> None:
    os.makedirs(queue_dir, exist_ok=True)
    for fname in QUEUE_FILES.values():
        fp = os.path.join(queue_dir, fname)
        if not os.path.exists(fp):
            with open(fp, 'w', encoding='utf-8-sig', newline='') as f:
                w = csv.writer(f)
                w.writerow(QUEUE_HEADERS)


def _item_to_row(it: QueueItem) -> List:
    return [
        it.queue_type, it.level, it.row_no, it.category, it.detail,
        it.suggestion, it.source_file, it.created_at, it.status, it.assigned_to,
        it.handled_at, '是' if it.can_release else '否',
        it.materials_missing, it.handover_note
    ]


def _write_rows(fp: str, rows: List[List]) -> None:
    with open(fp, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(QUEUE_HEADERS)
        for r in rows:
            w.writerow(r)


def reset_and_write_items(queue_dir: str, items: List[QueueItem], source_file: str) -> None:
    """针对本次 source_file 重新计算并写入队列，保证幂等。

    策略：
    1. 读取已有队列，检查列头是否含「来源文件」字段。
       若不含，说明是旧格式队列，整份清空重写（旧格式无法区分批次）。
    2. 若含「来源文件」字段，保留来源不同的条目（来自其他批次的异常），
       清空本次 source_file 对应的旧条目。
    3. 写入本次新生成的条目。
    4. 同类型队列按行号排序，输出稳定。
    """
    ensure_queue_files(queue_dir)
    source_key = os.path.basename(source_file)
    grouped: Dict[str, List[QueueItem]] = {}
    for it in items:
        it.source_file = source_key
        grouped.setdefault(it.queue_type, []).append(it)

    for qtype in QUEUE_FILES.keys():
        fp = _queue_path(queue_dir, qtype)
        preserved = []
        has_source_col = False
        if os.path.exists(fp):
            with open(fp, 'r', encoding='utf-8-sig', newline='') as f:
                reader = csv.reader(f)
                header = next(reader, [])
                has_source_col = '来源文件' in header
                if has_source_col:
                    source_idx = header.index('来源文件')
                    for row in reader:
                        if len(row) > source_idx and row[source_idx] != source_key:
                            while len(row) < len(QUEUE_HEADERS):
                                row.append('')
                            preserved.append(row[:len(QUEUE_HEADERS)])
                # 旧格式（无来源文件列）：全部清空不保留

        new_rows = []
        for it in sorted(grouped.get(qtype, []), key=lambda x: (x.row_no, x.category)):
            new_rows.append(_item_to_row(it))

        combined = preserved + new_rows
        _write_rows(fp, combined)


def add_items(queue_dir: str, items: List[QueueItem]) -> None:
    """保留原函数作为兼容接口（一般不直接用，建议用 reset_and_write_items）"""
    ensure_queue_files(queue_dir)
    grouped: Dict[str, List[QueueItem]] = {}
    for it in items:
        grouped.setdefault(it.queue_type, []).append(it)
    for qtype, its in grouped.items():
        fp = _queue_path(queue_dir, qtype)
        with open(fp, 'a', encoding='utf-8-sig', newline='') as f:
            w = csv.writer(f)
            for it in its:
                w.writerow(_item_to_row(it))


def read_queue(queue_dir: str, qtype: Optional[str] = None) -> Dict[str, List[dict]]:
    result = {}
    types = [qtype] if qtype else list(QUEUE_FILES.keys())
    for t in types:
        fp = _queue_path(queue_dir, t)
        items = []
        if os.path.exists(fp):
            with open(fp, 'r', encoding='utf-8-sig', newline='') as f:
                reader = csv.DictReader(f)
                for r in reader:
                    items.append(dict(r))
        result[t] = items
    return result


def summary(queue_dir: str) -> dict:
    ensure_queue_files(queue_dir)
    all_items = read_queue(queue_dir)
    total = 0
    pending = 0
    can_release = 0
    missing = 0
    by_type = {}
    for t, items in all_items.items():
        by_type[t] = {
            'total': len(items),
            'pending': sum(1 for i in items if i.get('状态') == '待处理'),
            'can_release': sum(1 for i in items if i.get('放行标记') == '是'),
            'missing': sum(1 for i in items if i.get('缺材料说明') and i.get('缺材料说明').strip() not in ['无', '']),
        }
        total += len(items)
        pending += by_type[t]['pending']
        can_release += by_type[t]['can_release']
        missing += by_type[t]['missing']
    return {
        'total': total,
        'pending': pending,
        'can_release': can_release,
        'missing': missing,
        'by_type': by_type,
    }


def now_str() -> str:
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
