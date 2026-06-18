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


def _queue_path(queue_dir: str, qtype: str) -> str:
    fname = QUEUE_FILES.get(qtype, QUEUE_FILES['general'])
    return os.path.join(queue_dir, fname)


def ensure_queue_files(queue_dir: str) -> None:
    os.makedirs(queue_dir, exist_ok=True)
    headers = ['队列类型', '级别', '行号', '分类', '详情', '处理建议', '创建时间', '状态', '处理人', '处理时间', '放行标记', '缺材料说明', '交接备注']
    for fname in QUEUE_FILES.values():
        fp = os.path.join(queue_dir, fname)
        if not os.path.exists(fp):
            with open(fp, 'w', encoding='utf-8-sig', newline='') as f:
                w = csv.writer(f)
                w.writerow(headers)


def add_items(queue_dir: str, items: List[QueueItem]) -> None:
    ensure_queue_files(queue_dir)
    grouped: Dict[str, List[QueueItem]] = {}
    for it in items:
        grouped.setdefault(it.queue_type, []).append(it)
    for qtype, its in grouped.items():
        fp = _queue_path(queue_dir, qtype)
        with open(fp, 'a', encoding='utf-8-sig', newline='') as f:
            w = csv.writer(f)
            for it in its:
                w.writerow([
                    it.queue_type, it.level, it.row_no, it.category, it.detail,
                    it.suggestion, it.created_at, it.status, it.assigned_to,
                    it.handled_at, '是' if it.can_release else '否',
                    it.materials_missing, it.handover_note
                ])


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
