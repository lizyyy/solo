#!/usr/bin/env python3
import json
import os
import hashlib
import pandas as pd
import click

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
STATE_FILE = os.path.join(DATA_DIR, 'current_state.json')
REPORT_FILE = os.path.join(DATA_DIR, 'audit_report.json')
ISSUES_FILE = os.path.join(DATA_DIR, 'issues.csv')


def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


def compute_file_hash(file_path):
    hash_obj = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_obj.update(chunk)
    return hash_obj.hexdigest()


def load_state():
    if not os.path.exists(STATE_FILE):
        return {
            'ports': {},
            'links': [],
            'change_orders_applied': [],
            'port_ledger_hash': None,
            'change_order_hashes': [],
        }
    with open(STATE_FILE, 'r') as f:
        return json.load(f)


def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2, ensure_ascii=False)


def load_report():
    if not os.path.exists(REPORT_FILE):
        return {
            'imports': [],
            'changes': [],
            'verifications': [],
        }
    with open(REPORT_FILE, 'r') as f:
        return json.load(f)


def save_report(report):
    with open(REPORT_FILE, 'w') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)


def append_issue(issue):
    issues = []
    if os.path.exists(ISSUES_FILE):
        issues = pd.read_csv(ISSUES_FILE).to_dict('records')
    issues.append(issue)
    df = pd.DataFrame(issues)
    df.to_csv(ISSUES_FILE, index=False)


@click.group()
def cli():
    ensure_data_dir()


@cli.command('import')
@click.option('--ledger', required=True, type=click.Path(exists=True), help='端口台账CSV文件')
def import_ledger_cmd(ledger):
    state = load_state()
    report = load_report()
    
    current_hash = compute_file_hash(ledger)
    
    if state['port_ledger_hash'] == current_hash:
        click.echo(f"[跳过] 端口台账未变化，哈希一致: {current_hash[:16]}...")
        return
    
    try:
        df = pd.read_csv(ledger)
    except Exception as e:
        click.echo(f"[错误] 读取文件失败: {e}")
        return
    
    required_cols = ['port_id', 'device_id', 'rack', 'slot', 'port', 'status']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        click.echo(f"[错误] 缺少必要列: {', '.join(missing_cols)}")
        return
    
    total_rows = len(df)
    valid_ports = {}
    skipped_rows = []
    needs_confirmation = []
    
    for idx, row in df.iterrows():
        row_num = idx + 2
        port_id = str(row.get('port_id', '')).strip()
        
        if not port_id:
            skipped_rows.append(f"行{row_num}: port_id为空")
            continue
        
        status = str(row.get('status', '')).strip()
        if status not in ['active', 'inactive']:
            needs_confirmation.append({
                'type': 'invalid_status',
                'row': row_num,
                'port_id': port_id,
                'status': status,
                'message': f'状态值"{status}"不合法，应为active或inactive'
            })
        
        connected_to = str(row.get('connected_to', '')).strip()
        if connected_to and connected_to.lower() not in ['', 'nan', 'none'] and connected_to not in df['port_id'].values:
            needs_confirmation.append({
                'type': 'invalid_connection',
                'row': row_num,
                'port_id': port_id,
                'connected_to': connected_to,
                'message': f'连接的端口"{connected_to}"不存在'
            })
        
        def clean_value(v):
            s = str(v).strip()
            return '' if s.lower() in ['', 'nan', 'none'] else s
        
        valid_ports[port_id] = {
            'device_id': clean_value(row.get('device_id', '')),
            'rack': clean_value(row.get('rack', '')),
            'slot': clean_value(row.get('slot', '')),
            'port': clean_value(row.get('port', '')),
            'status': clean_value(status) if status else '',
            'connected_to': clean_value(connected_to),
        }
    
    state['ports'] = valid_ports
    state['port_ledger_hash'] = current_hash
    state['links'] = []
    
    import_record = {
        'file': ledger,
        'hash': current_hash,
        'total_rows': total_rows,
        'valid_ports': len(valid_ports),
        'skipped_rows': skipped_rows,
        'needs_confirmation': needs_confirmation,
    }
    
    report['imports'].append(import_record)
    
    save_state(state)
    save_report(report)
    
    for issue in needs_confirmation:
        append_issue(issue)
    
    click.echo("=" * 60)
    click.echo(f"[导入完成] 文件: {os.path.basename(ledger)}")
    click.echo(f"  - 总行数: {total_rows}")
    click.echo(f"  - 有效端口: {len(valid_ports)}")
    click.echo(f"  - 跳过坏行: {len(skipped_rows)}")
    if skipped_rows:
        for s in skipped_rows:
            click.echo(f"    * {s}")
    click.echo(f"  - 需人工确认: {len(needs_confirmation)}")
    if needs_confirmation:
        for n in needs_confirmation:
            click.echo(f"    * 端口{n['port_id']}: {n['message']}")


@cli.command('apply')
@click.option('--change', required=True, type=click.Path(exists=True), help='变更单JSON文件')
def apply_change_cmd(change):
    state = load_state()
    report = load_report()
    
    if not state['ports']:
        click.echo("[错误] 请先导入端口台账")
        return
    
    current_hash = compute_file_hash(change)
    
    if current_hash in state['change_order_hashes']:
        click.echo(f"[跳过] 变更单已应用，哈希一致: {current_hash[:16]}...")
        return
    
    try:
        with open(change, 'r', encoding='utf-8') as f:
            change_orders = json.load(f)
    except Exception as e:
        click.echo(f"[错误] 读取变更单失败: {e}")
        return
    
    total_ops = 0
    valid_ops = 0
    skipped_ops = []
    needs_confirmation = []
    
    for order in change_orders:
        order_id = order.get('order_id', 'UNKNOWN')
        operations = order.get('operations', [])
        
        for op in operations:
            total_ops += 1
            op_type = op.get('type')
            from_port = op.get('from_port')
            to_port = op.get('to_port')
            
            if op_type not in ['connect', 'disconnect']:
                skipped_ops.append(f"变更单{order_id}: 未知操作类型'{op_type}'")
                continue
            
            if not from_port or not to_port:
                skipped_ops.append(f"变更单{order_id}: 缺少from_port或to_port")
                continue
            
            if from_port not in state['ports']:
                needs_confirmation.append({
                    'type': 'unknown_port',
                    'order_id': order_id,
                    'from_port': from_port,
                    'message': f'源端口"{from_port}"不存在于台账'
                })
                continue
            
            if to_port not in state['ports']:
                needs_confirmation.append({
                    'type': 'unknown_port',
                    'order_id': order_id,
                    'to_port': to_port,
                    'message': f'目标端口"{to_port}"不存在于台账'
                })
                continue
            
            valid_ops += 1
            
            if op_type == 'connect':
                state['ports'][from_port]['connected_to'] = to_port
                state['ports'][to_port]['connected_to'] = from_port
                existing = next((l for l in state['links'] 
                                if (l['a'] == from_port and l['b'] == to_port) or 
                                   (l['a'] == to_port and l['b'] == from_port)), None)
                if not existing:
                    state['links'].append({
                        'a': from_port,
                        'b': to_port,
                        'order_id': order_id,
                        'reason': op.get('reason', '')
                    })
            
            elif op_type == 'disconnect':
                state['ports'][from_port]['connected_to'] = ''
                state['ports'][to_port]['connected_to'] = ''
                state['links'] = [l for l in state['links'] 
                                 if not ((l['a'] == from_port and l['b'] == to_port) or 
                                         (l['a'] == to_port and l['b'] == from_port))]
    
    state['change_order_hashes'].append(current_hash)
    
    change_record = {
        'file': change,
        'hash': current_hash,
        'total_operations': total_ops,
        'valid_operations': valid_ops,
        'skipped_operations': skipped_ops,
        'needs_confirmation': needs_confirmation,
    }
    
    report['changes'].append(change_record)
    
    save_state(state)
    save_report(report)
    
    for issue in needs_confirmation:
        append_issue(issue)
    
    click.echo("=" * 60)
    click.echo(f"[变更应用完成] 文件: {os.path.basename(change)}")
    click.echo(f"  - 总操作数: {total_ops}")
    click.echo(f"  - 成功应用: {valid_ops}")
    click.echo(f"  - 跳过操作: {len(skipped_ops)}")
    if skipped_ops:
        for s in skipped_ops:
            click.echo(f"    * {s}")
    click.echo(f"  - 需人工确认: {len(needs_confirmation)}")
    if needs_confirmation:
        for n in needs_confirmation:
            click.echo(f"    * {n['message']}")


@cli.command('verify')
@click.option('--expected', required=True, type=click.Path(exists=True), help='预期链路CSV文件')
def verify_links_cmd(expected):
    state = load_state()
    report = load_report()
    
    if not state['ports']:
        click.echo("[错误] 请先导入端口台账")
        return
    
    try:
        df = pd.read_csv(expected)
    except Exception as e:
        click.echo(f"[错误] 读取预期链路文件失败: {e}")
        return
    
    required_cols = ['link_id', 'port_a', 'port_b']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        click.echo(f"[错误] 缺少必要列: {', '.join(missing_cols)}")
        return
    
    total_expected = len(df)
    verified = 0
    mismatches = []
    missing_links = []
    extra_links = []
    
    actual_link_set = set()
    for link in state['links']:
        link_key = tuple(sorted([link['a'], link['b']]))
        actual_link_set.add(link_key)
    
    expected_link_set = set()
    for idx, row in df.iterrows():
        link_id = row['link_id']
        port_a = str(row['port_a']).strip()
        port_b = str(row['port_b']).strip()
        
        link_key = tuple(sorted([port_a, port_b]))
        expected_link_set.add(link_key)
        
        if link_key in actual_link_set:
            verified += 1
        else:
            port_a_exists = port_a in state['ports']
            port_b_exists = port_b in state['ports']
            
            if not port_a_exists or not port_b_exists:
                mismatches.append({
                    'type': 'missing_port',
                    'link_id': link_id,
                    'port_a': port_a,
                    'port_b': port_b,
                    'message': f'链路{link_id}的端口不存在: {port_a}或{port_b}'
                })
            else:
                actual_conn = state['ports'][port_a].get('connected_to', '')
                if actual_conn:
                    mismatches.append({
                        'type': 'wrong_connection',
                        'link_id': link_id,
                        'port_a': port_a,
                        'expected': port_b,
                        'actual': actual_conn,
                        'message': f'链路{link_id}: 端口{port_a}预期连接{port_b}，实际连接{actual_conn}'
                    })
                else:
                    missing_links.append({
                        'type': 'missing_link',
                        'link_id': link_id,
                        'port_a': port_a,
                        'port_b': port_b,
                        'message': f'链路{link_id}缺失: {port_a}未连接{port_b}'
                    })
    
    for actual_key in actual_link_set:
        if actual_key not in expected_link_set:
            extra_links.append({
                'type': 'extra_link',
                'port_a': actual_key[0],
                'port_b': actual_key[1],
                'message': f'发现未记录的链路: {actual_key[0]} <-> {actual_key[1]}'
            })
    
    all_issues = mismatches + missing_links + extra_links
    
    verify_record = {
        'file': expected,
        'hash': compute_file_hash(expected),
        'total_expected': total_expected,
        'verified': verified,
        'mismatches': mismatches,
        'missing_links': missing_links,
        'extra_links': extra_links,
    }
    
    report['verifications'].append(verify_record)
    save_report(report)
    
    for issue in all_issues:
        append_issue(issue)
    
    click.echo("=" * 60)
    click.echo(f"[链路校验完成] 文件: {os.path.basename(expected)}")
    click.echo(f"  - 预期链路数: {total_expected}")
    click.echo(f"  - 校验通过: {verified}")
    click.echo(f"  - 连接错误: {len(mismatches)}")
    if mismatches:
        for m in mismatches:
            click.echo(f"    * {m['message']}")
    click.echo(f"  - 缺失链路: {len(missing_links)}")
    if missing_links:
        for m in missing_links:
            click.echo(f"    * {m['message']}")
    click.echo(f"  - 多余链路: {len(extra_links)}")
    if extra_links:
        for e in extra_links:
            click.echo(f"    * {e['message']}")


if __name__ == '__main__':
    cli()
