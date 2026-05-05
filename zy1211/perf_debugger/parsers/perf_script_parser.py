"""Parser for perf script output."""

import re
from datetime import datetime, timedelta
from typing import Dict, Any
from collections import defaultdict

from ..database import Metric, Record


def parse_perf_script(db, sample, raw_content: str) -> Dict[str, Any]:
    """Parse perf script output.
    
    perf script output format:
    ProcessName  PID [CPU]  Timestamp:  Event:
        Stack frame 1
        Stack frame 2
        Stack frame 3
    
    Example:
    python3  1234 [001] 1234567.890123: cpu-clock:
        0x7f8a1b2c3d4e /lib64/libc.so.6 (inlined)
        0x7f8a1b2c3d4e /lib64/libc.so.6+0x12345
        0x55c9a1b2c3d4 /usr/bin/python3+0x98765
    
    Or with more details:
    command   pid cpu time                  event
    python3  1234/1234  [001]  1234567.890123: cycles:u:
        ...
    """
    lines = raw_content.split('\n')
    
    all_metrics = []
    all_records = []
    
    base_time = sample.imported_at
    min_time = base_time
    max_time = base_time
    
    event_counts = defaultdict(int)
    function_counts = defaultdict(int)
    process_counts = defaultdict(int)
    cpu_activity = defaultdict(list)
    
    stack_traces = []
    
    current_stack = None
    current_event = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            if current_stack and current_event:
                stack_traces.append({
                    'event': current_event,
                    'stack': current_stack
                })
                current_stack = None
                current_event = None
            continue
        
        if not line.startswith(' '):
            match1 = re.match(
                r'^(\S+)\s+(\d+)\s+\[(\d+)\]\s+(\d+\.\d+):\s+([^:]+):',
                line
            )
            
            match2 = re.match(
                r'^(\S+)\s+(\d+)/\d+\s+\[(\d+)\]\s+(\d+\.\d+):\s+([^:]+):',
                line
            )
            
            match = match1 or match2
            
            if match:
                process_name = match.group(1)
                pid = int(match.group(2))
                cpu = int(match.group(3))
                timestamp = float(match.group(4))
                event_type = match.group(5)
                
                event_time = base_time + timedelta(seconds=timestamp)
                
                if min_time is None or event_time < min_time:
                    min_time = event_time
                if max_time is None or event_time > max_time:
                    max_time = event_time
                
                event_counts[event_type] += 1
                process_counts[process_name] += 1
                cpu_activity[cpu].append(event_time)
                
                current_event = {
                    'process': process_name,
                    'pid': pid,
                    'cpu': cpu,
                    'timestamp': event_time,
                    'type': event_type
                }
                current_stack = []
                
                all_records.append(Record(
                    sample_id=sample.id,
                    timestamp=event_time,
                    record_type='perf_event',
                    raw_data=line
                ))
        
        elif current_stack is not None:
            frame = {
                'raw': line
            }
            
            line_no_hex = re.sub(r'^0x[0-9a-f]+\s+', '', line)
            
            symbol_match = re.match(r'^([^+(\s]+)', line_no_hex)
            if symbol_match:
                frame['symbol'] = symbol_match.group(1)
                
                function_counts[frame['symbol']] += 1
            
            current_stack.append(frame)
    
    if current_stack and current_event:
        stack_traces.append({
            'event': current_event,
            'stack': current_stack
        })
    
    total_events = sum(event_counts.values())
    if total_events > 0:
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='perf',
            metric_name='perf_total_events',
            value=float(total_events),
            unit='events',
            raw_text=f'Total perf events: {total_events}'
        ))
        
        top_events = sorted(event_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        for event_type, count in top_events:
            all_metrics.append(Metric(
                sample_id=sample.id,
                timestamp=base_time,
                category='perf',
                metric_name=f'perf_event_{event_type}',
                value=float(count),
                unit='events',
                raw_text=f'{event_type}: {count}'
            ))
    
    if process_counts:
        top_processes = sorted(process_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        for process, count in top_processes:
            all_metrics.append(Metric(
                sample_id=sample.id,
                timestamp=base_time,
                category='perf',
                metric_name=f'perf_process_{process}',
                value=float(count),
                unit='samples',
                raw_text=f'{process}: {count} samples'
            ))
    
    if function_counts:
        top_functions = sorted(function_counts.items(), key=lambda x: x[1], reverse=True)[:20]
        for function, count in top_functions:
            if function in ['0x', '?', '??', '0', '']:
                continue
            
            all_metrics.append(Metric(
                sample_id=sample.id,
                timestamp=base_time,
                category='perf',
                metric_name=f'perf_hotspot_{function[:50]}',
                value=float(count),
                unit='samples',
                raw_text=f'{function}: {count} samples'
            ))
            
            if count > total_events * 0.05:
                all_metrics.append(Metric(
                    sample_id=sample.id,
                    timestamp=base_time,
                    category='perf',
                    metric_name=f'perf_significant_hotspot_{function[:50]}',
                    value=float(count),
                    unit='samples',
                    raw_text=f'Significant hotspot: {function} ({count} samples, {count/total_events*100:.1f}%)'
                ))
    
    if cpu_activity:
        for cpu, timestamps in cpu_activity.items():
            all_metrics.append(Metric(
                sample_id=sample.id,
                timestamp=base_time,
                category='perf',
                metric_name=f'perf_cpu_{cpu}_samples',
                value=float(len(timestamps)),
                unit='samples',
                raw_text=f'CPU {cpu}: {len(timestamps)} samples'
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
