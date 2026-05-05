"""Parser for strace output."""

import re
from datetime import datetime, timedelta
from typing import Dict, Any, List
from collections import defaultdict

from ..database import Metric, Record


def parse_strace(db, sample, raw_content: str) -> Dict[str, Any]:
    """Parse strace output.
    
    strace output formats:
    1. Basic: open("/etc/passwd", O_RDONLY) = 3
    2. With timestamp: 10:30:15 open("/etc/passwd", O_RDONLY) = 3
    3. With relative time: 0.000123 open("/etc/passwd", O_RDONLY) = 3
    4. With unfinished/resumed:
       10:30:15 read(3,  <unfinished ...>
       10:30:16 <... read resumed> "data", 1024) = 4
    5. With -ttt (epoch time): 1714905015.123456 open(...) = 3
    
    Common syscalls to monitor for performance:
    - open, openat: file operations
    - read, write, pread, pwrite: IO operations
    - socket, connect, accept, recv, send: network
    - poll, select, epoll_*: waiting
    - nanosleep, clock_nanosleep: sleeping
    - futex: synchronization (often indicates blocking)
    - mmap, munmap: memory operations
    """
    lines = raw_content.split('\n')
    
    all_metrics = []
    all_records = []
    
    base_time = sample.imported_at
    min_time = base_time
    max_time = base_time
    
    syscall_counts = defaultdict(int)
    syscall_errors = defaultdict(int)
    syscall_times = defaultdict(list)
    
    slow_syscalls = []
    
    blocking_syscalls = ['poll', 'select', 'epoll_wait', 'nanosleep', 
                         'futex', 'accept', 'connect', 'read', 'write']
    
    unfinished_calls = {}
    
    current_time = base_time
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        time_match = re.match(r'^(\d{1,2}:\d{2}:\d{2})\s+', line)
        epoch_match = re.match(r'^(\d+\.\d+)\s+', line)
        relative_match = re.match(r'^(\d+\.\d+)\s+', line)
        
        line_time = current_time
        
        if time_match:
            time_str = time_match.group(1)
            parts = time_str.split(':')
            line_time = current_time.replace(
                hour=int(parts[0]),
                minute=int(parts[1]),
                second=int(parts[2])
            )
            line = line[len(time_match.group(0)):].strip()
        
        elif epoch_match:
            try:
                epoch = float(epoch_match.group(1))
                line_time = datetime.utcfromtimestamp(epoch)
                line = line[len(epoch_match.group(0)):].strip()
            except ValueError:
                pass
        
        resumed_match = re.match(r'<\.\.\. (\w+) resumed>', line)
        if resumed_match:
            syscall_name = resumed_match.group(1)
            if syscall_name in unfinished_calls:
                start_time = unfinished_calls[syscall_name]['time']
                duration = (line_time - start_time).total_seconds()
                syscall_times[syscall_name].append(duration)
                del unfinished_calls[syscall_name]
            
            syscall_counts[syscall_name] += 1
            
            all_records.append(Record(
                sample_id=sample.id,
                timestamp=line_time,
                record_type='syscall',
                raw_data=line
            ))
            continue
        
        unfinished_match = re.search(r'<unfinished[^>]*>', line)
        if unfinished_match:
            syscall_match = re.match(r'^(\w+)\(', line)
            if syscall_match:
                syscall_name = syscall_match.group(1)
                unfinished_calls[syscall_name] = {
                    'time': line_time,
                    'line': line
                }
                syscall_counts[syscall_name] += 1
            
            all_records.append(Record(
                sample_id=sample.id,
                timestamp=line_time,
                record_type='syscall',
                raw_data=line
            ))
            continue
        
        syscall_match = re.match(r'^(\w+)\((.*?)\)\s*=\s*(-?\d+)', line)
        
        if syscall_match:
            syscall_name = syscall_match.group(1)
            result = int(syscall_match.group(3))
            
            syscall_counts[syscall_name] += 1
            
            if result == -1:
                syscall_errors[syscall_name] += 1
            
            if syscall_name in blocking_syscalls:
                duration_match = re.search(r'<(\d+\.\d+)>', line)
                if duration_match:
                    try:
                        duration = float(duration_match.group(1))
                        syscall_times[syscall_name].append(duration)
                        
                        if duration > 0.1:
                            slow_syscalls.append({
                                'syscall': syscall_name,
                                'duration': duration,
                                'time': line_time,
                                'line': line
                            })
                    except ValueError:
                        pass
            
            all_records.append(Record(
                sample_id=sample.id,
                timestamp=line_time,
                record_type='syscall',
                raw_data=line
            ))
    
    top_syscalls = sorted(syscall_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    for syscall, count in top_syscalls:
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='syscall',
            metric_name=f'syscall_{syscall}_count',
            value=float(count),
            unit='calls',
            raw_text=f'{syscall}: {count} calls'
        ))
    
    total_syscalls = sum(syscall_counts.values())
    all_metrics.append(Metric(
        sample_id=sample.id,
        timestamp=base_time,
        category='syscall',
        metric_name='syscall_total',
        value=float(total_syscalls),
        unit='calls',
        raw_text=f'Total syscalls: {total_syscalls}'
    ))
    
    total_errors = sum(syscall_errors.values())
    if total_errors > 0:
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='syscall',
            metric_name='syscall_errors',
            value=float(total_errors),
            unit='errors',
            raw_text=f'Total errors: {total_errors}'
        ))
        
        top_errors = sorted(syscall_errors.items(), key=lambda x: x[1], reverse=True)[:5]
        for syscall, count in top_errors:
            all_metrics.append(Metric(
                sample_id=sample.id,
                timestamp=base_time,
                category='syscall',
                metric_name=f'syscall_{syscall}_errors',
                value=float(count),
                unit='errors',
                raw_text=f'{syscall} errors: {count}'
            ))
    
    if slow_syscalls:
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='syscall',
            metric_name='syscall_slow_count',
            value=float(len(slow_syscalls)),
            unit='calls',
            raw_text=f'Slow syscalls (>100ms): {len(slow_syscalls)}'
        ))
        
        avg_duration = sum(sc['duration'] for sc in slow_syscalls) / len(slow_syscalls)
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='syscall',
            metric_name='syscall_slow_avg_duration',
            value=avg_duration,
            unit='seconds',
            raw_text=f'Average slow duration: {avg_duration:.3f}s'
        ))
    
    if 'futex' in syscall_counts:
        futex_count = syscall_counts['futex']
        if futex_count > 100:
            all_metrics.append(Metric(
                sample_id=sample.id,
                timestamp=base_time,
                category='syscall',
                metric_name='futex_high',
                value=float(futex_count),
                unit='calls',
                raw_text=f'High futex calls: {futex_count} (potential contention)'
            ))
    
    db.add_all(all_metrics)
    db.add_all(all_records)
    db.flush()
    
    return {
        'metrics_count': len(all_metrics),
        'records_count': len(all_records),
        'min_time': min_time,
        'max_time': max_time,
    }
