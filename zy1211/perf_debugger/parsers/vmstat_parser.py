"""Parser for vmstat output."""

import re
from datetime import datetime, timedelta
from typing import Dict, Any

from ..database import Metric, Record


def parse_vmstat(db, sample, raw_content: str) -> Dict[str, Any]:
    """Parse vmstat output.
    
    vmstat output format:
    procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
     r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
     1  0      0 537468 204388 2456320    0    0     0    12    1    0  0  0 100  0  0
     0  0      0 537468 204388 2456320    0    0     0     0  105  210  1  1 98  0  0
    """
    lines = raw_content.split('\n')
    
    all_metrics = []
    all_records = []
    
    header_found = False
    snapshot_index = 0
    
    base_time = sample.imported_at
    min_time = base_time
    max_time = base_time
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if 'procs' in line and 'memory' in line:
            header_found = True
            continue
        
        if header_found and line[0].isdigit():
            parts = line.split()
            
            if len(parts) >= 17:
                snapshot_time = base_time + timedelta(seconds=snapshot_index)
                snapshot_index += 1
                
                if max_time < snapshot_time:
                    max_time = snapshot_time
                
                try:
                    r = int(parts[0])
                    b = int(parts[1])
                    
                    swpd = int(parts[2])
                    free = int(parts[3])
                    buff = int(parts[4])
                    cache = int(parts[5])
                    
                    si = int(parts[6])
                    so = int(parts[7])
                    
                    bi = int(parts[8])
                    bo = int(parts[9])
                    
                    in_ = int(parts[10])
                    cs = int(parts[11])
                    
                    us = float(parts[12])
                    sy = float(parts[13])
                    id_ = float(parts[14])
                    wa = float(parts[15])
                    st = float(parts[16]) if len(parts) > 16 else 0.0
                    
                    vmstat_metrics = [
                        ('procs_r', r, 'process', ''),
                        ('procs_b', b, 'process', ''),
                        ('mem_swpd', swpd, 'memory', 'KB'),
                        ('mem_free', free, 'memory', 'KB'),
                        ('mem_buff', buff, 'memory', 'KB'),
                        ('mem_cache', cache, 'memory', 'KB'),
                        ('swap_si', si, 'swap', 'blocks/s'),
                        ('swap_so', so, 'swap', 'blocks/s'),
                        ('io_bi', bi, 'io', 'blocks/s'),
                        ('io_bo', bo, 'io', 'blocks/s'),
                        ('system_in', in_, 'system', '/s'),
                        ('system_cs', cs, 'system', '/s'),
                        ('cpu_user', us, 'cpu', '%'),
                        ('cpu_system', sy, 'cpu', '%'),
                        ('cpu_idle', id_, 'cpu', '%'),
                        ('cpu_iowait', wa, 'cpu', '%'),
                        ('cpu_steal', st, 'cpu', '%'),
                    ]
                    
                    for name, value, category, unit in vmstat_metrics:
                        all_metrics.append(Metric(
                            sample_id=sample.id,
                            timestamp=snapshot_time,
                            category=category,
                            metric_name=name,
                            value=float(value),
                            unit=unit,
                            raw_text=line
                        ))
                    
                    all_records.append(Record(
                        sample_id=sample.id,
                        timestamp=snapshot_time,
                        record_type='vmstat_snapshot',
                        raw_data=line
                    ))
                    
                except (ValueError, IndexError):
                    continue
    
    db.add_all(all_metrics)
    db.add_all(all_records)
    db.flush()
    
    return {
        'metrics_count': len(all_metrics),
        'records_count': len(all_records),
        'min_time': min_time,
        'max_time': max_time,
    }
