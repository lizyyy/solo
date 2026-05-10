import argparse
import json
from pathlib import Path

from warranty_claim_cli.utils.storage import (
    load_devices,
    save_devices,
    load_failures,
    save_failures,
    load_inspections,
    save_inspections,
    load_warranties,
    save_warranties,
    load_materials,
    save_materials,
    load_claims,
)
from warranty_claim_cli.models.claim_engine import (
    evaluate_claim,
    ClaimStatus,
    RejectReason
)

DATA_TYPES = {
    "devices": {
        "loader": load_devices,
        "saver": save_devices,
        "id_field": "device_id",
        "display_name": "设备台账"
    },
    "failures": {
        "loader": load_failures,
        "saver": save_failures,
        "id_field": "failure_id",
        "display_name": "故障记录"
    },
    "inspections": {
        "loader": load_inspections,
        "saver": save_inspections,
        "id_field": "inspection_id",
        "display_name": "维修鉴定"
    },
    "warranties": {
        "loader": load_warranties,
        "saver": save_warranties,
        "id_field": "warranty_id",
        "display_name": "保修条款"
    },
    "materials": {
        "loader": load_materials,
        "saver": save_materials,
        "id_field": "material_id",
        "display_name": "索赔材料"
    }
}

def setup_parser(subparsers):
    parser = subparsers.add_parser(
        "import",
        help="导入索赔相关数据（设备、故障、鉴定、条款、材料）"
    )
    parser.add_argument(
        "--type",
        choices=list(DATA_TYPES.keys()),
        required=True,
        help="数据类型"
    )
    parser.add_argument(
        "--file",
        required=True,
        help="JSON 文件路径"
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="替换现有数据（默认为合并）"
    )
    return parser

def merge_data(existing, new_data, id_field):
    existing_map = {item[id_field]: item for item in existing if id_field in item}
    for item in new_data:
        if id_field in item:
            existing_map[item[id_field]] = item
    return list(existing_map.values())

def execute(args):
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误: 文件不存在: {file_path}")
        return 1
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            new_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"错误: JSON 格式无效: {e}")
        return 1
    
    if not isinstance(new_data, list):
        print("错误: 数据必须是列表格式")
        return 1
    
    data_type = DATA_TYPES[args.type]
    loader = data_type["loader"]
    saver = data_type["saver"]
    id_field = data_type["id_field"]
    display_name = data_type["display_name"]
    
    existing = loader()
    
    if args.replace:
        final_data = new_data
        print(f"替换 {display_name}，共 {len(new_data)} 条记录")
    else:
        final_data = merge_data(existing, new_data, id_field)
        added = len(final_data) - len(existing)
        print(f"导入 {display_name}，新增 {added} 条，合计 {len(final_data)} 条")
    
    saver(final_data)
    
    if args.type == "failures":
        print("\n提示: 导入了故障记录，您可以使用 'check' 命令检查索赔状态")
    
    return 0
