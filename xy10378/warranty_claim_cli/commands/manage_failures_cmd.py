import argparse
import uuid

from warranty_claim_cli.utils.storage import (
    load_devices,
    load_failures,
    save_failures,
)

def setup_parser(subparsers):
    parser = subparsers.add_parser(
        "failures",
        help="故障记录管理（亲手添加、查看、编辑故障信息）"
    )
    sub = parser.add_subparsers(dest="subcommand", help="故障记录操作")
    
    list_p = sub.add_parser("list", help="列出所有故障记录")
    list_p.add_argument("--device-id", help="按设备 ID 筛选")
    
    add_p = sub.add_parser("add", help="添加新故障记录（交互式）")
    
    view_p = sub.add_parser("view", help="查看故障详情")
    view_p.add_argument("--failure-id", required=True, help="故障 ID")
    
    del_p = sub.add_parser("delete", help="删除故障记录")
    del_p.add_argument("--failure-id", required=True, help="故障 ID")
    
    return parser

def list_failures(device_id=None):
    failures = load_failures()
    devices = load_devices()
    device_map = {d.get('device_id'): d for d in devices}
    
    if device_id:
        failures = [f for f in failures if f.get('device_id') == device_id]
    
    if not failures:
        print("暂无故障记录")
        print("使用 'failures add' 命令添加故障记录")
        return
    
    print(f"\n故障记录列表（共 {len(failures)} 条）")
    print("-" * 90)
    print(f"{'故障 ID':<12} {'设备 ID':<12} {'故障日期':<12} {'故障类型':<15} {'状态':<10}")
    print("-" * 90)
    
    for f in failures:
        device = device_map.get(f.get('device_id'), {})
        device_name = device.get('device_name', f.get('device_id', ''))
        
        print(f"{f.get('failure_id', '')[:10]:<12} "
              f"{device_name[:10]:<12} "
              f"{f.get('failure_date', ''):<12} "
              f"{f.get('failure_type', '')[:13]:<15} "
              f"{f.get('status', '未处理'):<10}")
    
    print("-" * 90)
    print(f"详细查看: failures view --failure-id <故障ID>")
    print(f"检查索赔状态: check --failure-id <故障ID>")

def view_failure(failure_id):
    failures = load_failures()
    devices = load_devices()
    device_map = {d.get('device_id'): d for d in devices}
    
    failure = None
    for f in failures:
        if f.get('failure_id') == failure_id:
            failure = f
            break
    
    if not failure:
        print(f"错误: 未找到故障记录: {failure_id}")
        return 1
    
    device = device_map.get(failure.get('device_id'), {})
    
    print(f"\n故障详情")
    print("=" * 60)
    print(f"故障 ID: {failure.get('failure_id', '未知')}")
    print(f"设备 ID: {failure.get('device_id', '未知')}")
    if device:
        print(f"设备名称: {device.get('device_name', '')}")
        print(f"序列号: {device.get('serial_number', '')}")
        print(f"品牌型号: {device.get('brand', '')} {device.get('model', '')}")
        print(f"采购日期: {device.get('purchase_date', '')}")
    
    print(f"\n故障信息:")
    print(f"  故障日期: {failure.get('failure_date', '未知')}")
    print(f"  故障类型: {failure.get('failure_type', '未知')}")
    print(f"  故障描述: {failure.get('description', '无')}")
    print(f"  发现人: {failure.get('reporter', '未知')}")
    print(f"  状态: {failure.get('status', '未处理')}")
    
    if failure.get('notes'):
        print(f"  备注: {failure.get('notes', '')}")
    
    print("=" * 60)
    print(f"检查索赔状态: python -m warranty_claim_cli.main check --failure-id {failure_id}")
    return 0

def add_failure_interactive():
    devices = load_devices()
    
    print("\n=== 添加新故障记录 ===")
    print("请按提示输入故障信息")
    print()
    
    if not devices:
        print("错误: 暂无设备记录，请先使用 'devices add' 添加设备")
        print()
        print("提示: 您可以先添加设备，再添加故障记录")
        print("  devices add")
        return 1
    
    print("现有设备列表:")
    for idx, d in enumerate(devices[:10], 1):
        print(f"  {idx}. {d.get('device_id', '')} - {d.get('device_name', '')}")
    if len(devices) > 10:
        print(f"  ... 还有 {len(devices) - 10} 台设备")
    print()
    
    while True:
        device_id = input("设备 ID *: ").strip()
        if not device_id:
            print("  错误: 设备 ID 不能为空")
            continue
        
        device_exists = any(d.get('device_id') == device_id for d in devices)
        if not device_exists:
            print(f"  错误: 设备 ID {device_id} 不存在")
            continue
        break
    
    failure = {}
    failure['device_id'] = device_id
    
    failure_id = input("故障 ID (自动生成或自定义): ").strip()
    if not failure_id:
        failure_id = f"F-{uuid.uuid4().hex[:6].upper()}"
        print(f"  自动生成: {failure_id}")
    failure['failure_id'] = failure_id
    
    while True:
        failure_date = input("故障日期 * (格式: YYYY-MM-DD): ").strip()
        if failure_date:
            failure['failure_date'] = failure_date
            break
        print("  错误: 故障日期不能为空")
    
    while True:
        failure_type = input("故障类型 * (如: 无法开机/屏幕故障/硬件损坏): ").strip()
        if failure_type:
            failure['failure_type'] = failure_type
            break
        print("  错误: 故障类型不能为空")
    
    description = input("故障描述 *: ").strip()
    if description:
        failure['description'] = description
    else:
        print("  警告: 故障描述为空")
        failure['description'] = ""
    
    reporter = input("发现人: ").strip()
    if reporter:
        failure['reporter'] = reporter
    
    status = input("状态 (默认: 未处理): ").strip()
    if not status:
        status = "未处理"
    failure['status'] = status
    
    notes = input("备注: ").strip()
    if notes:
        failure['notes'] = notes
    
    print()
    print("=" * 60)
    print("确认故障信息:")
    for key, value in failure.items():
        print(f"  {key}: {value}")
    print("=" * 60)
    
    confirm = input("确认添加? (y/N): ").strip().lower()
    if confirm in ['y', 'yes']:
        failures = load_failures()
        failures.append(failure)
        save_failures(failures)
        print(f"\n✓ 故障记录 {failure_id} 已添加")
        print(f"  下一步:")
        print(f"    1. 使用 'check --failure-id {failure_id}' 检查索赔状态")
        print(f"    2. 使用 'supplement' 补充维修鉴定和材料")
        return 0
    else:
        print("\n已取消添加")
        return 1

def delete_failure(failure_id):
    failures = load_failures()
    failure = None
    for f in failures:
        if f.get('failure_id') == failure_id:
            failure = f
            break
    
    if not failure:
        print(f"错误: 未找到故障记录: {failure_id}")
        return 1
    
    print(f"确认删除故障记录:")
    print(f"  故障 ID: {failure['failure_id']}")
    print(f"  设备 ID: {failure.get('device_id', '')}")
    print(f"  故障日期: {failure.get('failure_date', '')}")
    print(f"  故障类型: {failure.get('failure_type', '')}")
    
    confirm = input("确认删除? 此操作不可恢复 (type 'DELETE' to confirm): ").strip()
    if confirm == 'DELETE':
        failures = [f for f in failures if f.get('failure_id') != failure_id]
        save_failures(failures)
        print(f"\n✓ 故障记录 {failure_id} 已删除")
        return 0
    else:
        print("\n已取消删除")
        return 1

def execute(args):
    if args.subcommand is None:
        list_failures()
        return 0
    
    if args.subcommand == "list":
        list_failures(getattr(args, 'device_id', None))
        return 0
    
    elif args.subcommand == "add":
        return add_failure_interactive()
    
    elif args.subcommand == "view":
        return view_failure(args.failure_id)
    
    elif args.subcommand == "delete":
        return delete_failure(args.failure_id)
    
    return 0
