"""Parser for flame graph folded stacks output."""

import re
from datetime import datetime
from typing import Dict, Any
from collections import defaultdict

from ..database import Metric, Record


def parse_flame_graph(db, sample, raw_content: str) -> Dict[str, Any]:
    """Parse flame graph folded stacks output.
    
    Folded stacks format (from perf script | stackcollapse-perf.pl):
    function1;function2;function3 count
    
    Example:
    libc.so.6;_start;main;foo;bar 1500
    libc.so.6;_start;main;foo;baz 500
    libc.so.6;_start;main;qux 1000
    
    Each line represents a unique call stack with a sample count.
    Functions are separated by semicolons, from root to leaf.
    """
    lines = raw_content.split('\n')
    
    all_metrics = []
    all_records = []
    
    base_time = sample.imported_at
    min_time = base_time
    max_time = base_time
    
    stack_counts = []
    function_counts = defaultdict(int)
    total_samples = 0
    
    self_time = defaultdict(int)
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        parts = line.rsplit(' ', 1)
        if len(parts) != 2:
            continue
        
        stack_str = parts[0]
        try:
            count = int(parts[1])
        except ValueError:
            continue
        
        if not stack_str:
            continue
        
        stack = stack_str.split(';')
        if not stack:
            continue
        
        stack_counts.append({
            'stack': stack,
            'count': count
        })
        
        for func in stack:
            if func:
                function_counts[func] += count
        
        leaf_func = stack[-1] if stack else ''
        if leaf_func:
            self_time[leaf_func] += count
        
        total_samples += count
        
        all_records.append(Record(
            sample_id=sample.id,
            timestamp=base_time,
            record_type='flame_stack',
            raw_data=line
        ))
    
    if total_samples > 0:
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='flame',
            metric_name='flame_total_samples',
            value=float(total_samples),
            unit='samples',
            raw_text=f'Total samples: {total_samples}'
        ))
        
        all_metrics.append(Metric(
            sample_id=sample.id,
            timestamp=base_time,
            category='flame',
            metric_name='flame_unique_stacks',
            value=float(len(stack_counts)),
            unit='stacks',
            raw_text=f'Unique stacks: {len(stack_counts)}'
        ))
        
        top_functions = sorted(function_counts.items(), key=lambda x: x[1], reverse=True)[:20]
        for func, count in top_functions:
            if func in ['0x', '?', '??', '0', '', '[unknown]', '[kernel.kallsyms]']:
                continue
            
            percentage = (count / total_samples) * 100
            
            all_metrics.append(Metric(
                sample_id=sample.id,
                timestamp=base_time,
                category='flame',
                metric_name=f'flame_func_total_{func[:50]}',
                value=float(count),
                unit='samples',
                raw_text=f'{func}: {count} samples ({percentage:.1f}%)'
            ))
            
            if percentage > 5.0:
                all_metrics.append(Metric(
                    sample_id=sample.id,
                    timestamp=base_time,
                    category='flame',
                    metric_name=f'flame_hotspot_total_{func[:50]}',
                    value=float(count),
                    unit='samples',
                    raw_text=f'Hotspot (total): {func} ({count} samples, {percentage:.1f}%)'
                ))
        
        if self_time:
            top_self_time = sorted(self_time.items(), key=lambda x: x[1], reverse=True)[:20]
            for func, count in top_self_time:
                if func in ['0x', '?', '??', '0', '', '[unknown]']:
                    continue
                
                percentage = (count / total_samples) * 100
                
                all_metrics.append(Metric(
                    sample_id=sample.id,
                    timestamp=base_time,
                    category='flame',
                    metric_name=f'flame_func_self_{func[:50]}',
                    value=float(count),
                    unit='samples',
                    raw_text=f'{func} (self): {count} samples ({percentage:.1f}%)'
                ))
                
                if percentage > 3.0:
                    all_metrics.append(Metric(
                        sample_id=sample.id,
                        timestamp=base_time,
                        category='flame',
                        metric_name=f'flame_hotspot_self_{func[:50]}',
                        value=float(count),
                        unit='samples',
                        raw_text=f'Hotspot (self): {func} ({count} samples, {percentage:.1f}%)'
                    ))
        
        if stack_counts:
            widest_stacks = sorted(stack_counts, key=lambda x: x['count'], reverse=True)[:10]
            for i, stack_data in enumerate(widest_stacks):
                stack = stack_data['stack']
                count = stack_data['count']
                percentage = (count / total_samples) * 100
                
                chain_summary = ';'.join(stack[-5:]) if len(stack) > 5 else ';'.join(stack)
                
                all_metrics.append(Metric(
                    sample_id=sample.id,
                    timestamp=base_time,
                    category='flame',
                    metric_name=f'flame_widest_stack_{i}',
                    value=float(count),
                    unit='samples',
                    raw_text=f'Widest stack {i+1}: {chain_summary} ({count} samples, {percentage:.1f}%)'
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
