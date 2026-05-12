"""import 子命令：导入文件"""

import click
import os
import pandas as pd
from ..models import RainfallRecord, PondingRecord
from ..utils import (
    load_data_store, save_data_store, get_now_str,
    generate_id, print_header, print_status
)


def validate_data_type(value):
    if value not in ["rainfall", "ponding"]:
        raise click.BadParameter("数据类型必须是 'rainfall' 或 'ponding'")
    return value


@click.command("import")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--type", "-t", required=True, 
              type=click.Choice(["rainfall", "ponding"]),
              help="数据类型: rainfall(降雨) 或 ponding(积水)")
@click.option("--format", "-f", default="auto", 
              type=click.Choice(["auto", "csv", "excel"]),
              help="文件格式: auto(自动检测), csv, excel")
@click.option("--source", "-s", default="导入", 
              help="数据源名称")
def import_cmd(file_path, type, format, source):
    """导入降雨或积水数据文件

    支持 CSV 和 Excel 格式。降雨数据需要包含: garden_id, date, rainfall
    积水数据需要包含: garden_id, date, depth, duration, location, recorder
    """
    print_header(f"导入{ '降雨' if type == 'rainfall' else '积水' }数据")
    
    store = load_data_store()
    
    if not store.gardens:
        print_status("未找到雨水花园数据，请先运行 'rain-garden init'", "ERROR")
        return
    
    if format == "auto":
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.csv']:
            format = "csv"
        elif ext in ['.xlsx', '.xls']:
            format = "excel"
        else:
            print_status(f"无法自动识别文件格式: {ext}", "ERROR")
            return
    
    try:
        if format == "csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        print_status(f"读取文件失败: {e}", "ERROR")
        return
    
    print_status(f"读取到 {len(df)} 行数据", "INFO")
    
    success_count = 0
    skip_count = 0
    error_count = 0
    
    for idx, row in df.iterrows():
        try:
            garden_id = str(row.get("garden_id", "")).strip()
            
            if not garden_id:
                print_status(f"第 {idx+2} 行: 缺少 garden_id，跳过", "WARNING")
                skip_count += 1
                continue
            
            if garden_id not in store.gardens:
                print_status(f"第 {idx+2} 行: garden_id '{garden_id}' 不存在，跳过", "WARNING")
                skip_count += 1
                continue
            
            if type == "rainfall":
                date = str(row.get("date", "")).strip()
                rainfall = float(row.get("rainfall", 0))
                
                record = RainfallRecord(
                    id=generate_id("rain-"),
                    garden_id=garden_id,
                    date=date,
                    rainfall=rainfall,
                    source=source,
                    import_time=get_now_str(),
                    is_verified=False
                )
                store.rainfall_records[record.id] = record
            else:
                date = str(row.get("date", "")).strip()
                depth = float(row.get("depth", 0))
                duration = float(row.get("duration", 0))
                location = str(row.get("location", "")).strip()
                recorder = str(row.get("recorder", "")).strip()
                photo = row.get("photo_reference")
                photo_ref = str(photo).strip() if photo else None
                
                record = PondingRecord(
                    id=generate_id("pond-"),
                    garden_id=garden_id,
                    date=date,
                    depth=depth,
                    duration=duration,
                    location=location,
                    recorder=recorder,
                    photo_reference=photo_ref,
                    is_matched=False
                )
                store.ponding_records[record.id] = record
            
            success_count += 1
            
        except Exception as e:
            print_status(f"第 {idx+2} 行: 处理失败 - {e}", "ERROR")
            error_count += 1
    
    save_data_store(store)
    
    print_status(f"成功导入: {success_count} 条", "SUCCESS")
    print_status(f"跳过: {skip_count} 条", "INFO")
    print_status(f"失败: {error_count} 条", "INFO")
    
    if error_count > 0:
        print_status("存在失败记录，请检查数据后重新导入", "WARNING")
