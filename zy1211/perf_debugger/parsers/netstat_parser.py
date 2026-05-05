"""Parser for netstat/ss output."""

import re
from datetime import datetime, timedelta
from typing import Dict, Any

from ..database import Metric, Record


def parse_netstat(db, sample, raw_content: str) -> Dict[str, Any]:
    """Parse netstat or ss output.
    
    netstat output format:
    Active Internet connections (servers and established)
    Proto Recv-Q Send-Q Local Address           Foreign Address         State
    tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN
    tcp        0      0 192.168.1.100:22        10.0.0.1:54321          ESTABLISHED
    tcp        0      0 192.168.1.100:80        10.0.0.2:12345          TIME_WAIT
    
    ss output format:
    State       Recv-Q Send-Q       Local Address:Port         Peer Address:Port
    LISTEN      0      128                0.0.0.0:22              0.0.0.0:*
    ESTAB       0      0            192.168.1.100:22            10.0.0.1:54321
    TIME-WAIT   0      0            192.168.1.100:80            10.0.0.2:12345
    """
    lines = raw_content.split('\n')
    
    all_metrics = []
    all_records = []
    
    base_time = sample.imported_at
    min_time = base_time
    max_time = base_time
    
    state_counts = {
        'LISTEN': 0,
        'ESTABLISHED': 0,
        'ESTAB': 0,
        'TIME_WAIT': 0,
        'TIME-WAIT': 0,
        'CLOSE_WAIT': 0,
        'CLOSE-WAIT': 0,
        'FIN_WAIT1': 0,
        'FIN_WAIT2': 0,
        'CLOSING': 0,
        'LAST_ACK': 0,
        'LAST-ACK': 0,
        'SYN_SENT': 0,
        'SYN-SENT': 0,
        'SYN_RECV': 0,
        'SYN-RECV': 0,
    }
    
    high_recv_q_count = 0
    high_send_q_count = 0
    total_connections = 0
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if 'Active Internet' in line or 'Proto' in line or 'State' in line:
            continue
        
        parts = line.split()
        
        is_ss_format = False
        state_idx = 5
        proto = None
        
        if len(parts) >= 6:
            if parts[0] in ('tcp', 'udp', 'tcp6', 'udp6', 'RAW', 'UNIX'):
                proto = parts[0]
                state = parts[5] if len(parts) > 5 else ''
                try:
                    recv_q = int(parts[1])
                    send_q = int(parts[2])
                except (ValueError, IndexError):
                    continue
            else:
                is_ss_format = True
                state = parts[0]
                try:
                    recv_q = int(parts[1])
                    send_q = int(parts[2])
                except (ValueError, IndexError):
                    continue
        else:
            continue
        
        if state in state_counts:
            state_counts[state] += 1
        
        total_connections += 1
        
        if recv_q > 100:
            high_recv_q_count += 1
        if send_q > 100:
            high_send_q_count += 1
        
        all_records.append(Record(
            sample_id=sample.id,
            timestamp=base_time,
            record_type='connection',
            raw_data=line
        ))
    
    state_counts_normalized = {
        'LISTEN': state_counts['LISTEN'],
        'ESTABLISHED': state_counts['ESTABLISHED'] + state_counts['ESTAB'],
        'TIME_WAIT': state_counts['TIME_WAIT'] + state_counts['TIME-WAIT'],
        'CLOSE_WAIT': state_counts['CLOSE_WAIT'] + state_counts['CLOSE-WAIT'],
        'FIN_WAIT1': state_counts['FIN_WAIT1'],
        'FIN_WAIT2': state_counts['FIN_WAIT2'],
        'CLOSING': state_counts['CLOSING'],
        'LAST_ACK': state_counts['LAST_ACK'] + state_counts['LAST-ACK'],
        'SYN_SENT': state_counts['SYN_SENT'] + state_counts['SYN-SENT'],
        'SYN_RECV': state_counts['SYN_RECV'] + state_counts['SYN-RECV'],
    }
    
    for state, count in state_counts_normalized.items():
        if count > 0:
            all_metrics.append(Metric(
                sample_id=sample.id,
                timestamp=base_time,
                category='network',
                metric_name=f'conn_{state.lower()}',
                value=float(count),
                unit='connections',
                raw_text=f'{state}: {count}'
            ))
    
    all_metrics.append(Metric(
        sample_id=sample.id,
        timestamp=base_time,
        category='network',
        metric_name='conn_total',
        value=float(total_connections),
        unit='connections',
        raw_text=f'Total connections: {total_connections}'
    ))
    
    if high_recv_q_count > 0:
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='network',
            metric_name='conn_high_recv_q',
            value=float(high_recv_q_count),
            unit='connections',
            raw_text=f'High Recv-Q connections: {high_recv_q_count}'
        ))
    
    if high_send_q_count > 0:
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='network',
            metric_name='conn_high_send_q',
            value=float(high_send_q_count),
            unit='connections',
            raw_text=f'High Send-Q connections: {high_send_q_count}'
        ))
    
    time_wait_count = state_counts_normalized['TIME_WAIT']
    if time_wait_count > 100:
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='network',
            metric_name='conn_time_wait_high',
            value=float(time_wait_count),
            unit='connections',
            raw_text=f'High TIME_WAIT: {time_wait_count}'
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
