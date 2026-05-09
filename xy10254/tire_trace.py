#!/usr/bin/env python3
import json
import csv
import os
import click
from datetime import datetime
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'data'
DATA_FILE = DATA_DIR / 'data.json'
HISTORY_FILE = DATA_DIR / 'history.json'

PROCESSES = [
    '初检',
    '打磨',
    '补洞',
    '硫化',
    '终检'
]

def init_data():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'casings': {},
                'processes': [],
                'inspections': []
            }, f, ensure_ascii=False, indent=2)
    if not HISTORY_FILE.exists():
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)

def load_data():
    init_data()
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_history():
    init_data()
    with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_history(history):
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def add_to_history(action, details):
    history = load_history()
    history.append({
        'timestamp': datetime.now().isoformat(),
        'action': action,
        'details': details
    })
    save_history(history)

def validate_casing(casing):
    required_fields = ['casing_id', 'source', 'model', 'spec', 'inbound_date', 'initial_condition']
    missing = [f for f in required_fields if f not in casing or not str(casing[f]).strip()]
    return missing

def validate_process(process):
    required_fields = ['casing_id', 'process_name', 'batch_id', 'operator', 'start_time', 'end_time', 'status']
    missing = [f for f in required_fields if f not in process or not str(process[f]).strip()]
    return missing

def validate_inspection(inspection):
    required_fields = ['casing_id', 'process_name', 'inspection_time', 'inspector', 'result']
    missing = [f for f in required_fields if f not in inspection or not str(inspection[f]).strip()]
    return missing

def check_process_flow(casing_id, processes):
    casing_processes = sorted([p for p in processes if p['casing_id'] == casing_id], 
                               key=lambda x: x['start_time'])
    flow_errors = []
    
    if not casing_processes:
        return flow_errors
    
    process_names = [p['process_name'] for p in casing_processes]
    for i, name in enumerate(process_names):
        if name not in PROCESSES:
            flow_errors.append(f"未知工序: {name}")
            continue
        
        expected_idx = PROCESSES.index(name)
        for j in range(i):
            prev_name = process_names[j]
            if prev_name in PROCESSES:
                prev_idx = PROCESSES.index(prev_name)
                if prev_idx > expected_idx:
                    flow_errors.append(f"工序顺序错误: {prev_name} (应该在{name}之后)")
    
    return flow_errors

def check_duplicates(data):
    duplicates = []
    
    casing_ids = defaultdict(list)
    for idx, casing in enumerate(data['casings'].values()):
        casing_ids[casing['casing_id']].append(casing)
    for cid, casings in casing_ids.items():
        if len(casings) > 1:
            duplicates.append(f"胎体档案重复: {cid} 出现 {len(casings)} 次")
    
    process_keys = defaultdict(list)
    for idx, proc in enumerate(data['processes']):
        key = (proc['casing_id'], proc['process_name'], proc['batch_id'], proc['start_time'])
        process_keys[key].append(proc)
    for key, procs in process_keys.items():
        if len(procs) > 1:
            duplicates.append(f"工序记录重复: 胎体{key[0]}-工序{key[1]}-批次{key[2]} 出现 {len(procs)} 次")
    
    inspection_keys = defaultdict(list)
    for idx, insp in enumerate(data['inspections']):
        key = (insp['casing_id'], insp['process_name'], insp['inspection_time'])
        inspection_keys[key].append(insp)
    for key, insps in inspection_keys.items():
        if len(insps) > 1:
            duplicates.append(f"质检记录重复: 胎体{key[0]}-工序{key[1]} 出现 {len(insps)} 次")
    
    return duplicates

def check_consistency(data):
    inconsistencies = []
    casing_ids = set(data['casings'].keys())
    
    for proc in data['processes']:
        if proc['casing_id'] not in casing_ids:
            inconsistencies.append(f"工序记录中的胎体不存在: {proc['casing_id']}")
    
    for insp in data['inspections']:
        if insp['casing_id'] not in casing_ids:
            inconsistencies.append(f"质检记录中的胎体不存在: {insp['casing_id']}")
    
    for casing_id in casing_ids:
        casing_processes = [p for p in data['processes'] if p['casing_id'] == casing_id]
        process_names = set(p['process_name'] for p in casing_processes)
        for insp in data['inspections']:
            if insp['casing_id'] == casing_id and insp['process_name'] not in process_names:
                inconsistencies.append(f"质检记录的工序不存在: 胎体{casing_id}-工序{insp['process_name']}")
    
    return inconsistencies

def check_rework_responsibility(data):
    rework_info = []
    
    for insp in data['inspections']:
        if insp.get('is_rework', False):
            casing_id = insp['casing_id']
            process_name = insp['process_name']
            rework_reason = insp.get('rework_reason', '未记录')
            inspector = insp['inspector']
            inspection_time = insp['inspection_time']
            
            process = next((p for p in data['processes'] 
                          if p['casing_id'] == casing_id and p['process_name'] == process_name), None)
            
            if process:
                operator = process['operator']
                batch_id = process['batch_id']
                start_time = process['start_time']
                end_time = process['end_time']
                
                rework_info.append({
                    'casing_id': casing_id,
                    'process_name': process_name,
                    'batch_id': batch_id,
                    'operator': operator,
                    'process_start': start_time,
                    'process_end': end_time,
                    'inspector': inspector,
                    'inspection_time': inspection_time,
                    'rework_reason': rework_reason
                })
    
    return rework_info

def generate_sample_data():
    data = {
        'casings': {},
        'processes': [],
        'inspections': []
    }
    
    samples = [
        {
            'casing_id': 'C001',
            'source': '顺丰物流',
            'model': '12R22.5',
            'spec': '295/80R22.5',
            'inbound_date': '2026-05-01',
            'initial_condition': '胎面磨损80%，胎侧无损伤'
        },
        {
            'casing_id': 'C002',
            'source': '圆通快递',
            'model': '12R22.5',
            'spec': '315/80R22.5',
            'inbound_date': '2026-05-02',
            'initial_condition': '胎面磨损70%，有一处小损伤'
        },
        {
            'casing_id': 'C003',
            'source': '中通快运',
            'model': '11R22.5',
            'spec': '275/80R22.5',
            'inbound_date': '2026-05-03',
            'initial_condition': '胎面磨损60%，胎体完好'
        }
    ]
    
    for s in samples:
        data['casings'][s['casing_id']] = s
    
    processes = [
        {'casing_id': 'C001', 'process_name': '初检', 'batch_id': 'B001', 'operator': '张三', 'start_time': '2026-05-01 09:00', 'end_time': '2026-05-01 09:30', 'status': '完成'},
        {'casing_id': 'C001', 'process_name': '打磨', 'batch_id': 'B002', 'operator': '李四', 'start_time': '2026-05-01 10:00', 'end_time': '2026-05-01 11:00', 'status': '完成'},
        {'casing_id': 'C001', 'process_name': '补洞', 'batch_id': 'B003', 'operator': '王五', 'start_time': '2026-05-01 14:00', 'end_time': '2026-05-01 15:00', 'status': '完成'},
        {'casing_id': 'C001', 'process_name': '硫化', 'batch_id': 'B004', 'operator': '赵六', 'start_time': '2026-05-02 08:00', 'end_time': '2026-05-02 10:00', 'status': '完成'},
        {'casing_id': 'C001', 'process_name': '终检', 'batch_id': 'B005', 'operator': '钱七', 'start_time': '2026-05-02 14:00', 'end_time': '2026-05-02 15:00', 'status': '完成'},
        
        {'casing_id': 'C002', 'process_name': '初检', 'batch_id': 'B001', 'operator': '张三', 'start_time': '2026-05-02 09:00', 'end_time': '2026-05-02 09:30', 'status': '完成'},
        {'casing_id': 'C002', 'process_name': '打磨', 'batch_id': 'B002', 'operator': '李四', 'start_time': '2026-05-02 10:00', 'end_time': '2026-05-02 11:00', 'status': '完成'},
        {'casing_id': 'C002', 'process_name': '补洞', 'batch_id': 'B006', 'operator': '王五', 'start_time': '2026-05-03 08:00', 'end_time': '2026-05-03 09:00', 'status': '完成'},
        {'casing_id': 'C002', 'process_name': '硫化', 'batch_id': 'B004', 'operator': '赵六', 'start_time': '2026-05-03 10:00', 'end_time': '2026-05-03 12:00', 'status': '完成'},
        
        {'casing_id': 'C003', 'process_name': '初检', 'batch_id': 'B007', 'operator': '孙八', 'start_time': '2026-05-04 09:00', 'end_time': '2026-05-04 09:30', 'status': '完成'},
        {'casing_id': 'C003', 'process_name': '打磨', 'batch_id': 'B008', 'operator': '周九', 'start_time': '2026-05-04 10:00', 'end_time': '2026-05-04 11:00', 'status': '完成'}
    ]
    
    data['processes'] = processes
    
    inspections = [
        {'casing_id': 'C001', 'process_name': '初检', 'inspection_time': '2026-05-01 09:35', 'inspector': '质检A', 'result': '合格', 'defect_desc': '', 'is_rework': False, 'rework_reason': ''},
        {'casing_id': 'C001', 'process_name': '打磨', 'inspection_time': '2026-05-01 11:15', 'inspector': '质检A', 'result': '合格', 'defect_desc': '', 'is_rework': False, 'rework_reason': ''},
        {'casing_id': 'C001', 'process_name': '补洞', 'inspection_time': '2026-05-01 15:20', 'inspector': '质检B', 'result': '合格', 'defect_desc': '', 'is_rework': False, 'rework_reason': ''},
        {'casing_id': 'C001', 'process_name': '硫化', 'inspection_time': '2026-05-02 10:30', 'inspector': '质检B', 'result': '不合格', 'defect_desc': '硫化不充分，有气泡', 'is_rework': True, 'rework_reason': '硫化时间不足，赵六操作失误'},
        {'casing_id': 'C001', 'process_name': '终检', 'inspection_time': '2026-05-02 15:30', 'inspector': '质检C', 'result': '合格', 'defect_desc': '', 'is_rework': False, 'rework_reason': ''},
        
        {'casing_id': 'C002', 'process_name': '初检', 'inspection_time': '2026-05-02 09:40', 'inspector': '质检A', 'result': '合格', 'defect_desc': '', 'is_rework': False, 'rework_reason': ''},
        {'casing_id': 'C002', 'process_name': '打磨', 'inspection_time': '2026-05-02 11:20', 'inspector': '质检A', 'result': '不合格', 'defect_desc': '打磨不均，有凹陷', 'is_rework': True, 'rework_reason': '李四打磨操作不规范'},
        {'casing_id': 'C002', 'process_name': '补洞', 'inspection_time': '2026-05-03 09:20', 'inspector': '质检B', 'result': '合格', 'defect_desc': '', 'is_rework': False, 'rework_reason': ''},
        {'casing_id': 'C002', 'process_name': '硫化', 'inspection_time': '2026-05-03 12:30', 'inspector': '质检B', 'result': '合格', 'defect_desc': '', 'is_rework': False, 'rework_reason': ''},
        
        {'casing_id': 'C003', 'process_name': '初检', 'inspection_time': '2026-05-04 09:45', 'inspector': '质检C', 'result': '合格', 'defect_desc': '', 'is_rework': False, 'rework_reason': ''},
        {'casing_id': 'C003', 'process_name': '打磨', 'inspection_time': '2026-05-04 11:25', 'inspector': '质检C', 'result': '合格', 'defect_desc': '', 'is_rework': False, 'rework_reason': ''}
    ]
    
    data['inspections'] = inspections
    
    return data

def generate_error_samples():
    samples_dir = DATA_DIR / 'error_samples'
    samples_dir.mkdir(parents=True, exist_ok=True)
    
    duplicate_data = generate_sample_data()
    duplicate_data['processes'].append({
        'casing_id': 'C001',
        'process_name': '初检',
        'batch_id': 'B001',
        'operator': '张三',
        'start_time': '2026-05-01 09:00',
        'end_time': '2026-05-01 09:30',
        'status': '完成'
    })
    with open(samples_dir / 'duplicate_data.json', 'w', encoding='utf-8') as f:
        json.dump(duplicate_data, f, ensure_ascii=False, indent=2)
    
    missing_field_data = generate_sample_data()
    missing_field_data['processes'].append({
        'casing_id': 'C003',
        'process_name': '补洞',
        'batch_id': '',
        'operator': '王五',
        'start_time': '2026-05-05 08:00',
        'end_time': '2026-05-05 09:00',
        'status': '完成'
    })
    missing_field_data['inspections'].append({
        'casing_id': 'C003',
        'process_name': '补洞',
        'inspection_time': '',
        'inspector': '质检A',
        'result': '合格'
    })
    with open(samples_dir / 'missing_fields.json', 'w', encoding='utf-8') as f:
        json.dump(missing_field_data, f, ensure_ascii=False, indent=2)
    
    manual_error_data = generate_sample_data()
    manual_error_data['processes'].append({
        'casing_id': 'C003',
        'process_name': '硫化',
        'batch_id': 'B009',
        'operator': '赵六',
        'start_time': '2026-05-05 10:00',
        'end_time': '2026-05-05 12:00',
        'status': '完成'
    })
    manual_error_data['inspections'].append({
        'casing_id': 'C003',
        'process_name': '硫化',
        'inspection_time': '2026-05-05 12:30',
        'inspector': '质检B',
        'result': '不合格',
        'defect_desc': '胎面粘合不牢',
        'is_rework': True,
        'rework_reason': '打磨工序问题（周九操作）- 人工修改原因为打磨问题而非硫化问题'
    })
    with open(samples_dir / 'manual_errors.json', 'w', encoding='utf-8') as f:
        json.dump(manual_error_data, f, ensure_ascii=False, indent=2)
    
    return samples_dir

@click.group()
def cli():
    pass

@cli.command()
def init():
    init_data()
    data = generate_sample_data()
    save_data(data)
    samples_dir = generate_error_samples()
    add_to_history('init', f'初始化样例数据完成，异常样例保存在 {samples_dir}')
    click.echo('✅ 初始化完成！')
    click.echo(f'📁 数据文件位置: {DATA_FILE}')
    click.echo(f'📁 异常样例位置: {samples_dir}')
    click.echo('')
    click.echo('📋 已初始化3条胎体档案:')
    for cid, casing in data['casings'].items():
        click.echo(f'  - {cid}: {casing["model"]} ({casing["source"]})')
    click.echo('')
    click.echo('🔧 已初始化12条工序记录')
    click.echo('📊 已初始化11条质检记录（含2条返修记录）')
    click.echo('')
    click.echo('⚠️  异常样例:')
    click.echo('  1. duplicate_data.json - 包含重复数据')
    click.echo('  2. missing_fields.json - 包含缺失字段')
    click.echo('  3. manual_errors.json - 包含人工修改的错误记录')

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--type', 'import_type', type=click.Choice(['json', 'csv']), default='json', help='导入文件类型')
def import_file(file_path, import_type):
    file_path = Path(file_path)
    if import_type == 'json':
        with open(file_path, 'r', encoding='utf-8') as f:
            import_data = json.load(f)
    else:
        import_data = {
            'casings': {},
            'processes': [],
            'inspections': []
        }
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record_type = row.get('type', '').lower()
                if record_type == 'casing':
                    cid = row.get('casing_id')
                    if cid:
                        import_data['casings'][cid] = {k: v for k, v in row.items() if k != 'type'}
                elif record_type == 'process':
                    import_data['processes'].append({k: v for k, v in row.items() if k != 'type'})
                elif record_type == 'inspection':
                    import_data['inspections'].append({k: v for k, v in row.items() if k != 'type'})
    
    current_data = load_data()
    merged_count = 0
    skipped_count = 0
    
    for cid, casing in import_data.get('casings', {}).items():
        if cid in current_data['casings']:
            skipped_count += 1
        else:
            current_data['casings'][cid] = casing
            merged_count += 1
    
    for proc in import_data.get('processes', []):
        current_data['processes'].append(proc)
        merged_count += 1
    
    for insp in import_data.get('inspections', []):
        current_data['inspections'].append(insp)
        merged_count += 1
    
    save_data(current_data)
    add_to_history('import', f'从 {file_path} 导入 {merged_count} 条记录，跳过 {skipped_count} 条重复胎体')
    
    click.echo(f'✅ 导入完成！')
    click.echo(f'📥 合并记录数: {merged_count}')
    click.echo(f'⏭️  跳过重复胎体数: {skipped_count}')
    click.echo(f'📄 来源文件: {file_path}')

@cli.command()
@click.option('--casing-id', help='指定胎体编号进行检查')
def check(casing_id):
    data = load_data()
    all_issues = []
    
    if casing_id:
        if casing_id not in data['casings']:
            click.echo(f'❌ 胎体 {casing_id} 不存在')
            return
        casings_to_check = [casing_id]
    else:
        casings_to_check = list(data['casings'].keys())
    
    click.echo('=' * 60)
    click.echo('🔍 轮胎翻新批次追溯检查报告')
    click.echo('=' * 60)
    click.echo('')
    
    click.echo('📋 一、数据完整性检查')
    click.echo('-' * 40)
    
    for cid in casings_to_check:
        casing = data['casings'][cid]
        missing = validate_casing(casing)
        if missing:
            issue = f'胎体 {cid} 缺失字段: {", ".join(missing)}'
            all_issues.append(('missing_field', issue))
            click.echo(f'  ❌ {issue}')
        else:
            click.echo(f'  ✅ 胎体 {cid} 档案完整')
    
    for proc in data['processes']:
        if casing_id and proc['casing_id'] != casing_id:
            continue
        missing = validate_process(proc)
        if missing:
            issue = f'胎体 {proc["casing_id"]} 工序 {proc["process_name"]} 缺失字段: {", ".join(missing)}'
            all_issues.append(('missing_field', issue))
            click.echo(f'  ❌ {issue}')
    
    for insp in data['inspections']:
        if casing_id and insp['casing_id'] != casing_id:
            continue
        missing = validate_inspection(insp)
        if missing:
            issue = f'胎体 {insp["casing_id"]} 质检 {insp["process_name"]} 缺失字段: {", ".join(missing)}'
            all_issues.append(('missing_field', issue))
            click.echo(f'  ❌ {issue}')
    
    click.echo('')
    click.echo('🔄 二、数据重复性检查')
    click.echo('-' * 40)
    
    duplicates = check_duplicates(data)
    if duplicates:
        for dup in duplicates:
            all_issues.append(('duplicate', dup))
            click.echo(f'  ❌ {dup}')
    else:
        click.echo('  ✅ 无重复数据')
    
    click.echo('')
    click.echo('🔗 三、数据一致性检查')
    click.echo('-' * 40)
    
    inconsistencies = check_consistency(data)
    if inconsistencies:
        for inc in inconsistencies:
            all_issues.append(('inconsistency', inc))
            click.echo(f'  ❌ {inc}')
    else:
        click.echo('  ✅ 数据一致性良好')
    
    click.echo('')
    click.echo('📊 四、工序流转检查')
    click.echo('-' * 40)
    click.echo(f'  标准工序流程: {" → ".join(PROCESSES)}')
    
    for cid in casings_to_check:
        flow_errors = check_process_flow(cid, data['processes'])
        if flow_errors:
            for err in flow_errors:
                all_issues.append(('flow', err))
                click.echo(f'  ❌ 胎体 {cid}: {err}')
        else:
            processes = [p['process_name'] for p in sorted([p for p in data['processes'] if p['casing_id'] == cid], key=lambda x: x['start_time'])]
            if processes:
                click.echo(f'  ✅ 胎体 {cid} 工序流转: {" → ".join(processes)}')
            else:
                click.echo(f'  ⚠️  胎体 {cid} 暂无工序记录')
    
    click.echo('')
    click.echo('🏭 五、返修责任定位')
    click.echo('-' * 40)
    
    reworks = check_rework_responsibility(data)
    if casing_id:
        reworks = [r for r in reworks if r['casing_id'] == casing_id]
    
    if reworks:
        for idx, rw in enumerate(reworks, 1):
            click.echo(f'  🔴 返修记录 #{idx}')
            click.echo(f'     胎体编号: {rw["casing_id"]}')
            click.echo(f'     问题工序: {rw["process_name"]}')
            click.echo(f'     批次编号: {rw["batch_id"]}')
            click.echo(f'     责任操作员: {rw["operator"]}')
            click.echo(f'     工序时间: {rw["process_start"]} 至 {rw["process_end"]}')
            click.echo(f'     质检人员: {rw["inspector"]}')
            click.echo(f'     质检时间: {rw["inspection_time"]}')
            click.echo(f'     返修原因: {rw["rework_reason"]}')
            click.echo('')
    else:
        click.echo('  ✅ 暂无返修记录')
    
    click.echo('')
    click.echo('=' * 60)
    click.echo(f'📊 检查总结:')
    click.echo(f'  发现问题总数: {len(all_issues)}')
    click.echo(f'  缺失字段问题: {len([i for i in all_issues if i[0] == "missing_field"])}')
    click.echo(f'  重复数据问题: {len([i for i in all_issues if i[0] == "duplicate"])}')
    click.echo(f'  一致性问题: {len([i for i in all_issues if i[0] == "inconsistency"])}')
    click.echo(f'  工序流转问题: {len([i for i in all_issues if i[0] == "flow"])}')
    click.echo(f'  返修记录数: {len(reworks)}')
    click.echo('=' * 60)
    
    add_to_history('check', f'检查完成，发现 {len(all_issues)} 个问题，{len(reworks)} 条返修记录')

@cli.command()
@click.option('--limit', default=10, help='显示最近N条记录')
def history(limit):
    history = load_history()
    if not history:
        click.echo('📭 暂无历史记录')
        return
    
    click.echo('=' * 60)
    click.echo('📜 操作历史记录')
    click.echo('=' * 60)
    click.echo('')
    
    for idx, entry in enumerate(reversed(history[-limit:]), 1):
        click.echo(f'[{len(history) - limit + idx}] {entry["timestamp"]}')
        click.echo(f'    操作: {entry["action"]}')
        click.echo(f'    详情: {entry["details"]}')
        click.echo('')

@cli.command()
@click.argument('output_path', type=click.Path())
@click.option('--format', 'export_format', type=click.Choice(['json', 'csv']), default='json', help='导出格式')
@click.option('--type', 'export_type', type=click.Choice(['all', 'casings', 'processes', 'inspections', 'reworks', 'check_report']), default='all', help='导出内容类型')
def export(output_path, export_format, export_type):
    data = load_data()
    output_path = Path(output_path)
    
    if export_type == 'all':
        export_data = data
    elif export_type == 'casings':
        export_data = {'casings': data['casings']}
    elif export_type == 'processes':
        export_data = {'processes': data['processes']}
    elif export_type == 'inspections':
        export_data = {'inspections': data['inspections']}
    elif export_type == 'reworks':
        export_data = {'reworks': check_rework_responsibility(data)}
    elif export_type == 'check_report':
        export_data = {
            'duplicates': check_duplicates(data),
            'inconsistencies': check_consistency(data),
            'reworks': check_rework_responsibility(data)
        }
    
    if export_format == 'json':
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
    else:
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            if export_type == 'all':
                writer.writerow(['type', 'casing_id', 'source', 'model', 'spec', 'inbound_date', 'initial_condition',
                               'process_name', 'batch_id', 'operator', 'start_time', 'end_time', 'status',
                               'inspection_time', 'inspector', 'result', 'defect_desc', 'is_rework', 'rework_reason'])
                
                for cid, casing in data['casings'].items():
                    writer.writerow(['casing', cid, casing.get('source', ''), casing.get('model', ''), 
                                   casing.get('spec', ''), casing.get('inbound_date', ''), 
                                   casing.get('initial_condition', ''), '', '', '', '', '', '', '', '', '', '', '', ''])
                
                for proc in data['processes']:
                    writer.writerow(['process', proc.get('casing_id', ''), '', '', '', '', '',
                                   proc.get('process_name', ''), proc.get('batch_id', ''), proc.get('operator', ''),
                                   proc.get('start_time', ''), proc.get('end_time', ''), proc.get('status', ''),
                                   '', '', '', '', '', ''])
                
                for insp in data['inspections']:
                    writer.writerow(['inspection', insp.get('casing_id', ''), '', '', '', '', '',
                                   insp.get('process_name', ''), '', '', '', '', '',
                                   insp.get('inspection_time', ''), insp.get('inspector', ''), 
                                   insp.get('result', ''), insp.get('defect_desc', ''),
                                   insp.get('is_rework', ''), insp.get('rework_reason', '')])
            
            elif export_type == 'reworks':
                reworks = check_rework_responsibility(data)
                writer.writerow(['casing_id', 'process_name', 'batch_id', 'operator', 
                               'process_start', 'process_end', 'inspector', 'inspection_time', 'rework_reason'])
                for rw in reworks:
                    writer.writerow([rw['casing_id'], rw['process_name'], rw['batch_id'], rw['operator'],
                                   rw['process_start'], rw['process_end'], rw['inspector'], 
                                   rw['inspection_time'], rw['rework_reason']])
    
    add_to_history('export', f'导出 {export_type} 数据到 {output_path} ({export_format} 格式)')
    
    click.echo(f'✅ 导出完成！')
    click.echo(f'📄 输出文件: {output_path}')
    click.echo(f'📊 导出内容: {export_type}')
    click.echo(f'📁 文件格式: {export_format}')

if __name__ == '__main__':
    cli()
