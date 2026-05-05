"""Timeline analyzer for detecting performance anomalies."""

from datetime import datetime, timedelta
from typing import Dict, Any, List
from collections import defaultdict

from ..database import Metric, Event, Session, Sample, Analysis, Metric


EVENT_TYPES = {
    'cpu_spike': 'CPU 飙高',
    'io_wait': 'IO Wait 瓶颈',
    'network_block': '网络连接堆积',
    'syscall_block': '系统调用阻塞',
    'hotspot': '热点函数',
    'memory_pressure': '内存压力',
    'load_high': '负载过高',
}


def analyze_session(db, session: Session, 
                    cpu_threshold: float = 80.0,
                    iowait_threshold: float = 30.0,
                    load_threshold: float = None) -> Dict[str, Any]:
    """Analyze a session and detect performance anomalies.
    
    Args:
        db: Database session
        session: Session to analyze
        cpu_threshold: CPU usage threshold for spike detection
        iowait_threshold: IO wait threshold
        load_threshold: Load average threshold (defaults to CPU count * 0.7)
    
    Returns:
        Dictionary with analysis results
    """
    events = []
    
    analysis = Analysis(
        session_id=session.id,
        analysis_type='full',
        started_at=datetime.utcnow(),
    )
    db.add(analysis)
    db.flush()
    
    metrics = db.query(Metric).filter(
        Metric.sample_id.in_([s.id for s in session.samples])
    ).all()
    
    if not metrics:
        analysis.completed_at = datetime.utcnow()
        analysis.summary = "No metrics to analyze"
        db.commit()
        return {'events': [], 'analysis': analysis}
    
    events.extend(analyze_cpu_spikes(db, session, metrics, cpu_threshold))
    events.extend(analyze_iowait(db, session, metrics, iowait_threshold))
    events.extend(analyze_network(db, session, metrics))
    events.extend(analyze_syscall(db, session, metrics))
    events.extend(analyze_hotspots(db, session, metrics))
    events.extend(analyze_load(db, session, metrics, load_threshold))
    events.extend(analyze_memory(db, session, metrics))
    
    events = merge_adjacent_events(events)
    
    for event in events:
        db.add(event)
    
    db.flush()
    
    summary = generate_analysis_summary(events)
    analysis.completed_at = datetime.utcnow()
    analysis.summary = summary
    db.flush()
    
    return {
        'events': events,
        'analysis': analysis,
        'summary': summary
    }


def analyze_cpu_spikes(db, session: Session, metrics: List[Metric], 
                        threshold: float = 80.0) -> List[Event]:
    """Analyze for CPU spikes."""
    events = []
    
    cpu_metrics = [m for m in metrics if m.metric_name in ['cpu_user', 'cpu_system', 'cpu_idle', 'process_cpu']]
    
    if not cpu_metrics:
        return events
    
    metrics_by_time = defaultdict(list)
    for m in cpu_metrics:
        metrics_by_time[m.timestamp].append(m)
    
    high_cpu_times = []
    high_cpu_processes = defaultdict(list)
    
    for timestamp, ts_metrics in sorted(metrics_by_time.items()):
        total_cpu = 0.0
        idle_cpu = 100.0
        
        for m in ts_metrics:
            if m.metric_name == 'cpu_idle':
                idle_cpu = m.value or 100.0
            elif m.metric_name in ['cpu_user', 'cpu_system']:
                total_cpu += m.value or 0.0
            elif m.metric_name == 'process_cpu' and m.process_name:
                if (m.value or 0) > 50.0:
                    high_cpu_processes[timestamp].append({
                        'process': m.process_name,
                        'pid': m.process_pid,
                        'cpu': m.value
                    })
        
        used_cpu = 100.0 - idle_cpu
        if used_cpu > threshold or total_cpu > threshold:
            high_cpu_times.append(timestamp)
    
    if high_cpu_times:
        events.extend(create_events_from_times(
            db, session,
            timestamps=high_cpu_times,
            event_type='cpu_spike',
            base_severity='warning' if threshold < 90 else 'critical',
            title_format='CPU 使用率飙高',
            desc_format='检测到 CPU 使用率超过 {threshold}%',
            threshold=threshold
        ))
        
        for timestamp, processes in high_cpu_processes.items():
            if processes:
                top_proc = sorted(processes, key=lambda x: x['cpu'], reverse=True)[0]
                event = Event(
                    session_id=session.id,
                    event_type='cpu_spike',
                    severity='critical' if top_proc['cpu'] > 90 else 'warning',
                    timestamp=timestamp,
                    title=f'进程 {top_proc["process"]} CPU 飙高',
                    description=f'进程 {top_proc["process"]} (PID: {top_proc["pid"]}) CPU 使用率达到 {top_proc["cpu"]:.1f}%',
                )
                events.append(event)
    
    return events


def analyze_iowait(db, session: Session, metrics: List[Metric], 
                     threshold: float = 30.0) -> List[Event]:
    """Analyze for IO wait bottlenecks."""
    events = []
    
    iowait_metrics = [m for m in metrics if m.metric_name == 'cpu_iowait']
    
    if not iowait_metrics:
        return events
    
    high_iowait_times = [m.timestamp for m in iowait_metrics if (m.value or 0) > threshold]
    
    if high_iowait_times:
        events.extend(create_events_from_times(
            db, session,
            timestamps=high_iowait_times,
            event_type='io_wait',
            base_severity='warning' if threshold < 50 else 'critical',
            title_format='IO Wait 瓶颈',
            desc_format='检测到 IO Wait 超过 {threshold}%，可能存在磁盘或存储瓶颈',
            threshold=threshold
        ))
    
    io_device_metrics = [m for m in metrics if m.metric_name.startswith('device_')]
    if io_device_metrics:
        devices = set()
        for m in io_device_metrics:
            if m.metric_name.startswith('device_'):
                parts = m.metric_name.split('_')
                if len(parts) >= 2:
                    devices.add(parts[1])
        
        for device in devices:
            read_metrics = [m for m in io_device_metrics 
                           if m.metric_name == f'device_{device}_read_s']
            write_metrics = [m for m in io_device_metrics 
                            if m.metric_name == f'device_{device}_write_s']
            
            if read_metrics or write_metrics:
                max_read = max((m.value or 0) for m in read_metrics) if read_metrics else 0
                max_write = max((m.value or 0) for m in write_metrics) if write_metrics else 0
                
                if max_read > 100000 or max_write > 100000:
                    latest_time = max(
                        [m.timestamp for m in read_metrics + write_metrics],
                        default=datetime.utcnow()
                    )
                    event = Event(
                        session_id=session.id,
                        event_type='io_wait',
                        severity='warning',
                        timestamp=latest_time,
                        title=f'设备 {device} 高 IO 活动',
                        description=f'设备 {device} 读取速度 {max_read/1024:.1f} MB/s, 写入速度 {max_write/1024:.1f} MB/s',
                    )
                    events.append(event)
    
    return events


def analyze_network(db, session: Session, metrics: List[Metric]) -> List[Event]:
    """Analyze for network connection issues."""
    events = []
    
    time_wait_metrics = [m for m in metrics if m.metric_name == 'conn_time_wait']
    high_recv_q = [m for m in metrics if m.metric_name == 'conn_high_recv_q']
    high_send_q = [m for m in metrics if m.metric_name == 'conn_high_send_q']
    total_conn = [m for m in metrics if m.metric_name == 'conn_total']
    
    for m in time_wait_metrics:
        if (m.value or 0) > 500:
            event = Event(
                session_id=session.id,
                event_type='network_block',
                severity='warning',
                timestamp=m.timestamp,
                title='TIME_WAIT 连接堆积',
                description=f'TIME_WAIT 状态连接数达到 {int(m.value)}，可能存在端口耗尽风险',
            )
            events.append(event)
    
    for m in high_recv_q:
        if (m.value or 0) > 0:
            event = Event(
                session_id=session.id,
                event_type='network_block',
                severity='critical',
                timestamp=m.timestamp,
                title='接收队列积压',
                description=f'{int(m.value)} 个连接的接收队列积压，应用可能处理不过来',
            )
            events.append(event)
    
    for m in high_send_q:
        if (m.value or 0) > 0:
            event = Event(
                session_id=session.id,
                event_type='network_block',
                severity='warning',
                timestamp=m.timestamp,
                title='发送队列积压',
                description=f'{int(m.value)} 个连接的发送队列积压，网络或对端可能存在问题',
            )
            events.append(event)
    
    for m in total_conn:
        if (m.value or 0) > 10000:
            event = Event(
                session_id=session.id,
                event_type='network_block',
                severity='warning',
                timestamp=m.timestamp,
                title='连接数过高',
                description=f'总连接数达到 {int(m.value)}，系统可能接近文件描述符上限',
            )
            events.append(event)
    
    return events


def analyze_syscall(db, session: Session, metrics: List[Metric]) -> List[Event]:
    """Analyze for syscall blocking issues."""
    events = []
    
    slow_syscall_metrics = [m for m in metrics if m.metric_name == 'syscall_slow_count']
    futex_metrics = [m for m in metrics if m.metric_name == 'futex_high']
    error_metrics = [m for m in metrics if m.metric_name == 'syscall_errors']
    
    for m in slow_syscall_metrics:
        if (m.value or 0) > 0:
            event = Event(
                session_id=session.id,
                event_type='syscall_block',
                severity='warning',
                timestamp=m.timestamp,
                title='慢系统调用',
                description=f'检测到 {int(m.value)} 个超过 100ms 的慢系统调用',
            )
            events.append(event)
    
    for m in futex_metrics:
        if (m.value or 0) > 0:
            event = Event(
                session_id=session.id,
                event_type='syscall_block',
                severity='warning',
                timestamp=m.timestamp,
                title='Futex 争用',
                description=f'futex 调用频繁 ({int(m.value)} 次)，可能存在锁竞争',
            )
            events.append(event)
    
    for m in error_metrics:
        if (m.value or 0) > 10:
            event = Event(
                session_id=session.id,
                event_type='syscall_block',
                severity='warning',
                timestamp=m.timestamp,
                title='系统调用错误',
                description=f'检测到 {int(m.value)} 个系统调用返回错误',
            )
            events.append(event)
    
    return events


def analyze_hotspots(db, session: Session, metrics: List[Metric]) -> List[Event]:
    """Analyze for hotspot functions."""
    events = []
    
    hotspot_metrics = [m for m in metrics 
                      if 'hotspot' in m.metric_name.lower()]
    
    for m in hotspot_metrics:
        if 'perf_significant_hotspot' in m.metric_name:
            event = Event(
                session_id=session.id,
                event_type='hotspot',
                severity='warning',
                timestamp=m.timestamp,
                title='perf 热点函数',
                description=m.raw_text or '检测到显著的热点函数',
            )
            events.append(event)
        elif 'flame_hotspot' in m.metric_name:
            event = Event(
                session_id=session.id,
                event_type='hotspot',
                severity='warning' if 'self' in m.metric_name else 'info',
                timestamp=m.timestamp,
                title='火焰图热点函数',
                description=m.raw_text or '检测到热点函数',
            )
            events.append(event)
    
    perf_events = [m for m in metrics if m.metric_name.startswith('perf_hotspot_')]
    for m in perf_events:
        event = Event(
            session_id=session.id,
            event_type='hotspot',
            severity='info',
            timestamp=m.timestamp,
            title='热点函数',
            description=m.raw_text or '检测到热点函数',
        )
        events.append(event)
    
    return events


def analyze_load(db, session: Session, metrics: List[Metric], 
                  threshold: float = None) -> List[Event]:
    """Analyze for high load average."""
    events = []
    
    load_metrics = [m for m in metrics if m.metric_name in ['load_1min', 'load_5min', 'load_15min']]
    
    if not load_metrics:
        return events
    
    if threshold is None:
        threshold = 4.0
    
    high_load_times = []
    for m in load_metrics:
        if (m.value or 0) > threshold:
            high_load_times.append(m.timestamp)
    
    if high_load_times:
        events.extend(create_events_from_times(
            db, session,
            timestamps=high_load_times,
            event_type='load_high',
            base_severity='warning',
            title_format='负载过高',
            desc_format='负载平均值超过 {threshold}',
            threshold=threshold
        ))
    
    return events


def analyze_memory(db, session: Session, metrics: List[Metric]) -> List[Event]:
    """Analyze for memory pressure."""
    events = []
    
    mem_free = [m for m in metrics if m.metric_name == 'mem_free']
    swap_used = [m for m in metrics if m.metric_name == 'swap_used']
    mem_used = [m for m in metrics if m.metric_name == 'mem_used']
    
    for m in mem_free:
        if (m.value or 0) < 100000:
            event = Event(
                session_id=session.id,
                event_type='memory_pressure',
                severity='critical',
                timestamp=m.timestamp,
                title='可用内存不足',
                description=f'可用内存仅 {m.value/1024:.1f} MB',
            )
            events.append(event)
    
    for m in swap_used:
        if (m.value or 0) > 100000:
            event = Event(
                session_id=session.id,
                event_type='memory_pressure',
                severity='warning',
                timestamp=m.timestamp,
                title='Swap 使用过高',
                description=f'Swap 使用量达到 {m.value/1024:.1f} MB，可能存在内存压力',
            )
            events.append(event)
    
    return events


def create_events_from_times(db, session: Session,
                               timestamps: List[datetime],
                               event_type: str,
                               base_severity: str,
                               title_format: str,
                               desc_format: str,
                               **kwargs) -> List[Event]:
    """Create events from a list of timestamps."""
    if not timestamps:
        return []
    
    timestamps = sorted(set(timestamps))
    
    events = []
    if timestamps:
        first_time = timestamps[0]
        last_time = timestamps[-1]
        min_time = min(timestamps)
        max_time = max(timestamps)
        
        severity = base_severity
        if len(timestamps) > 3 and base_severity == 'warning':
            severity = 'critical'
        
        desc = desc_format.format(**kwargs)
        if len(timestamps) > 1:
            desc += f'，持续时间: {min_time} 到 {max_time}'
        
        event = Event(
            session_id=session.id,
            event_type=event_type,
            severity=severity,
            timestamp=first_time,
            end_timestamp=last_time,
            title=title_format,
            description=desc,
        )
        events.append(event)
    
    return events


def merge_adjacent_events(events: List[Event]) -> List[Event]:
    """Merge adjacent events of the same type that are close in time."""
    if not events:
        return events
    
    events_by_type = defaultdict(list)
    for event in events:
        events_by_type[event.event_type].append(event)
    
    merged_events = []
    
    for event_type, type_events in events_by_type.items():
        type_events.sort(key=lambda e: e.timestamp)
        
        if not type_events:
            continue
        
        current_group = [type_events[0]]
        current_start = type_events[0].timestamp
        current_end = type_events[0].end_timestamp or type_events[0].timestamp
        
        for event in type_events[1:]:
            event_time = event.timestamp
            time_diff = (event_time - current_end).total_seconds()
            
            if time_diff < 60:
                current_group.append(event)
                current_end = event.end_timestamp or event.timestamp
            else:
                merged = merge_event_group(current_group)
                merged_events.append(merged)
                current_group = [event]
                current_start = event.timestamp
                current_end = event.end_timestamp or event.timestamp
        
        if current_group:
            merged = merge_event_group(current_group)
            merged_events.append(merged)
    
    return merged_events


def merge_event_group(events: List[Event]) -> Event:
    """Merge a group of events into one."""
    if len(events) == 1:
        return events[0]
    
    first = events[0]
    
    max_severity = max(
        events,
        key=lambda e: {'critical': 3, 'warning': 2, 'info': 1}[e.severity]
    ).severity
    
    descriptions = [e.description for e in events if e.description]
    merged_desc = '; '.join(descriptions) if descriptions else None
    
    end_times = [e.end_timestamp or e.timestamp for e in events]
    max_end = max(end_times) if end_times else None
    
    merged = Event(
        session_id=first.session_id,
        event_type=first.event_type,
        severity=max_severity,
        timestamp=min(e.timestamp for e in events),
        end_timestamp=max_end,
        title=first.title,
        description=merged_desc,
    )
    
    return merged


def generate_analysis_summary(events: List[Event]) -> str:
    """Generate a summary text from events."""
    if not events:
        return "未检测到性能异常事件"
    
    by_type = defaultdict(list)
    for event in events:
        by_type[event.event_type].append(event)
    
    summary_parts = []
    for event_type, type_events in sorted(by_type.items()):
        type_name = EVENT_TYPES.get(event_type, event_type)
        critical = sum(1 for e in type_events if e.severity == 'critical')
        warning = sum(1 for e in type_events if e.severity == 'warning')
        info = sum(1 for e in type_events if e.severity == 'info')
        
        parts = []
        if critical:
            parts.append(f'{critical} 个严重')
        if warning:
            parts.append(f'{warning} 个警告')
        if info:
            parts.append(f'{info} 个信息')
        
        summary_parts.append(f'{type_name}: {", ".join(parts)}')
    
    return " | ".join(summary_parts)
