import csv
from io import StringIO
from typing import List
from datetime import datetime
from .models import LinenStatus, Inventory, Batch

class ReportExporter:
    @staticmethod
    def to_markdown(linen_list: List[LinenStatus], inventory_list: List[Inventory]) -> str:
        md = "# 布草周转报告\n\n"
        md += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md += "## 布草状态明细\n\n"
        md += "| RFID | 类型 | 房间 | 酒店 | 状态 | 送洗时间 | 回仓时间 |\n"
        md += "|------|------|------|------|------|----------|----------|\n"
        
        inv_dict = {inv.rfid: inv for inv in inventory_list}
        for linen in linen_list:
            inv = inv_dict.get(linen.rfid)
            rfid = linen.rfid
            type_ = inv.type if inv else "-"
            room = inv.room if inv else "-"
            hotel = inv.hotel if inv else "-"
            send_time = linen.send_time.strftime("%Y-%m-%d %H:%M") if linen.send_time else "-"
            receive_time = linen.receive_time.strftime("%Y-%m-%d %H:%M") if linen.receive_time else "-"
            md += f"| {rfid} | {type_} | {room} | {hotel} | {linen.status} | {send_time} | {receive_time} |\n"
        
        return md

    @staticmethod
    def to_csv(linen_list: List[LinenStatus], inventory_list: List[Inventory]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["RFID", "Type", "Room", "Hotel", "Status", "SendTime", "ReceiveTime"])
        
        inv_dict = {inv.rfid: inv for inv in inventory_list}
        for linen in linen_list:
            inv = inv_dict.get(linen.rfid)
            rfid = linen.rfid
            type_ = inv.type if inv else "-"
            room = inv.room if inv else "-"
            hotel = inv.hotel if inv else "-"
            send_time = linen.send_time.isoformat() if linen.send_time else ""
            receive_time = linen.receive_time.isoformat() if linen.receive_time else ""
            writer.writerow([rfid, type_, room, hotel, linen.status, send_time, receive_time])
        
        return output.getvalue()

    @staticmethod
    def anomalies_to_markdown(anomalies: List[dict]) -> str:
        md = "# 异常报告\n\n"
        md += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        
        for idx, anomaly in enumerate(anomalies, 1):
            md += f"## 异常 {idx}: {anomaly['type']}\n"
            md += f"- RFID: {anomaly.get('rfid', '-')}\n"
            md += f"- 描述: {anomaly.get('description', '')}\n"
            if 'batch_id' in anomaly:
                md += f"- 批次: {anomaly['batch_id']}\n"
            md += "\n"
        
        return md
