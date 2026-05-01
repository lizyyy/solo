import csv
import json
import re
from datetime import datetime
from typing import List, Dict, Any

class DataParser:
    @staticmethod
    def parse_orders(file_path: str) -> List[Dict[str, Any]]:
        orders = []
        errors = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                required_fields = ['订单号', '产品型号', '数量', '优先级', '交货日期', '工艺时间(分钟)']
                for i, row in enumerate(reader, start=2):
                    missing_fields = [f for f in required_fields if f not in row or not row[f].strip()]
                    if missing_fields:
                        errors.append(f"第{i}行缺少必要字段: {', '.join(missing_fields)}")
                        continue
                    
                    try:
                        order = {
                            '订单号': row['订单号'].strip(),
                            '产品型号': row['产品型号'].strip(),
                            '数量': int(row['数量'].strip()),
                            '优先级': row['优先级'].strip(),
                            '交货日期': datetime.strptime(row['交货日期'].strip(), '%Y-%m-%d'),
                            '工艺时间(分钟)': int(row['工艺时间(分钟)'].strip()),
                            '原始行号': i
                        }
                        if order['优先级'] not in ['紧急', '高', '中', '低']:
                            errors.append(f"第{i}行优先级值无效: {order['优先级']}")
                        elif order['数量'] <= 0:
                            errors.append(f"第{i}行数量必须大于0")
                        elif order['工艺时间(分钟)'] <= 0:
                            errors.append(f"第{i}行工艺时间必须大于0")
                        else:
                            orders.append(order)
                    except ValueError as e:
                        errors.append(f"第{i}行数据格式错误: {str(e)}")
        except Exception as e:
            errors.append(f"读取订单文件失败: {str(e)}")
        
        return orders, errors

    @staticmethod
    def parse_calendar(file_path: str) -> Dict[str, Any]:
        calendar = {}
        errors = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if '产线ID' not in data or not data['产线ID']:
                errors.append("缺少产线ID")
            if '工作日期' not in data or not isinstance(data['工作日期'], list):
                errors.append("工作日期必须是列表格式")
            
            calendar['产线ID'] = data.get('产线ID', '')
            calendar['产线名称'] = data.get('产线名称', '')
            calendar['工作时段'] = []
            
            for i, shift in enumerate(data.get('工作日期', []), start=1):
                required = ['日期', '班次', '开始时间', '结束时间', '可用']
                missing = [f for f in required if f not in shift]
                if missing:
                    errors.append(f"工作日期第{i}项缺少字段: {', '.join(missing)}")
                    continue
                
                try:
                    start_dt = datetime.strptime(shift['开始时间'], '%H:%M')
                    end_dt = datetime.strptime(shift['结束时间'], '%H:%M')
                    date_dt = datetime.strptime(shift['日期'], '%Y-%m-%d')
                    
                    calendar['工作时段'].append({
                        '日期': date_dt.date(),
                        '班次': shift['班次'],
                        '开始时间': start_dt.time(),
                        '结束时间': end_dt.time(),
                        '可用': shift['可用']
                    })
                except ValueError as e:
                    errors.append(f"工作日期第{i}项时间格式错误: {str(e)}")
            
            calendar['休息日'] = []
            for date_str in data.get('休息日', []):
                try:
                    calendar['休息日'].append(datetime.strptime(date_str, '%Y-%m-%d').date())
                except ValueError:
                    errors.append(f"休息日日期格式错误: {date_str}")
                    
        except json.JSONDecodeError as e:
            errors.append(f"日历文件JSON格式错误: {str(e)}")
        except Exception as e:
            errors.append(f"读取日历文件失败: {str(e)}")
        
        return calendar, errors

    @staticmethod
    def parse_materials(file_path: str) -> Dict[str, datetime]:
        materials = {}
        errors = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for i, item in enumerate(data.get('物料供应', []), start=1):
                if '产品型号' not in item or '物料到齐时间' not in item:
                    errors.append(f"物料供应第{i}项缺少产品型号或物料到齐时间")
                    continue
                
                try:
                    materials[item['产品型号']] = datetime.strptime(item['物料到齐时间'], '%Y-%m-%d %H:%M:%S')
                except ValueError as e:
                    errors.append(f"物料供应第{i}项时间格式错误: {str(e)}")
                    
        except json.JSONDecodeError as e:
            errors.append(f"物料文件JSON格式错误: {str(e)}")
        except Exception as e:
            errors.append(f"读取物料文件失败: {str(e)}")
        
        return materials, errors

    @staticmethod
    def parse_changeover_matrix(file_path: str) -> Dict[str, Dict[str, int]]:
        matrix = {}
        errors = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for i, item in enumerate(data.get('换线矩阵', []), start=1):
                if '当前产品' not in item or '下一产品' not in item or '换线时间(分钟)' not in item:
                    errors.append(f"换线矩阵第{i}项缺少必要字段")
                    continue
                
                current = item['当前产品']
                next_prod = item['下一产品']
                try:
                    time = int(item['换线时间(分钟)'])
                except ValueError:
                    errors.append(f"换线矩阵第{i}项换线时间必须是整数")
                    continue
                
                if current not in matrix:
                    matrix[current] = {}
                matrix[current][next_prod] = time
                    
        except json.JSONDecodeError as e:
            errors.append(f"换线矩阵文件JSON格式错误: {str(e)}")
        except Exception as e:
            errors.append(f"读取换线矩阵文件失败: {str(e)}")
        
        return matrix, errors

    @staticmethod
    def validate_data(orders: List[Dict], materials: Dict[str, datetime], 
                     matrix: Dict[str, Dict[str, int]]) -> List[str]:
        errors = []
        products_in_orders = set(o['产品型号'] for o in orders)
        products_in_materials = set(materials.keys())
        products_in_matrix = set()
        for k, v in matrix.items():
            if k != '开始':
                products_in_matrix.add(k)
            products_in_matrix.update(v.keys())
        
        missing_materials = products_in_orders - products_in_materials
        if missing_materials:
            errors.append(f"以下产品缺少物料到齐时间: {', '.join(missing_materials)}")
        
        missing_matrix_entries = []
        for prod in products_in_orders:
            if prod not in matrix.get('开始', {}):
                missing_matrix_entries.append(f"开始 -> {prod}")
        
        for prod1 in products_in_orders:
            for prod2 in products_in_orders:
                if prod1 != prod2 and prod1 not in matrix:
                    missing_matrix_entries.append(f"{prod1} -> {prod2}")
                elif prod1 != prod2 and prod1 in matrix and prod2 not in matrix[prod1]:
                    missing_matrix_entries.append(f"{prod1} -> {prod2}")
        
        if missing_matrix_entries:
            errors.append(f"换线矩阵缺少以下转换项: {', '.join(missing_matrix_entries[:10])}" 
                         + ("..." if len(missing_matrix_entries) > 10 else ""))
        
        return errors