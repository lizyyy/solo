"""export 子命令：导出结果"""

import click
import json
import os
import pandas as pd
from ..utils import (
    load_data_store, print_header, print_status
)


@click.command("export")
@click.argument("output_path", type=click.Path())
@click.option("--type", "-t", 
              type=click.Choice(["all", "gardens", "rainfall", "ponding", "plant", 
                                "inspection", "check"]),
              default="all", help="导出数据类型")
@click.option("--format", "-f", 
              type=click.Choice(["json", "csv", "excel"]),
              default="json", help="导出格式")
def export_cmd(output_path, type, format):
    """导出数据到文件

    支持 JSON、CSV 和 Excel 格式。
    """
    print_header("导出数据")
    
    store = load_data_store()
    
    if not store.gardens:
        print_status("未找到数据，请先运行 'rain-garden init'", "ERROR")
        return
    
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    export_data = {}
    
    if type in ["all", "gardens"]:
        export_data["gardens"] = [g.to_dict() for g in store.gardens.values()]
    
    if type in ["all", "rainfall"]:
        export_data["rainfall_records"] = [r.to_dict() for r in store.rainfall_records.values()]
    
    if type in ["all", "ponding"]:
        export_data["ponding_records"] = [r.to_dict() for r in store.ponding_records.values()]
    
    if type in ["all", "plant"]:
        export_data["plant_status"] = [p.to_dict() for p in store.plant_status.values()]
    
    if type in ["all", "inspection"]:
        export_data["inspection_schedules"] = [s.to_dict() for s in store.inspection_schedules.values()]
    
    if type in ["all", "check"]:
        export_data["check_results"] = [c.to_dict() for c in store.check_results]
    
    total_records = sum(len(v) for v in export_data.values())
    
    try:
        if format == "json":
            if not output_path.endswith('.json'):
                output_path += '.json'
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
        
        elif format == "csv":
            if not output_path.endswith('.csv'):
                output_path += '.csv'
            
            all_rows = []
            for category, records in export_data.items():
                for record in records:
                    row = {"category": category}
                    row.update(record)
                    all_rows.append(row)
            
            if all_rows:
                df = pd.DataFrame(all_rows)
                df.to_csv(output_path, index=False, encoding='utf-8-sig')
            else:
                pd.DataFrame().to_csv(output_path, index=False)
        
        else:
            if not output_path.endswith('.xlsx'):
                output_path += '.xlsx'
            
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                for sheet_name, records in export_data.items():
                    if records:
                        df = pd.DataFrame(records)
                        df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        print_status(f"成功导出 {total_records} 条记录", "SUCCESS")
        print_status(f"文件已保存到: {output_path}", "INFO")
        
        if format == "excel":
            for sheet_name, records in export_data.items():
                if records:
                    print_status(f"  - 工作表 '{sheet_name}': {len(records)} 条", "INFO")
    
    except Exception as e:
        print_status(f"导出失败: {e}", "ERROR")
        return
    
    click.echo()
    print_status("导出完成！", "SUCCESS")
