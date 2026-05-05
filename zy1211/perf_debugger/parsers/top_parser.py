"""Parser for top/htop output."""

import re
from datetime import datetime, timedelta
from typing import Dict, List, Any

from ..database import Metric, Record


def parse_top(db, sample, raw_content: str) -> Dict[str, Any]:
    """Parse top or htop output.
    
    top output format:
    top - 10:30:00 up 5 days,  2:15,  2 users,  load average: 0.10, 0.05, 0.02
    Tasks: 256 total,   1 running, 255 sleeping,   0 stopped,   0 zombie
    %Cpu(s):  5.2 us,  2.1 sy,  0.0 ni, 92.5 id,  0.0 wa,  0.0 hi,  0.2 si,  0.0 st
    MiB Mem :  15867.3 total,   5234.5 free,   4521.3 used,   6111.5 buff/cache
    MiB Swap:   8192.0 total,   8192.0 free,      0.0 used.  10890.3 avail Mem
    
        PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
       1234 root      20   0 1234567 89012  45678 R  95.2   0.5   1:23.45 python
    """
    lines = raw_content.split('\n')
    
    all_metrics = []
    all_records = []
    
    min_time = None
    max_time = None
    
    current_time = None
    snapshot_index = 0
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        if line.startswith('top -'):
            time_match = re.search(r'top - (\d{1,2}:\d{2}:\d{2})', line)
            if time_match:
                time_str = time_match.group(1)
                current_time = datetime.now().replace(
                    hour=int(time_str.split(':')[0]),
                    minute=int(time_str.split(':')[1]),
                    second=int(time_str.split(':')[2]),
                    microsecond=0
                )
                if min_time is None or current_time < min_time:
                    min_time = current_time
                if max_time is None or current_time > max_time:
                    max_time = current_time
            
            load_match = re.search(r'load average: ([\d.]+), ([\d.]+), ([\d.]+)', line)
            if load_match and current_time:
                for name, idx in [('load_1min', 1), ('load_5min', 2), ('load_15min', 3)]:
                    try:
                        value = float(load_match.group(idx))
                        all_metrics.append(Metric(
                            sample_id=sample.id,
                            timestamp=current_time,
                            category='cpu',
                            metric_name=name,
                            value=value,
                            unit='',
                            raw_text=line
                        ))
                    except (ValueError, IndexError):
                        pass
            snapshot_index += 1
        
        elif line.startswith('Tasks:') and current_time:
            tasks_match = re.search(
                r'Tasks:\s+(\d+)\s+total,\s+(\d+)\s+running,\s+(\d+)\s+sleeping,\s+(\d+)\s+stopped,\s+(\d+)\s+zombie',
                line
            )
            if tasks_match:
                for name, idx in [
                    ('tasks_total', 1),
                    ('tasks_running', 2),
                    ('tasks_sleeping', 3),
                    ('tasks_stopped', 4),
                    ('tasks_zombie', 5)
                ]:
                    try:
                        value = int(tasks_match.group(idx))
                        all_metrics.append(Metric(
                            sample_id=sample.id,
                            timestamp=current_time,
                            category='process',
                            metric_name=name,
                            value=float(value),
                            unit='',
                            raw_text=line
                        ))
                    except (ValueError, IndexError):
                        pass
        
        elif line.startswith('%Cpu(s):') and current_time:
            cpu_match = re.search(
                r'%Cpu\(s\):\s+([\d.]+)\s+us,\s+([\d.]+)\s+sy,\s+([\d.]+)\s+ni,\s+([\d.]+)\s+id,\s+([\d.]+)\s+wa,\s+([\d.]+)\s+hi,\s+([\d.]+)\s+si,\s+([\d.]+)\s+st',
                line
            )
            if cpu_match:
                cpu_metrics = [
                    ('cpu_user', 1),
                    ('cpu_system', 2),
                    ('cpu_nice', 3),
                    ('cpu_idle', 4),
                    ('cpu_iowait', 5),
                    ('cpu_hardirq', 6),
                    ('cpu_softirq', 7),
                    ('cpu_steal', 8)
                ]
                for name, idx in cpu_metrics:
                    try:
                        value = float(cpu_match.group(idx))
                        all_metrics.append(Metric(
                            sample_id=sample.id,
                            timestamp=current_time,
                            category='cpu',
                            metric_name=name,
                            value=value,
                            unit='%',
                            raw_text=line
                        ))
                    except (ValueError, IndexError):
                        pass
        
        elif ('Mem' in line or 'Swap' in line) and ':' in line and current_time:
            mem_types = ['Mem', 'Swap', 'KiB Mem', 'MiB Mem', 'GiB Mem']
            for mem_type in mem_types:
                if mem_type in line:
                    mem_match = re.search(
                        r'(?:KiB|MiB|GiB)?\s*Mem|Swap\s*:\s+([\d.]+)\s+total,\s+([\d.]+)\s+free,\s+([\d.]+)\s+used',
                        line
                    )
                    if mem_match:
                        prefix = 'mem' if 'Mem' in line else 'swap'
                        unit = 'MiB' if 'MiB' in line else 'KiB'
                        for suffix, idx in [('total', 1), ('free', 2), ('used', 3)]:
                            try:
                                value = float(mem_match.group(idx))
                                all_metrics.append(Metric(
                                    sample_id=sample.id,
                                    timestamp=current_time,
                                    category='memory',
                                    metric_name=f'{prefix}_{suffix}',
                                    value=value,
                                    unit=unit,
                                    raw_text=line
                                ))
                            except (ValueError, IndexError):
                                pass
                    break
        
        elif line and not line.startswith('%') and not line.startswith('PID') and current_time:
            parts = line.split()
            if len(parts) >= 12 and parts[0].isdigit():
                try:
                    pid = int(parts[0])
                    cpu_pct = float(parts[8].replace(',', '.'))
                    mem_pct = float(parts[9].replace(',', '.'))
                    command = ' '.join(parts[11:])
                    
                    all_metrics.append(Metric(
                        sample_id=sample.id,
                        timestamp=current_time,
                        category='process',
                        metric_name='process_cpu',
                        value=cpu_pct,
                        unit='%',
                        process_name=command,
                        process_pid=pid,
                        raw_text=line
                    ))
                    all_metrics.append(Metric(
                        sample_id=sample.id,
                        timestamp=current_time,
                        category='process',
                        metric_name='process_mem',
                        value=mem_pct,
                        unit='%',
                        process_name=command,
                        process_pid=pid,
                        raw_text=line
                    ))
                    
                    all_records.append(Record(
                        sample_id=sample.id,
                        timestamp=current_time,
                        record_type='process',
                        raw_data=line
                    ))
                except (ValueError, IndexError):
                    pass
        
        i += 1
    
    if current_time is None:
        current_time = sample.imported_at
        min_time = current_time
        max_time = current_time
    
    db.add_all(all_metrics)
    db.add_all(all_records)
    db.flush()
    
    return {
        'metrics_count': len(all_metrics),
        'records_count': len(all_records),
        'min_time': min_time,
        'max_time': max_time,
    }
