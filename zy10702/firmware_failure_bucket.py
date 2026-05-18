#!/usr/bin/env python3
"""
设备升级日志固件失败分桶 CLI
按型号和阶段对升级失败日志进行分桶分析
"""

import argparse
import json
import csv
import sys
import os
import hashlib
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Optional


def load_config(config_path: str) -> Dict[str, Any]:
    """加载配置文件"""
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def parse_version(version_str: str) -> Dict[str, Any]:
    """解析版本号，检测缺段情况"""
    result = {
        'original': version_str,
        'segments': [],
        'missing_segments': False,
        'segment_count': 0
    }
    
    if not version_str or version_str.strip() == '':
        result['missing_segments'] = True
        return result
    
    segments = version_str.strip().split('.')
    result['segments'] = segments
    result['segment_count'] = len(segments)
    
    if len(segments) < 3:
        result['missing_segments'] = True
    
    return result


def load_logs(log_path: str) -> List[Dict[str, Any]]:
    """加载日志文件，支持JSON和CSV格式"""
    logs = []
    
    if not os.path.exists(log_path):
        print(f"错误: 文件不存在 - {log_path}", file=sys.stderr)
        return logs
    
    _, ext = os.path.splitext(log_path)
    
    if ext.lower() == '.json':
        with open(log_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                logs = data
            else:
                logs = [data]
    elif ext.lower() == '.csv':
        with open(log_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                logs.append(row)
    else:
        print(f"错误: 不支持的文件格式 - {ext}", file=sys.stderr)
    
    return logs


def generate_log_id(log: Dict[str, Any]) -> str:
    """生成日志唯一ID，用于检测重复上报"""
    key_fields = [
        str(log.get('device_id', '')),
        str(log.get('timestamp', '')),
        str(log.get('firmware_version', '')),
        str(log.get('stage', ''))
    ]
    key = '|'.join(key_fields)
    return hashlib.md5(key.encode('utf-8')).hexdigest()


def bucket_failures(logs: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    """按配置规则对失败日志进行分桶"""
    buckets = defaultdict(lambda: {
        'count': 0,
        'logs': [],
        'device_offline': 0,
        'version_missing_segments': 0,
        'duplicate_reports': 0
    })
    
    seen_ids = set()
    all_offline_devices = set()
    all_version_issues = set()
    all_duplicates = set()
    
    bucket_by = config.get('bucket_by', ['model', 'stage'])
    
    for log in logs:
        status = str(log.get('status', '')).lower()
        is_failure = status in config.get('failure_statuses', ['fail', 'failure', 'failed', 'error'])
        
        if not is_failure:
            continue
        
        log_id = generate_log_id(log)
        is_duplicate = log_id in seen_ids
        if is_duplicate:
            all_duplicates.add(log_id)
        else:
            seen_ids.add(log_id)
        
        device_id = str(log.get('device_id', 'unknown'))
        is_offline = str(log.get('is_offline', '')).lower() in ['true', '1', 'yes', 'offline']
        if is_offline:
            all_offline_devices.add(device_id)
        
        version_info = parse_version(str(log.get('firmware_version', '')))
        if version_info['missing_segments']:
            all_version_issues.add(device_id)
        
        bucket_key_parts = []
        for field in bucket_by:
            value = str(log.get(field, f'unknown_{field}'))
            bucket_key_parts.append(value)
        bucket_key = '|'.join(bucket_key_parts)
        
        bucket = buckets[bucket_key]
        bucket['count'] += 1
        bucket['logs'].append(log)
        
        if is_offline:
            bucket['device_offline'] += 1
        if version_info['missing_segments']:
            bucket['version_missing_segments'] += 1
        if is_duplicate:
            bucket['duplicate_reports'] += 1
    
    result = {
        'buckets': dict(buckets),
        'summary': {
            'total_failures': sum(b['count'] for b in buckets.values()),
            'total_buckets': len(buckets),
            'device_offline_count': len(all_offline_devices),
            'version_missing_segments_count': len(all_version_issues),
            'duplicate_reports_count': len(all_duplicates),
            'bucketed_by': bucket_by
        }
    }
    
    return result


def format_output(result: Dict[str, Any], output_format: str = 'json') -> str:
    """格式化输出"""
    if output_format == 'json':
        return json.dumps(result, ensure_ascii=False, indent=2)
    elif output_format == 'pretty':
        lines = []
        lines.append("=" * 80)
        lines.append("设备升级日志固件失败分桶结果")
        lines.append("=" * 80)
        lines.append("")
        
        summary = result['summary']
        lines.append(f"总失败数: {summary['total_failures']}")
        lines.append(f"分桶数量: {summary['total_buckets']}")
        lines.append(f"分桶维度: {', '.join(summary['bucketed_by'])}")
        lines.append(f"设备离线数: {summary['device_offline_count']}")
        lines.append(f"版本号缺段数: {summary['version_missing_segments_count']}")
        lines.append(f"重复上报数: {summary['duplicate_reports_count']}")
        lines.append("")
        
        lines.append("-" * 80)
        lines.append("分桶详情:")
        lines.append("-" * 80)
        lines.append("")
        
        for bucket_key, bucket_data in result['buckets'].items():
            lines.append(f"分桶: {bucket_key}")
            lines.append(f"  失败数量: {bucket_data['count']}")
            lines.append(f"  设备离线: {bucket_data['device_offline']}")
            lines.append(f"  版本缺段: {bucket_data['version_missing_segments']}")
            lines.append(f"  重复上报: {bucket_data['duplicate_reports']}")
            lines.append("")
            
            if 'logs' in bucket_data:
                for i, log in enumerate(bucket_data['logs'][:3], 1):
                    lines.append(f"  日志 #{i}:")
                    lines.append(f"    设备ID: {log.get('device_id', 'N/A')}")
                    lines.append(f"    型号: {log.get('model', 'N/A')}")
                    lines.append(f"    阶段: {log.get('stage', 'N/A')}")
                    lines.append(f"    版本: {log.get('firmware_version', 'N/A')}")
                    lines.append(f"    错误: {log.get('error_message', 'N/A')}")
                    lines.append("")
                
                if len(bucket_data['logs']) > 3:
                    lines.append(f"  ... 还有 {len(bucket_data['logs']) - 3} 条日志")
                    lines.append("")
        
        return '\n'.join(lines)
    else:
        return json.dumps(result, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description='设备升级日志固件失败分桶工具')
    parser.add_argument('-i', '--input', required=True, help='输入日志文件路径 (JSON或CSV)')
    parser.add_argument('-c', '--config', default='config.json', help='配置文件路径 (默认: config.json)')
    parser.add_argument('-o', '--output', help='输出文件路径 (默认: 标准输出)')
    parser.add_argument('-f', '--format', choices=['json', 'pretty'], default='pretty', help='输出格式 (默认: pretty)')
    parser.add_argument('--show-logs', action='store_true', help='在输出中包含完整日志详情')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.config):
        print(f"错误: 配置文件不存在 - {args.config}", file=sys.stderr)
        print("请先创建配置文件，或使用 -c 参数指定配置文件路径", file=sys.stderr)
        sys.exit(1)
    
    config = load_config(args.config)
    logs = load_logs(args.input)
    
    if not logs:
        print("错误: 未加载到任何日志数据", file=sys.stderr)
        sys.exit(1)
    
    result = bucket_failures(logs, config)
    
    if not args.show_logs:
        for bucket in result['buckets'].values():
            del bucket['logs']
    
    output_content = format_output(result, args.format)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output_content)
        print(f"结果已写入: {args.output}")
    else:
        print(output_content)


if __name__ == '__main__':
    main()
