import csv
import json
from datetime import datetime, date, time
from typing import List, Dict, Any, Tuple, Optional
import os

from app.services.storage_service import StorageService


class ImportService:
    
    @staticmethod
    def parse_time(time_str: str) -> time:
        formats = ['%H:%M:%S', '%H:%M', '%H:%M:%S.%f']
        for fmt in formats:
            try:
                return datetime.strptime(time_str.strip(), fmt).time()
            except (ValueError, AttributeError):
                continue
        raise ValueError(f"无法解析时间格式: {time_str}")
    
    @staticmethod
    def parse_date(date_str: str) -> date:
        formats = ['%Y-%m-%d', '%Y/%m/%d', '%m/%d/%Y', '%d/%m/%Y', '%Y%m%d']
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except (ValueError, AttributeError):
                continue
        raise ValueError(f"无法解析日期格式: {date_str}")
    
    @staticmethod
    def parse_duration(duration_str: Any) -> int:
        if isinstance(duration_str, int):
            return duration_str
        if isinstance(duration_str, str):
            duration_str = duration_str.strip()
            if ':' in duration_str:
                parts = duration_str.split(':')
                if len(parts) == 2:
                    return int(parts[0]) * 60 + int(parts[1])
                elif len(parts) == 3:
                    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            try:
                return int(float(duration_str))
            except ValueError:
                pass
        return 0
    
    @staticmethod
    def parse_program_csv(file_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        programs = []
        errors = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    program_data = ImportService._parse_program_row(row, row_num)
                    programs.append(program_data)
                except Exception as e:
                    errors.append(f"第{row_num}行: {str(e)}")
        
        return programs, errors
    
    @staticmethod
    def _parse_program_row(row: Dict[str, str], row_num: int) -> Dict[str, Any]:
        def get_col(*names: str) -> str:
            for name in names:
                if name in row and row[name].strip():
                    return row[name].strip()
            return ''
        
        program_code = get_col('节目编码', 'program_code', 'code', 'id')
        if not program_code:
            raise ValueError(f"缺少节目编码")
        
        program_name = get_col('节目名称', 'program_name', 'name', 'title')
        if not program_name:
            raise ValueError(f"缺少节目名称")
        
        broadcast_date_str = get_col('播出日期', 'broadcast_date', 'date')
        if not broadcast_date_str:
            raise ValueError(f"缺少播出日期")
        broadcast_date = ImportService.parse_date(broadcast_date_str)
        
        start_time_str = get_col('开始时间', 'start_time', 'time')
        if not start_time_str:
            raise ValueError(f"缺少开始时间")
        start_time = ImportService.parse_time(start_time_str)
        
        end_time_str = get_col('结束时间', 'end_time')
        end_time = ImportService.parse_time(end_time_str) if end_time_str else None
        
        duration_str = get_col('时长', 'duration', 'duration_seconds')
        duration_seconds = ImportService.parse_duration(duration_str) if duration_str else None
        
        is_children_str = get_col('少儿节目', '儿童节目', 'is_children', 'children_program')
        is_children_program = is_children_str.lower() in ['是', 'yes', 'true', '1', 'y'] if is_children_str else False
        
        return {
            'program_code': program_code,
            'program_name': program_name,
            'category': get_col('分类', 'category', 'type'),
            'is_children_program': is_children_program,
            'broadcast_date': broadcast_date,
            'start_time': start_time,
            'end_time': end_time,
            'duration_seconds': duration_seconds,
            'channel': get_col('频道', 'channel', 'station')
        }
    
    @staticmethod
    def parse_contract_json(file_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        contracts = []
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                contract_list = data
            elif isinstance(data, dict):
                if 'contracts' in data:
                    contract_list = data['contracts']
                else:
                    contract_list = [data]
            else:
                raise ValueError("JSON格式不正确")
            
            for idx, item in enumerate(contract_list):
                try:
                    contract_data = ImportService._parse_contract_item(item)
                    contracts.append(contract_data)
                except Exception as e:
                    errors.append(f"第{idx+1}个合同: {str(e)}")
        
        except json.JSONDecodeError as e:
            errors.append(f"JSON解析错误: {str(e)}")
        except Exception as e:
            errors.append(f"读取文件错误: {str(e)}")
        
        return contracts, errors
    
    @staticmethod
    def _parse_contract_item(item: Dict[str, Any]) -> Dict[str, Any]:
        contract_code = item.get('contract_code', item.get('合同编码', item.get('code', '')))
        if not contract_code:
            raise ValueError("缺少合同编码")
        
        advertiser_name = item.get('advertiser_name', item.get('广告主', item.get('advertiser', '')))
        if not advertiser_name:
            raise ValueError("缺少广告主名称")
        
        brand_name = item.get('brand_name', item.get('品牌', item.get('brand', '')))
        if not brand_name:
            raise ValueError("缺少品牌名称")
        
        start_date_str = item.get('start_date', item.get('开始日期', item.get('start', '')))
        end_date_str = item.get('end_date', item.get('结束日期', item.get('end', '')))
        
        if not start_date_str:
            raise ValueError("缺少合同开始日期")
        if not end_date_str:
            raise ValueError("缺少合同结束日期")
        
        total_duration = ImportService.parse_duration(
            item.get('total_duration_seconds', 
                    item.get('总时长', 
                            item.get('total_duration', 0)))
        )
        
        return {
            'contract_code': contract_code,
            'contract_name': item.get('contract_name', item.get('合同名称', '')),
            'advertiser_name': advertiser_name,
            'brand_name': brand_name,
            'industry_category': item.get('industry_category', item.get('行业分类', item.get('category', ''))),
            'total_amount': float(item.get('total_amount', item.get('总金额', 0))),
            'total_duration_seconds': total_duration,
            'start_date': ImportService.parse_date(start_date_str),
            'end_date': ImportService.parse_date(end_date_str),
            'status': item.get('status', 'active')
        }
    
    @staticmethod
    def parse_broadcast_log(file_path: str, source_type: str = 'log') -> Tuple[List[Dict[str, Any]], List[str]]:
        events = []
        errors = []
        
        if file_path.endswith('.csv'):
            events, errors = ImportService._parse_broadcast_log_csv(file_path, source_type)
        elif file_path.endswith('.json'):
            events, errors = ImportService._parse_broadcast_log_json(file_path, source_type)
        else:
            errors.append(f"不支持的文件格式: {os.path.basename(file_path)}")
        
        return events, errors
    
    @staticmethod
    def _parse_broadcast_log_csv(file_path: str, source_type: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        events = []
        errors = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    event_data = ImportService._parse_broadcast_row(row, row_num, source_type)
                    events.append(event_data)
                except Exception as e:
                    errors.append(f"第{row_num}行: {str(e)}")
        
        return events, errors
    
    @staticmethod
    def _parse_broadcast_row(row: Dict[str, str], row_num: int, source_type: str) -> Dict[str, Any]:
        def get_col(*names: str) -> str:
            for name in names:
                if name in row and row[name].strip():
                    return row[name].strip()
            return ''
        
        broadcast_date_str = get_col('播出日期', 'broadcast_date', 'date')
        broadcast_time_str = get_col('播出时间', 'broadcast_time', 'time')
        
        if not broadcast_date_str:
            raise ValueError("缺少播出日期")
        if not broadcast_time_str:
            raise ValueError("缺少播出时间")
        
        brand_name = get_col('品牌', 'brand_name', 'brand')
        if not brand_name:
            raise ValueError("缺少品牌名称")
        
        duration_str = get_col('时长', 'duration', 'duration_seconds')
        duration_seconds = ImportService.parse_duration(duration_str) if duration_str else 15
        
        is_rerun_str = get_col('补播', '重播', 'is_rerun', 'rerun')
        is_rerun = is_rerun_str.lower() in ['是', 'yes', 'true', '1', 'y'] if is_rerun_str else False
        
        return {
            'broadcast_date': ImportService.parse_date(broadcast_date_str),
            'broadcast_time': ImportService.parse_time(broadcast_time_str),
            'source_type': source_type,
            'status': 'logged' if source_type == 'log' else 'scheduled',
            'brand_name': brand_name,
            'ad_name': get_col('广告名称', 'ad_name', 'ad'),
            'duration_seconds': duration_seconds,
            'industry_category': get_col('行业分类', 'industry_category', 'category'),
            'is_rerun': is_rerun,
            'log_verified': source_type == 'log'
        }
    
    @staticmethod
    def _parse_broadcast_log_json(file_path: str, source_type: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        events = []
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                event_list = data
            elif isinstance(data, dict):
                if 'events' in data:
                    event_list = data['events']
                else:
                    event_list = [data]
            else:
                raise ValueError("JSON格式不正确")
            
            for idx, item in enumerate(event_list):
                try:
                    event_data = {
                        'broadcast_date': ImportService.parse_date(str(item.get('broadcast_date', item.get('播出日期', '')))),
                        'broadcast_time': ImportService.parse_time(str(item.get('broadcast_time', item.get('播出时间', '')))),
                        'source_type': source_type,
                        'status': 'logged' if source_type == 'log' else 'scheduled',
                        'brand_name': item.get('brand_name', item.get('品牌', '')),
                        'ad_name': item.get('ad_name', item.get('广告名称', '')),
                        'duration_seconds': ImportService.parse_duration(item.get('duration_seconds', item.get('时长', 15))),
                        'industry_category': item.get('industry_category', item.get('行业分类', '')),
                        'is_rerun': bool(item.get('is_rerun', item.get('补播', False))),
                        'log_verified': source_type == 'log'
                    }
                    
                    if not event_data['brand_name']:
                        raise ValueError("缺少品牌名称")
                    
                    events.append(event_data)
                except Exception as e:
                    errors.append(f"第{idx+1}个事件: {str(e)}")
        
        except Exception as e:
            errors.append(f"读取文件错误: {str(e)}")
        
        return events, errors
    
    @staticmethod
    def parse_blackout_rules(file_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        rules = []
        errors = []
        
        if file_path.endswith('.json'):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                rule_list = data if isinstance(data, list) else data.get('blackout_periods', [data])
                
                for idx, item in enumerate(rule_list):
                    try:
                        rule_data = {
                            'name': item.get('name', item.get('名称', f'禁播规则_{idx+1}')),
                            'description': item.get('description', item.get('描述', '')),
                            'is_active': item.get('is_active', True)
                        }
                        
                        if 'start_date' in item or '开始日期' in item:
                            rule_data['start_date'] = ImportService.parse_date(
                                str(item.get('start_date', item.get('开始日期', '')))
                            )
                        if 'end_date' in item or '结束日期' in item:
                            rule_data['end_date'] = ImportService.parse_date(
                                str(item.get('end_date', item.get('结束日期', '')))
                            )
                        
                        if 'day_of_week' in item or '星期' in item:
                            dow = item.get('day_of_week', item.get('星期'))
                            if isinstance(dow, int):
                                rule_data['day_of_week'] = dow
                            elif isinstance(dow, str):
                                dow_map = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7}
                                for k, v in dow_map.items():
                                    if k in dow:
                                        rule_data['day_of_week'] = v
                                        break
                        
                        if 'start_time' in item or '开始时间' in item:
                            rule_data['start_time'] = ImportService.parse_time(
                                str(item.get('start_time', item.get('开始时间', '00:00:00')))
                            )
                        if 'end_time' in item or '结束时间' in item:
                            rule_data['end_time'] = ImportService.parse_time(
                                str(item.get('end_time', item.get('结束时间', '23:59:59')))
                            )
                        
                        if 'restricted_categories' in item or '限制分类' in item:
                            cats = item.get('restricted_categories', item.get('限制分类', []))
                            rule_data['restricted_categories'] = json.dumps(cats, ensure_ascii=False) if isinstance(cats, list) else str(cats)
                        
                        rules.append(rule_data)
                    except Exception as e:
                        errors.append(f"第{idx+1}个规则: {str(e)}")
            
            except Exception as e:
                errors.append(f"读取文件错误: {str(e)}")
        
        return rules, errors
    
    @staticmethod
    def parse_industry_conflicts(file_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        conflicts = []
        errors = []
        
        if file_path.endswith('.json'):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                conflict_list = data if isinstance(data, list) else data.get('conflicts', [data])
                
                for idx, item in enumerate(conflict_list):
                    try:
                        cat_a = item.get('category_a', item.get('分类A', ''))
                        cat_b = item.get('category_b', item.get('分类B', ''))
                        
                        if not cat_a or not cat_b:
                            raise ValueError("缺少冲突分类")
                        
                        conflict_data = {
                            'category_a': cat_a,
                            'category_b': cat_b,
                            'min_interval_seconds': int(item.get('min_interval_seconds', 
                                                                   item.get('最小间隔秒数', 300))),
                            'description': item.get('description', item.get('描述', '')),
                            'is_active': item.get('is_active', True)
                        }
                        
                        conflicts.append(conflict_data)
                    except Exception as e:
                        errors.append(f"第{idx+1}个冲突规则: {str(e)}")
            
            except Exception as e:
                errors.append(f"读取文件错误: {str(e)}")
        
        return conflicts, errors
