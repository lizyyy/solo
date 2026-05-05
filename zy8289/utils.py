import re
import csv
from datetime import datetime
from typing import List, Dict, Any
import tkinter as tk
from tkinter import filedialog, messagebox

def validate_phone(phone: str) -> bool:
    if not phone:
        return False
    pattern = r'^1[3-9]\d{9}$'
    return bool(re.match(pattern, phone.strip()))

def validate_date_time(date_str: str) -> bool:
    if not date_str:
        return False
    try:
        datetime.strptime(date_str, '%Y-%m-%d %H:%M')
        return True
    except ValueError:
        return False

def validate_people_count(count_str: str) -> bool:
    if not count_str:
        return False
    try:
        count = int(count_str)
        return count > 0 and count <= 1000
    except ValueError:
        return False

def validate_time_range(start_str: str, end_str: str) -> bool:
    if not validate_date_time(start_str) or not validate_date_time(end_str):
        return False
    start = datetime.strptime(start_str, '%Y-%m-%d %H:%M')
    end = datetime.strptime(end_str, '%Y-%m-%d %H:%M')
    return start < end

def format_datetime(dt_str: str) -> str:
    try:
        dt = datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S')
        return dt.strftime('%Y-%m-%d %H:%M')
    except ValueError:
        return dt_str

def format_time_range(start_str: str, end_str: str) -> str:
    try:
        start = datetime.strptime(start_str, '%Y-%m-%d %H:%M')
        end = datetime.strptime(end_str, '%Y-%m-%d %H:%M')
        if start.date() == end.date():
            return f"{start.strftime('%Y-%m-%d')} {start.strftime('%H:%M')}-{end.strftime('%H:%M')}"
        else:
            return f"{start.strftime('%Y-%m-%d %H:%M')} 至 {end.strftime('%Y-%m-%d %H:%M')}"
    except ValueError:
        return f"{start_str} - {end_str}"

def export_to_csv(reservations: List[Dict[str, Any]], parent=None) -> bool:
    if not reservations:
        if parent:
            messagebox.showwarning("警告", "没有可导出的数据")
        return False
    
    file_path = filedialog.asksaveasfilename(
        parent=parent,
        title="导出 CSV 文件",
        defaultextension=".csv",
        filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
    )
    
    if not file_path:
        return False
    
    try:
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                'ID', '活动名称', '负责人', '手机号', '场地',
                '开始时间', '结束时间', '人数', '备注', '状态'
            ])
            
            for r in reservations:
                writer.writerow([
                    r.get('id', ''),
                    r.get('activity_name', ''),
                    r.get('responsible_person', ''),
                    r.get('phone', ''),
                    r.get('venue', ''),
                    r.get('date_time_start', ''),
                    r.get('date_time_end', ''),
                    r.get('people_count', ''),
                    r.get('remarks', ''),
                    r.get('status', '')
                ])
        
        if parent:
            messagebox.showinfo("成功", f"已成功导出到: {file_path}")
        return True
    except Exception as e:
        if parent:
            messagebox.showerror("错误", f"导出失败: {str(e)}")
        return False

def export_to_markdown(reservations: List[Dict[str, Any]], parent=None) -> bool:
    if not reservations:
        if parent:
            messagebox.showwarning("警告", "没有可导出的数据")
        return False
    
    file_path = filedialog.asksaveasfilename(
        parent=parent,
        title="导出 Markdown 文件",
        defaultextension=".md",
        filetypes=[("Markdown 文件", "*.md"), ("所有文件", "*.*")]
    )
    
    if not file_path:
        return False
    
    try:
        today = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        md_content = f"# 场地预约清单\n\n"
        md_content += f"> 导出时间: {today}\n\n"
        md_content += f"## 预约列表\n\n"
        md_content += "| ID | 活动名称 | 负责人 | 手机号 | 场地 | 时间 | 人数 | 状态 |\n"
        md_content += "|----|----------|--------|--------|------|------|------|------|\n"
        
        for r in reservations:
            time_range = format_time_range(
                r.get('date_time_start', ''),
                r.get('date_time_end', '')
            )
            md_content += (
                f"| {r.get('id', '')} | "
                f"{r.get('activity_name', '')} | "
                f"{r.get('responsible_person', '')} | "
                f"{r.get('phone', '')} | "
                f"{r.get('venue', '')} | "
                f"{time_range} | "
                f"{r.get('people_count', '')} | "
                f"{r.get('status', '')} |\n"
            )
        
        if reservations:
            md_content += "\n## 详细信息\n\n"
            for r in reservations:
                md_content += f"### {r.get('activity_name', '未知活动')}\n\n"
                md_content += f"- **ID**: {r.get('id', '')}\n"
                md_content += f"- **负责人**: {r.get('responsible_person', '')}\n"
                md_content += f"- **联系电话**: {r.get('phone', '')}\n"
                md_content += f"- **场地**: {r.get('venue', '')}\n"
                md_content += f"- **开始时间**: {r.get('date_time_start', '')}\n"
                md_content += f"- **结束时间**: {r.get('date_time_end', '')}\n"
                md_content += f"- **人数**: {r.get('people_count', '')}\n"
                md_content += f"- **状态**: {r.get('status', '')}\n"
                if r.get('remarks'):
                    md_content += f"- **备注**: {r.get('remarks', '')}\n"
                md_content += "\n"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        if parent:
            messagebox.showinfo("成功", f"已成功导出到: {file_path}")
        return True
    except Exception as e:
        if parent:
            messagebox.showerror("错误", f"导出失败: {str(e)}")
        return False

def get_status_color(status: str) -> str:
    color_map = {
        '待确认': '#FFA500',
        '已确认': '#008000',
        '已取消': '#FF0000',
        '已完成': '#808080'
    }
    return color_map.get(status, '#000000')
