"""Parser for iostat output."""

import re
from datetime import datetime, timedelta
from typing import Dict, Any

from ..database import Metric, Record


def parse_iostat(db, sample, raw_content: str) -> Dict[str, Any]:
    """Parse iostat output.
    
    iostat output format:
    Linux 5.4.0-42-generic (server)  05/05/2026  _x86_64_    (8 CPU)
    
    avg-cpu:  %user   %nice %system %iowait  %steal   %idle
               2.30    0.00    1.50   30.20    0.00   66.00
    
    Device             tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
    sda               50.00       200.00      1500.00       4000      30000
    sdb               10.00        50.00        20.00       1000        400
    """
    lines = raw_content.split('\n')
    
    all_metrics = []
    all_records = []
    
    base_time = sample.imported_at
    min_time = base_time
    max_time = base_time
    snapshot_index = 0
    
    current_snapshot_time = base_time
    in_cpu_section = False
    in_device_section = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if 'avg-cpu:' in line:
            in_cpu_section = True
            in_device_section = False
            current_snapshot_time = base_time + timedelta(seconds=snapshot_index)
            snapshot_index += 1
            if max_time < current_snapshot_time:
                max_time = current_snapshot_time
            continue
        
        if 'Device' in line and 'tps' in line:
            in_cpu_section = False
            in_device_section = True
            continue
        
        if in_cpu_section and line:
            parts = line.split()
            if len(parts) >= 6 and all(p.replace('.', '', 1).isdigit() for p in parts):
                try:
                    user = float(parts[0])
                    nice = float(parts[1])
                    system = float(parts[2])
                    iowait = float(parts[3])
                    steal = float(parts[4])
                    idle = float(parts[5])
                    
                    cpu_metrics = [
                        ('cpu_user', user, 'cpu', '%'),
                        ('cpu_nice', nice, 'cpu', '%'),
                        ('cpu_system', system, 'cpu', '%'),
                        ('cpu_iowait', iowait, 'cpu', '%'),
                        ('cpu_steal', steal, 'cpu', '%'),
                        ('cpu_idle', idle, 'cpu', '%'),
                    ]
                    
                    for name, value, category, unit in cpu_metrics:
                        all_metrics.append(Metric(
                            sample_id=sample.id,
                            timestamp=current_snapshot_time,
                            category=category,
                            metric_name=name,
                            value=value,
                            unit=unit,
                            raw_text=line
                        ))
                except (ValueError, IndexError):
                    pass
        
        if in_device_section and line:
            parts = line.split()
            if len(parts) >= 6 and not parts[0][0].isdigit():
                try:
                    device = parts[0]
                    tps = float(parts[1])
                    kb_read_s = float(parts[2])
                    kb_wrtn_s = float(parts[3])
                    kb_read = float(parts[4])
                    kb_wrtn = float(parts[5])
                    
                    device_metrics = [
                        (f'device_{device}_tps', tps, 'io', 'tps'),
                        (f'device_{device}_read_s', kb_read_s, 'io', 'kB/s'),
                        (f'device_{device}_write_s', kb_wrtn_s, 'io', 'kB/s'),
                        (f'device_{device}_read_total', kb_read, 'io', 'kB'),
                        (f'device_{device}_write_total', kb_wrtn, 'io', 'kB'),
                    ]
                    
                    for name, value, category, unit in device_metrics:
                        all_metrics.append(Metric(
                            sample_id=sample.id,
                            timestamp=current_snapshot_time,
                            category=category,
                            metric_name=name,
                            value=value,
                            unit=unit,
                            raw_text=line
                        ))
                    
                    all_records.append(Record(
                        sample_id=sample.id,
                        timestamp=current_snapshot_time,
                        record_type='io_device',
                        raw_data=line
                    ))
                    
                except (ValueError, IndexError):
                    pass
    
    db.add_all(all_metrics)
    db.add_all(all_records)
    db.flush()
    
    return {
        'metrics_count': len(all_metrics),
        'records_count': len(all_records),
        'min_time': min_time,
        'max_time': max_time,
    }
