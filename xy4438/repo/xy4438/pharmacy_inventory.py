#!/usr/bin/env python3
"""
社区药房冷藏药品盘点工具
用于暴雨停电后盘点冷藏药品，计算超温时长，判定药品状态
"""

import csv
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

import click
from flask import Flask, request, jsonify


class DrugStatus(Enum):
    AVAILABLE = "可售"
    QUARANTINE = "需隔离"
    DAMAGED = "需报损"


@dataclass
class TemperatureRecord:
    timestamp: datetime
    temperature: float
    fridge_id: str


@dataclass
class DrugBatch:
    batch_number: str
    drug_name: str
    specification: str
    quantity: int
    fridge_id: str
    min_temp: float = 2.0
    max_temp: float = 8.0
    max_overtemp_duration: int = 120


@dataclass
class Reservation:
    batch_number: str
    customer_name: str
    customer_phone: str
    reserved_quantity: int
    reservation_time: datetime


@dataclass
class InventoryResult:
    batch_number: str
    drug_name: str
    specification: str
    total_quantity: int
    available_quantity: int
    reserved_quantity: int
    overtemperature_duration: int
    max_temperature: float
    min_temperature: float
    status: DrugStatus
    review_comment: str = ""
    reviewer: str = ""
    review_time: Optional[datetime] = None


class InventorySystem:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.temp_records: Dict[str, List[TemperatureRecord]] = {}
        self.drug_batches: Dict[str, DrugBatch] = {}
        self.reservations: List[Reservation] = []
        self.results: Dict[str, InventoryResult] = {}
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def load_temperature_csv(self, filepath: str):
        """导入冰箱温度记录CSV"""
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                fridge_id = row.get('fridge_id', 'default')
                timestamp = datetime.fromisoformat(row['timestamp'])
                temperature = float(row['temperature'])
                
                record = TemperatureRecord(
                    timestamp=timestamp,
                    temperature=temperature,
                    fridge_id=fridge_id
                )
                
                if fridge_id not in self.temp_records:
                    self.temp_records[fridge_id] = []
                self.temp_records[fridge_id].append(record)
        
        for fridge_id in self.temp_records:
            self.temp_records[fridge_id].sort(key=lambda x: x.timestamp)
        
        click.echo(f"已加载温度记录，共 {len(self.temp_records)} 个冰箱")

    def load_drug_csv(self, filepath: str):
        """导入药品批号表CSV"""
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                batch = DrugBatch(
                    batch_number=row['batch_number'],
                    drug_name=row['drug_name'],
                    specification=row.get('specification', ''),
                    quantity=int(row['quantity']),
                    fridge_id=row.get('fridge_id', 'default'),
                    min_temp=float(row.get('min_temp', 2.0)),
                    max_temp=float(row.get('max_temp', 8.0)),
                    max_overtemp_duration=int(row.get('max_overtemp_duration', 120))
                )
                self.drug_batches[batch.batch_number] = batch
        
        click.echo(f"已加载药品批号表，共 {len(self.drug_batches)} 个批号")

    def load_reservation_csv(self, filepath: str):
        """导入顾客预留单CSV"""
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                reservation = Reservation(
                    batch_number=row['batch_number'],
                    customer_name=row['customer_name'],
                    customer_phone=row['customer_phone'],
                    reserved_quantity=int(row['reserved_quantity']),
                    reservation_time=datetime.fromisoformat(row['reservation_time'])
                )
                self.reservations.append(reservation)
        
        click.echo(f"已加载顾客预留单，共 {len(self.reservations)} 条记录")

    def calculate_overtemperature(self, batch: DrugBatch) -> Dict[str, Any]:
        """计算超温时长和温度极值"""
        fridge_id = batch.fridge_id
        if fridge_id not in self.temp_records:
            return {
                'overtemp_duration': 0,
                'max_temp': None,
                'min_temp': None
            }
        
        records = self.temp_records[fridge_id]
        if not records:
            return {
                'overtemp_duration': 0,
                'max_temp': None,
                'min_temp': None
            }
        
        overtemp_duration = 0
        temps = [r.temperature for r in records]
        max_temp = max(temps)
        min_temp = min(temps)
        
        for i in range(1, len(records)):
            prev_record = records[i-1]
            curr_record = records[i]
            
            prev_overtemp = (prev_record.temperature < batch.min_temp or 
                           prev_record.temperature > batch.max_temp)
            curr_overtemp = (curr_record.temperature < batch.min_temp or 
                           curr_record.temperature > batch.max_temp)
            
            if prev_overtemp and curr_overtemp:
                time_diff = (curr_record.timestamp - prev_record.timestamp).total_seconds() / 60
                overtemp_duration += time_diff
        
        return {
            'overtemp_duration': round(overtemp_duration),
            'max_temp': max_temp,
            'min_temp': min_temp
        }

    def determine_status(self, overtemp_duration: int, max_temp: Optional[float], 
                        min_temp: Optional[float], batch: DrugBatch) -> DrugStatus:
        """判定药品状态"""
        if max_temp is None or min_temp is None:
            return DrugStatus.QUARANTINE
        
        extreme_temp = (min_temp < 0 or max_temp > 30)
        
        if extreme_temp:
            return DrugStatus.DAMAGED
        
        if overtemp_duration <= 0:
            return DrugStatus.AVAILABLE
        elif overtemp_duration <= batch.max_overtemp_duration:
            return DrugStatus.QUARANTINE
        else:
            return DrugStatus.DAMAGED

    def run_inventory(self):
        """执行盘点"""
        self.results = {}
        
        for batch_number, batch in self.drug_batches.items():
            reserved_quantity = sum(
                r.reserved_quantity 
                for r in self.reservations 
                if r.batch_number == batch_number
            )
            
            temp_data = self.calculate_overtemperature(batch)
            overtemp_duration = temp_data['overtemp_duration']
            max_temp = temp_data['max_temp']
            min_temp = temp_data['min_temp']
            
            status = self.determine_status(overtemp_duration, max_temp, min_temp, batch)
            
            available_quantity = batch.quantity - reserved_quantity
            
            result = InventoryResult(
                batch_number=batch_number,
                drug_name=batch.drug_name,
                specification=batch.specification,
                total_quantity=batch.quantity,
                available_quantity=available_quantity,
                reserved_quantity=reserved_quantity,
                overtemperature_duration=overtemp_duration,
                max_temperature=max_temp,
                min_temperature=min_temp,
                status=status
            )
            
            self.results[batch_number] = result
        
        click.echo(f"盘点完成，共处理 {len(self.results)} 个批号")

    def save_results(self, filepath: Optional[str] = None):
        """保存盘点结果"""
        if filepath is None:
            filepath = os.path.join(self.data_dir, "inventory_results.json")
        
        results_dict = {}
        for batch_number, result in self.results.items():
            result_dict = asdict(result)
            result_dict['status'] = result.status.value
            if result.review_time:
                result_dict['review_time'] = result.review_time.isoformat()
            results_dict[batch_number] = result_dict
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results_dict, f, ensure_ascii=False, indent=2)
        
        click.echo(f"盘点结果已保存到: {filepath}")

    def load_results(self, filepath: str):
        """加载已有盘点结果"""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.results = {}
        for batch_number, result_dict in data.items():
            result = InventoryResult(
                batch_number=result_dict['batch_number'],
                drug_name=result_dict['drug_name'],
                specification=result_dict['specification'],
                total_quantity=result_dict['total_quantity'],
                available_quantity=result_dict['available_quantity'],
                reserved_quantity=result_dict['reserved_quantity'],
                overtemperature_duration=result_dict['overtemperature_duration'],
                max_temperature=result_dict['max_temperature'],
                min_temperature=result_dict['min_temperature'],
                status=DrugStatus(result_dict['status']),
                review_comment=result_dict.get('review_comment', ''),
                reviewer=result_dict.get('reviewer', ''),
                review_time=datetime.fromisoformat(result_dict['review_time']) 
                if result_dict.get('review_time') else None
            )
            self.results[batch_number] = result
        
        click.echo(f"已加载盘点结果，共 {len(self.results)} 个批号")

    def add_review(self, batch_number: str, comment: str, reviewer: str) -> bool:
        """添加人工复核意见"""
        if batch_number not in self.results:
            return False
        
        result = self.results[batch_number]
        result.review_comment = comment
        result.reviewer = reviewer
        result.review_time = datetime.now()
        
        click.echo(f"已添加复核意见: {batch_number}")
        return True

    def export_markdown(self, filepath: str):
        """导出Markdown交接单"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        content = f"""# 冷藏药品盘点交接单

生成时间: {now}

---

## 盘点概览

- 总批次数: {len(self.results)}
- 可售批号: {sum(1 for r in self.results.values() if r.status == DrugStatus.AVAILABLE)}
- 需隔离批号: {sum(1 for r in self.results.values() if r.status == DrugStatus.QUARANTINE)}
- 需报损批号: {sum(1 for r in self.results.values() if r.status == DrugStatus.DAMAGED)}

---

## 详细清单

"""
        
        for batch_number, result in self.results.items():
            max_temp_str = f"{result.max_temperature:.1f}°C" if result.max_temperature else "无数据"
            min_temp_str = f"{result.min_temperature:.1f}°C" if result.min_temperature else "无数据"
            
            content += f"""### {result.drug_name} ({batch_number})

| 项目 | 内容 |
|------|------|
| 规格 | {result.specification} |
| 总数量 | {result.total_quantity} |
| 可售数量 | {result.available_quantity} |
| 预留数量 | {result.reserved_quantity} |
| 超温时长 | {result.overtemperature_duration} 分钟 |
| 最高温度 | {max_temp_str} |
| 最低温度 | {min_temp_str} |
| **状态** | **{result.status.value}** |

"""
            if result.review_comment:
                content += f"""**复核意见** ({result.reviewer}): {result.review_comment}

"""
        
        content += """---

## 交接记录

| 项目 | 内容 |
|------|------|
| 盘点人 | _______________ |
| 复核人 | _______________ |
| 交接时间 | _______________ |

"""
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        click.echo(f"Markdown交接单已导出到: {filepath}")

    def export_audit_json(self, filepath: str):
        """导出JSON审计包"""
        audit_data = {
            "export_time": datetime.now().isoformat(),
            "summary": {
                "total_batches": len(self.results),
                "available": sum(1 for r in self.results.values() if r.status == DrugStatus.AVAILABLE),
                "quarantine": sum(1 for r in self.results.values() if r.status == DrugStatus.QUARANTINE),
                "damaged": sum(1 for r in self.results.values() if r.status == DrugStatus.DAMAGED)
            },
            "results": []
        }
        
        for batch_number, result in self.results.items():
            result_dict = asdict(result)
            result_dict['status'] = result.status.value
            if result.review_time:
                result_dict['review_time'] = result.review_time.isoformat()
            audit_data['results'].append(result_dict)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)
        
        click.echo(f"JSON审计包已导出到: {filepath}")


inventory_system = InventorySystem()

app = Flask(__name__)


@app.route('/api/batch/<batch_number>', methods=['GET'])
def get_batch_status(batch_number):
    """按批号查询状态"""
    if batch_number not in inventory_system.results:
        return jsonify({"error": "批号不存在"}), 404
    
    result = inventory_system.results[batch_number]
    result_dict = asdict(result)
    result_dict['status'] = result.status.value
    if result.review_time:
        result_dict['review_time'] = result.review_time.isoformat()
    
    return jsonify(result_dict)


@app.route('/api/batch/<batch_number>/comment', methods=['POST'])
def add_comment(batch_number):
    """补备注"""
    data = request.get_json()
    if not data or 'comment' not in data:
        return jsonify({"error": "缺少comment参数"}), 400
    
    comment = data['comment']
    reviewer = data.get('reviewer', '匿名')
    
    success = inventory_system.add_review(batch_number, comment, reviewer)
    if not success:
        return jsonify({"error": "批号不存在"}), 404
    
    inventory_system.save_results()
    return jsonify({"success": True, "message": "备注已添加"})


@app.route('/api/batches', methods=['GET'])
def list_batches():
    """列出所有批号"""
    status_filter = request.args.get('status')
    
    results = []
    for batch_number, result in inventory_system.results.items():
        if status_filter and result.status.value != status_filter:
            continue
        
        result_dict = asdict(result)
        result_dict['status'] = result.status.value
        if result.review_time:
            result_dict['review_time'] = result.review_time.isoformat()
        results.append(result_dict)
    
    return jsonify(results)


@click.group()
@click.option('--data-dir', default='./data', help='数据目录')
def cli(data_dir):
    """社区药房冷藏药品盘点工具"""
    global inventory_system
    inventory_system = InventorySystem(data_dir)


@cli.command()
@click.option('--temp', required=True, help='温度记录CSV文件路径')
@click.option('--drugs', required=True, help='药品批号表CSV文件路径')
@click.option('--reservations', help='顾客预留单CSV文件路径')
@click.option('--output', help='输出结果文件路径')
def run(temp, drugs, reservations, output):
    """执行盘点"""
    click.echo("开始执行盘点...")
    
    inventory_system.load_temperature_csv(temp)
    inventory_system.load_drug_csv(drugs)
    
    if reservations:
        inventory_system.load_reservation_csv(reservations)
    
    inventory_system.run_inventory()
    
    for batch_number, result in inventory_system.results.items():
        click.echo(f"  {result.drug_name} ({batch_number}): {result.status.value}, 超温 {result.overtemperature_duration} 分钟")
    
    inventory_system.save_results(output)
    click.echo("盘点完成!")


@cli.command()
@click.option('--results', required=True, help='盘点结果JSON文件路径')
@click.option('--batch', required=True, help='药品批号')
@click.option('--comment', required=True, help='复核意见')
@click.option('--reviewer', default='匿名', help='复核人')
def review(results, batch, comment, reviewer):
    """添加复核意见"""
    inventory_system.load_results(results)
    success = inventory_system.add_review(batch, comment, reviewer)
    if success:
        inventory_system.save_results(results)
    else:
        click.echo(f"错误: 批号 {batch} 不存在")
        sys.exit(1)


@cli.command()
@click.option('--results', required=True, help='盘点结果JSON文件路径')
@click.option('--output', required=True, help='输出Markdown文件路径')
def export_md(results, output):
    """导出Markdown交接单"""
    inventory_system.load_results(results)
    inventory_system.export_markdown(output)


@cli.command()
@click.option('--results', required=True, help='盘点结果JSON文件路径')
@click.option('--output', required=True, help='输出JSON审计包路径')
def export_json(results, output):
    """导出JSON审计包"""
    inventory_system.load_results(results)
    inventory_system.export_audit_json(output)


@cli.command()
@click.option('--results', required=True, help='盘点结果JSON文件路径')
@click.option('--host', default='127.0.0.1', help='监听地址')
@click.option('--port', default=5000, type=int, help='监听端口')
def server(results, host, port):
    """启动HTTP查询服务"""
    inventory_system.load_results(results)
    click.echo(f"启动HTTP服务: http://{host}:{port}")
    click.echo("可用接口:")
    click.echo(f"  GET  /api/batches          - 列出所有批号")
    click.echo(f"  GET  /api/batch/<number>   - 查询指定批号")
    click.echo(f"  POST /api/batch/<number>/comment - 添加备注")
    app.run(host=host, port=port, debug=False)


if __name__ == '__main__':
    cli()
