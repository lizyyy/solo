import argparse
import uuid

from warranty_claim_cli.utils.storage import (
    load_devices,
    save_devices,
)

def setup_parser(subparsers):
    parser = subparsers.add_parser(
        "devices",
        help="设备台账管理（亲手添加、查看、编辑设备信息）"
    )
    sub = parser.add_subparsers(dest="subcommand", help="设备台账操作")
    
    list_p = sub.add_parser("list", help="列出所有设备")
    list_p.add_argument("--search", help="按关键词搜索设备")
    
    add_p = sub.add_parser("add", help="添加新设备（交互式）")
    
    view_p = sub.add_parser("view", help="查看设备详情")
    view_p.add_argument("--device-id", required=True, help="设备 ID")
    
    del_p = sub.add_parser("delete", help="删除设备")
    del_p.add_argument("--device-id", required=True, help="设备 ID")
    
    return parser

def list_devices(search=None):
    devices = load_devices()
    if search:
        devices = [d for d in devices if search.lower() in str(d).lower()]
    
    if not devices:
        print("暂无设备记录")
        print("使用 'devices add' 命令添加设备")
        return
    
    print(f"\n设备台账列表（共 {len(devices)} 台）")
    print("-" * 100)
    print(f"{'设备 ID':<12} {'设备名称':<20} {'序列号':<20} {'品牌':<12} {'型号':<12} {'采购日期':<12}")
    print("-" * 100)
    
    for d in devices:
        print(f"{d.get('device_id', '')[:10]:<12} "
              f"{d.get('device_name', '')[:18]:<20} "
              f"{d.get('serial_number', '')[:18]:<20} "
              f"{d.get('brand', '')[:10]:<12} "
              f"{d.get('model', '')[:10]:<12} "
              f"{d.get('purchase_date', ''):<12}")
    
    print("-" * 100)
    print(f"详细查看: devices view --device-id <设备ID>")

def view_device(device_id):
    devices = load_devices()
    device = None
    for d in devices:
        if d.get('device_id') == device_id:
            device = d
            break
    
    if not device:
        print(f"错误: 未找到设备: {device_id}")
        return 1
    
    print(f"\n设备详情")
    print("=" * 60)
    print(f"设备 ID: {device.get('device_id', '未知')}")
    print(f"设备名称: {device.get('device_name', '未知')}")
    print(f"序列号: {device.get('serial_number', '未知')}")
    print(f"设备类型: {device.get('device_type', '未知')}")
    print(f"品牌: {device.get('brand', '未知')}")
    print(f"型号: {device.get('model', '未知')}")
    print(f"采购日期: {device.get('purchase_date', '未知')}")
    if device.get('supplier'):
        print(f"供应商: {device.get('supplier', '未知')}")
    if device.get('purchase_price'):
        print(f"采购价格: {device.get('purchase_price', '未知')}")
    if device.get('notes'):
        print(f"备注: {device.get('notes', '')}")
    print("=" * 60)
    return 0

def add_device_interactive():
    print("\n=== 添加新设备 ===")
    print("请按提示输入设备信息（留空使用默认值）")
    print()
    
    device = {}
    
    device_id = input("设备 ID (自动生成或自定义): ").strip()
    if not device_id:
        device_id = f"DEV-{uuid.uuid4().hex[:6].upper()}"
        print(f"  自动生成: {device_id}")
    device['device_id'] = device_id
    
    while True:
        device_name = input("设备名称 *: ").strip()
        if device_name:
            device['device_name'] = device_name
            break
        print("  错误: 设备名称不能为空")
    
    serial_number = input("序列号: ").strip()
    if serial_number:
        device['serial_number'] = serial_number
    
    while True:
        device_type = input("设备类型 * (如: 笔记本电脑/服务器/打印机): ").strip()
        if device_type:
            device['device_type'] = device_type
            break
        print("  错误: 设备类型不能为空")
    
    brand = input("品牌: ").strip()
    if brand:
        device['brand'] = brand
    
    model = input("型号: ").strip()
    if model:
        device['model'] = model
    
    while True:
        purchase_date = input("采购日期 * (格式: YYYY-MM-DD): ").strip()
        if purchase_date:
            device['purchase_date'] = purchase_date
            break
        print("  错误: 采购日期不能为空")
    
    supplier = input("供应商: ").strip()
    if supplier:
        device['supplier'] = supplier
    
    purchase_price = input("采购价格: ").strip()
    if purchase_price:
        device['purchase_price'] = purchase_price
    
    notes = input("备注: ").strip()
    if notes:
        device['notes'] = notes
    
    print()
    print("=" * 60)
    print("确认设备信息:")
    for key, value in device.items():
        print(f"  {key}: {value}")
    print("=" * 60)
    
    confirm = input("确认添加? (y/N): ").strip().lower()
    if confirm in ['y', 'yes']:
        devices = load_devices()
        devices.append(device)
        save_devices(devices)
        print(f"\n✓ 设备 {device_id} 已添加到设备台账")
        print(f"  现在可以使用 'failures add' 为该设备添加故障记录")
        return 0
    else:
        print("\n已取消添加")
        return 1

def delete_device(device_id):
    devices = load_devices()
    device = None
    for d in devices:
        if d.get('device_id') == device_id:
            device = d
            break
    
    if not device:
        print(f"错误: 未找到设备: {device_id}")
        return 1
    
    print(f"确认删除设备:")
    print(f"  设备 ID: {device['device_id']}")
    print(f"  设备名称: {device.get('device_name', '')}")
    print(f"  序列号: {device.get('serial_number', '')}")
    
    confirm = input("确认删除? 此操作不可恢复 (type 'DELETE' to confirm): ").strip()
    if confirm == 'DELETE':
        devices = [d for d in devices if d.get('device_id') != device_id]
        save_devices(devices)
        print(f"\n✓ 设备 {device_id} 已删除")
        return 0
    else:
        print("\n已取消删除")
        return 1

def execute(args):
    if args.subcommand is None:
        list_devices()
        return 0
    
    if args.subcommand == "list":
        list_devices(getattr(args, 'search', None))
        return 0
    
    elif args.subcommand == "add":
        return add_device_interactive()
    
    elif args.subcommand == "view":
        return view_device(args.device_id)
    
    elif args.subcommand == "delete":
        return delete_device(args.device_id)
    
    return 0
