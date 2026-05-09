"""
数据导入导出模块
支持CSV/JSON格式的数据导入，以及报表生成
"""

import csv
import json
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from .database import Database
from .models import RoomManager, StoveManager, StayManager, FirewoodInManager
from .calculator import ConsumptionCalculator


class DataImporter:
    """数据导入器"""
    
    def __init__(self, db: Database):
        self.db = db
        self.room_manager = RoomManager(db)
        self.stove_manager = StoveManager(db)
        self.stay_manager = StayManager(db)
        self.firewood_manager = FirewoodInManager(db)
    
    def _read_csv(self, file_path: str) -> List[Dict]:
        """读取CSV文件"""
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            return [dict(row) for row in reader]
    
    def _read_json(self, file_path: str) -> List[Dict]:
        """读取JSON文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict) and 'data' in data:
                return data['data']
            return data
    
    def import_rooms(self, file_path: str) -> Dict:
        """导入房间数据"""
        data = self._read_data(file_path)
        success = 0
        duplicate = 0
        error = 0
        errors = []
        
        for item in data:
            try:
                room_number = str(item.get('room_number') or item.get('房号'))
                name = item.get('name') or item.get('名称') or room_number
                floor = int(item.get('floor') or item.get('楼层') or 1)
                max_guests = int(item.get('max_guests') or 
                                item.get('最大人数') or 2)
                
                # 检查是否已存在
                existing = self.room_manager.get_room_by_number(room_number)
                if existing:
                    duplicate += 1
                else:
                    self.room_manager.add_room(
                        room_number, name, floor, max_guests
                    )
                    success += 1
            except Exception as e:
                error += 1
                errors.append(f"记录 {item}: {str(e)}")
        
        return {
            'type': 'rooms',
            'total': len(data),
            'success': success,
            'duplicate': duplicate,
            'error': error,
            'errors': errors[:5]  # 只返回前5个错误
        }
    
    def import_stoves(self, file_path: str) -> Dict:
        """导入炉具数据"""
        data = self._read_data(file_path)
        success = 0
        duplicate = 0
        error = 0
        errors = []
        
        for item in data:
            try:
                room_number = str(item.get('room_number') or item.get('房号'))
                room = self.room_manager.get_room_by_number(room_number)
                
                if not room:
                    error += 1
                    errors.append(f"房间不存在: {room_number}")
                    continue
                
                stove_type = item.get('stove_type') or item.get('炉具类型')
                consumption = item.get('daily_consumption_kg') or \
                            item.get('日消耗量(kg)')
                consumption = float(consumption) if consumption else None
                model = item.get('model') or item.get('型号')
                installed_date = item.get('installed_date') or \
                               item.get('安装日期')
                
                # 检查重复
                existing_stoves = self.stove_manager.get_room_stoves(room['id'])
                has_duplicate = any(
                    s['stove_type'] == stove_type for s in existing_stoves
                )
                
                self.stove_manager.add_stove(
                    room['id'], stove_type, consumption, model, installed_date
                )
                
                if has_duplicate:
                    duplicate += 1
                else:
                    success += 1
            except Exception as e:
                error += 1
                errors.append(f"记录 {item}: {str(e)}")
        
        return {
            'type': 'stoves',
            'total': len(data),
            'success': success,
            'duplicate': duplicate,
            'error': error,
            'errors': errors[:5]
        }
    
    def import_stays(self, file_path: str) -> Dict:
        """导入入住记录"""
        data = self._read_data(file_path)
        success = 0
        duplicate = 0
        error = 0
        errors = []
        
        for item in data:
            try:
                stay_code = item.get('stay_code') or item.get('入住编码')
                room_number = str(item.get('room_number') or item.get('房号'))
                room = self.room_manager.get_room_by_number(room_number)
                
                if not room:
                    error += 1
                    errors.append(f"房间不存在: {room_number}")
                    continue
                
                check_in = item.get('check_in_date') or item.get('入住日期')
                check_out = item.get('check_out_date') or item.get('退房日期')
                guest_name = item.get('guest_name') or item.get('客人姓名')
                guest_count = int(item.get('guest_count') or 
                                 item.get('人数') or 1)
                status = item.get('status') or item.get('状态') or 'checked_in'
                
                # 检查重复
                existing = self.db.query_one(
                    "SELECT id FROM stays WHERE stay_code = ?",
                    (stay_code,)
                )
                
                self.stay_manager.add_stay(
                    stay_code, room['id'], check_in, check_out,
                    guest_name, guest_count, status
                )
                
                if existing:
                    duplicate += 1
                else:
                    success += 1
            except Exception as e:
                error += 1
                errors.append(f"记录 {item}: {str(e)}")
        
        return {
            'type': 'stays',
            'total': len(data),
            'success': success,
            'duplicate': duplicate,
            'error': error,
            'errors': errors[:5]
        }
    
    def import_firewood(self, file_path: str) -> Dict:
        """导入柴火入库"""
        data = self._read_data(file_path)
        success = 0
        duplicate = 0
        error = 0
        errors = []
        
        for item in data:
            try:
                batch_code = item.get('batch_code') or item.get('批次号')
                delivery_date = item.get('delivery_date') or item.get('送货日期')
                weight_kg = float(item.get('weight_kg') or 
                                 item.get('重量(kg)') or 0)
                wood_type = item.get('wood_type') or item.get('木材类型')
                supplier = item.get('supplier') or item.get('供应商')
                unit_price = item.get('unit_price') or item.get('单价')
                unit_price = float(unit_price) if unit_price else None
                notes = item.get('notes') or item.get('备注')
                
                # 检查重复
                existing = self.db.query_one(
                    "SELECT id FROM firewood_in WHERE batch_code = ?",
                    (batch_code,)
                )
                
                self.firewood_manager.add_firewood(
                    batch_code, delivery_date, weight_kg,
                    wood_type, supplier, unit_price, notes
                )
                
                if existing:
                    duplicate += 1
                else:
                    success += 1
            except Exception as e:
                error += 1
                errors.append(f"记录 {item}: {str(e)}")
        
        return {
            'type': 'firewood',
            'total': len(data),
            'success': success,
            'duplicate': duplicate,
            'error': error,
            'errors': errors[:5]
        }
    
    def _read_data(self, file_path: str) -> List[Dict]:
        """根据文件类型读取数据"""
        ext = Path(file_path).suffix.lower()
        if ext == '.csv':
            return self._read_csv(file_path)
        elif ext in ['.json', '.jsonl']:
            return self._read_json(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")


class ReportGenerator:
    """报表生成器"""
    
    def __init__(self, db: Database):
        self.db = db
        self.calculator = ConsumptionCalculator(db)
        self.stay_manager = StayManager(db)
        self.firewood_manager = FirewoodInManager(db)
    
    def generate_html_report(self, output_path: str, 
                              start_date: str = None,
                              end_date: str = None) -> str:
        """生成HTML报表"""
        stats = self.calculator.get_statistics(start_date, end_date)
        anomalies = self.calculator.find_anomalies()
        stays = self.stay_manager.list_stays()
        
        html = f'''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>乡村民宿柴火消耗台账 - {datetime.now().strftime('%Y-%m-%d')}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f0; padding: 20px; }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        .header {{ background: linear-gradient(135deg, #5d4e37 0%, #8b7355 100%); color: #fff; padding: 30px; border-radius: 12px; margin-bottom: 20px; }}
        .header h1 {{ font-size: 28px; margin-bottom: 10px; }}
        .header p {{ opacity: 0.9; }}
        .card {{ background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }}
        .card h2 {{ font-size: 20px; color: #333; margin-bottom: 20px; border-bottom: 2px solid #e8e8e0; padding-bottom: 12px; }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }}
        .stat-card {{ background: linear-gradient(135deg, #f8f4ec 0%, #f0e8d8 100%); border-left: 4px solid #8b7355; padding: 20px; border-radius: 8px; }}
        .stat-card .label {{ font-size: 14px; color: #666; margin-bottom: 8px; }}
        .stat-card .value {{ font-size: 32px; font-weight: bold; color: #5d4e37; }}
        .stat-card .unit {{ font-size: 14px; color: #888; margin-left: 4px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e8e8e0; }}
        th {{ background: #f8f4ec; font-weight: 600; color: #5d4e37; }}
        tr:hover {{ background: #faf8f4; }}
        .badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }}
        .badge-high {{ background: #ffebee; color: #c62828; }}
        .badge-medium {{ background: #fff3e0; color: #ef6c00; }}
        .badge-low {{ background: #e8f5e9; color: #2e7d32; }}
        .badge-info {{ background: #e3f2fd; color: #1565c0; }}
        .anomaly-item {{ padding: 12px 16px; background: #fff8e1; border-left: 4px solid #ff9800; margin-bottom: 8px; border-radius: 4px; }}
        .anomaly-item.high {{ background: #ffebee; border-left-color: #f44336; }}
        .section-title {{ font-size: 16px; font-weight: 600; color: #5d4e37; margin: 20px 0 12px 0; }}
        .progress-bar {{ height: 8px; background: #e8e8e0; border-radius: 4px; overflow: hidden; margin-top: 8px; }}
        .progress-fill {{ height: 100%; background: linear-gradient(90deg, #8b7355, #a1887f); }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏠 乡村民宿柴火消耗台账</h1>
            <p>报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p>数据周期: {start_date or '全部'} 至 {end_date or '至今'}</p>
        </div>

        <div class="card">
            <h2>📊 库存概览</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">总入库量</div>
                    <div class="value">{stats['inventory']['total_in_kg']:.1f}<span class="unit">公斤</span></div>
                </div>
                <div class="stat-card">
                    <div class="label">估算消耗</div>
                    <div class="value">{stats['inventory']['total_estimated_kg']:.1f}<span class="unit">公斤</span></div>
                </div>
                <div class="stat-card">
                    <div class="label">库存结余</div>
                    <div class="value" style="color: {'#2e7d32' if stats['inventory']['remaining_kg'] >= 0 else '#c62828'}">
                        {stats['inventory']['remaining_kg']:.1f}<span class="unit">公斤</span>
                    </div>
                </div>
            </div>
        </div>

        {self._generate_anomalies_html(anomalies)}
        {self._generate_stove_stats_html(stats['stove_type_breakdown'])}
        {self._generate_room_stats_html(stats['room_breakdown'])}
        {self._generate_stays_html(stays)}
    </div>
</body>
</html>
        '''
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        return output_path
    
    def _generate_anomalies_html(self, anomalies: List[Dict]) -> str:
        if not anomalies:
            return '''
        <div class="card">
            <h2>⚠️ 异常检查</h2>
            <p style="color: #2e7d32; font-weight: 500;">✅ 未发现异常记录</p>
        </div>
            '''
        
        html = '''
        <div class="card">
            <h2>⚠️ 异常检查</h2>
        '''
        
        for anomaly in anomalies:
            severity_class = 'high' if anomaly['severity'] == 'high' else ''
            badge_class = 'badge-high' if anomaly['severity'] == 'high' else \
                         'badge-medium' if anomaly['severity'] == 'medium' else \
                         'badge-low'
            
            html += f'''
            <div class="anomaly-item {severity_class}">
                <span class="badge {badge_class}">{anomaly['type']}</span>
                <span style="margin-left: 12px;">{anomaly['message']}</span>
            </div>
            '''
        
        html += '</div>'
        return html
    
    def _generate_stove_stats_html(self, stove_stats: List[Dict]) -> str:
        if not stove_stats:
            return ''
        
        total = sum(s['total_consumption'] for s in stove_stats)
        
        html = '''
        <div class="card">
            <h2>🔥 炉具类型消耗分析</h2>
            <table>
                <thead>
                    <tr>
                        <th>炉具类型</th>
                        <th>入住次数</th>
                        <th>日均消耗</th>
                        <th>总消耗</th>
                        <th>占比</th>
                    </tr>
                </thead>
                <tbody>
        '''
        
        for stat in stove_stats:
            pct = (stat['total_consumption'] / total * 100) if total > 0 else 0
            html += f'''
                    <tr>
                        <td><strong>{stat['stove_type']}</strong></td>
                        <td>{stat['stay_count']} 次</td>
                        <td>{stat['avg_daily_rate']:.1f} 公斤/天</td>
                        <td>{stat['total_consumption']:.1f} 公斤</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="progress-bar" style="width: 100px;">
                                    <div class="progress-fill" style="width: {pct}%"></div>
                                </div>
                                <span>{pct:.1f}%</span>
                            </div>
                        </td>
                    </tr>
            '''
        
        html += '''
                </tbody>
            </table>
        </div>
        '''
        return html
    
    def _generate_room_stats_html(self, room_stats: List[Dict]) -> str:
        if not room_stats:
            return ''
        
        total = sum(r['total_consumption'] for r in room_stats)
        
        html = '''
        <div class="card">
            <h2>🛏️ 房间消耗排行</h2>
            <table>
                <thead>
                    <tr>
                        <th>房间</th>
                        <th>名称</th>
                        <th>入住次数</th>
                        <th>总消耗</th>
                        <th>占比</th>
                    </tr>
                </thead>
                <tbody>
        '''
        
        for stat in room_stats:
            pct = (stat['total_consumption'] / total * 100) if total > 0 else 0
            html += f'''
                    <tr>
                        <td><strong>{stat['room_number']}</strong></td>
                        <td>{stat['name']}</td>
                        <td>{stat['stay_count']} 次</td>
                        <td>{stat['total_consumption']:.1f} 公斤</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="progress-bar" style="width: 100px;">
                                    <div class="progress-fill" style="width: {pct}%"></div>
                                </div>
                                <span>{pct:.1f}%</span>
                            </div>
                        </td>
                    </tr>
            '''
        
        html += '''
                </tbody>
            </table>
        </div>
        '''
        return html
    
    def _generate_stays_html(self, stays: List[Dict]) -> str:
        if not stays:
            return ''
        
        html = '''
        <div class="card">
            <h2>📋 入住记录明细</h2>
            <table>
                <thead>
                    <tr>
                        <th>入住编码</th>
                        <th>房间</th>
                        <th>客人</th>
                        <th>人数</th>
                        <th>入住日期</th>
                        <th>退房日期</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
        '''
        
        for stay in stays:
            status_badge = 'badge-info' if stay['status'] == 'checked_in' else 'badge-low'
            status_text = '在住' if stay['status'] == 'checked_in' else '已退房'
            
            html += f'''
                    <tr>
                        <td><code>{stay['stay_code']}</code></td>
                        <td>{stay['room_number']} {stay['room_name']}</td>
                        <td>{stay['guest_name'] or '-'}</td>
                        <td>{stay['guest_count']}</td>
                        <td>{stay['check_in_date']}</td>
                        <td>{stay['check_out_date'] or '-'}</td>
                        <td><span class="badge {status_badge}">{status_text}</span></td>
                    </tr>
            '''
        
        html += '''
                </tbody>
            </table>
        </div>
        '''
        return html
    
    def generate_csv_report(self, output_path: str, 
                            start_date: str = None,
                            end_date: str = None) -> str:
        """生成CSV报表"""
        stats = self.calculator.get_statistics(start_date, end_date)
        anomalies = self.calculator.find_anomalies()
        
        # 综合报表
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(['乡村民宿柴火消耗台账报表'])
            writer.writerow(['生成时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])
            
            writer.writerow(['一、库存概览'])
            writer.writerow(['总入库量(kg)', stats['inventory']['total_in_kg']])
            writer.writerow(['估算消耗(kg)', stats['inventory']['total_estimated_kg']])
            writer.writerow(['库存结余(kg)', stats['inventory']['remaining_kg']])
            writer.writerow([])
            
            writer.writerow(['二、炉具类型消耗分析'])
            writer.writerow(['炉具类型', '入住次数', '日均消耗(kg)', '总消耗(kg)'])
            for stat in stats['stove_type_breakdown']:
                writer.writerow([
                    stat['stove_type'],
                    stat['stay_count'],
                    f"{stat['avg_daily_rate']:.1f}",
                    f"{stat['total_consumption']:.1f}"
                ])
            writer.writerow([])
            
            writer.writerow(['三、房间消耗排行'])
            writer.writerow(['房间号', '房间名称', '入住次数', '总消耗(kg)'])
            for stat in stats['room_breakdown']:
                writer.writerow([
                    stat['room_number'],
                    stat['name'],
                    stat['stay_count'],
                    f"{stat['total_consumption']:.1f}"
                ])
            writer.writerow([])
            
            writer.writerow(['四、异常记录'])
            if anomalies:
                writer.writerow(['类型', '严重程度', '详情'])
                for anomaly in anomalies:
                    writer.writerow([
                        anomaly['type'],
                        anomaly['severity'],
                        anomaly['message']
                    ])
            else:
                writer.writerow(['无异常'])
        
        return output_path
