# -*- coding: utf-8 -*-
"""
证件照影楼交付前复核工具 - 数据读取模块
负责读取订单CSV、修图记录JSON、打印队列JSON，以及扫描导出文件夹
"""

import os
import csv
import json
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from config import DATA_DIR
from utils import (
    logger, load_json_file, get_file_list, 
    FileNameParser, DateTimeHelper
)


class OrderCSVReader:
    """
    订单CSV文件读取器
    读取订单CSV文件，解析订单信息
    """
    
    # 默认的CSV字段映射
    DEFAULT_FIELD_MAPPING = {
        "order_id": ["订单号", "订单编号", "order_id", "id"],
        "customer_name": ["客户姓名", "姓名", "客户", "customer_name", "name"],
        "sizes": ["尺寸", "规格", "照片尺寸", "sizes", "size"],
        "background": ["背景色", "背景", "background", "bg_color"],
        "status": ["状态", "订单状态", "status", "order_status"],
        "priority": ["优先级", "加急", "priority", "urgent"],
        "create_time": ["创建时间", "下单时间", "create_time", "order_time"],
        "quantity": ["数量", "份数", "quantity", "count"],
        "remarks": ["备注", "说明", "remarks", "notes"],
    }
    
    def __init__(self, field_mapping: Dict[str, List[str]] = None):
        """
        初始化订单CSV读取器
        
        Args:
            field_mapping: 自定义字段映射，格式为 {标准字段名: [CSV可能的列名]}
        """
        self.field_mapping = field_mapping or self.DEFAULT_FIELD_MAPPING
        self.file_parser = FileNameParser()
    
    def read(self, file_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        读取CSV文件
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            (订单列表, 错误信息列表)
        """
        orders = []
        errors = []
        
        if not os.path.exists(file_path):
            errors.append(f"订单CSV文件不存在: {file_path}")
            return orders, errors
        
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                # 尝试自动检测方言
                dialect = csv.Sniffer().sniff(f.read(1024))
                f.seek(0)
                
                reader = csv.DictReader(f, dialect=dialect)
                headers = reader.fieldnames
                
                # 构建列名到标准字段的映射
                column_mapping = self._build_column_mapping(headers)
                
                for row_num, row in enumerate(reader, start=2):  # 从第2行开始（跳过表头）
                    try:
                        order = self._parse_row(row, column_mapping, row_num)
                        if order:
                            orders.append(order)
                    except Exception as e:
                        errors.append(f"解析第 {row_num} 行失败: {str(e)}")
                        
        except UnicodeDecodeError:
            # 尝试使用GBK编码
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    dialect = csv.Sniffer().sniff(f.read(1024))
                    f.seek(0)
                    
                    reader = csv.DictReader(f, dialect=dialect)
                    headers = reader.fieldnames
                    column_mapping = self._build_column_mapping(headers)
                    
                    for row_num, row in enumerate(reader, start=2):
                        try:
                            order = self._parse_row(row, column_mapping, row_num)
                            if order:
                                orders.append(order)
                        except Exception as e:
                            errors.append(f"解析第 {row_num} 行失败: {str(e)}")
            except Exception as e:
                errors.append(f"读取CSV文件失败 (尝试UTF-8和GBK均失败): {str(e)}")
        except Exception as e:
            errors.append(f"读取CSV文件失败: {str(e)}")
        
        logger.info(f"读取订单CSV完成，共 {len(orders)} 条订单，{len(errors)} 个错误")
        return orders, errors
    
    def _build_column_mapping(self, headers: List[str]) -> Dict[str, str]:
        """
        构建CSV列名到标准字段的映射
        
        Args:
            headers: CSV表头列表
            
        Returns:
            {标准字段名: CSV列名}
        """
        mapping = {}
        
        for standard_field, possible_names in self.field_mapping.items():
            for header in headers:
                header_lower = header.strip().lower()
                for name in possible_names:
                    if name.lower() == header_lower or header_lower in name.lower():
                        mapping[standard_field] = header
                        break
                if standard_field in mapping:
                    break
        
        return mapping
    
    def _parse_row(self, row: Dict[str, str], column_mapping: Dict[str, str], 
                   row_num: int) -> Optional[Dict[str, Any]]:
        """
        解析单行数据
        
        Args:
            row: CSV行数据
            column_mapping: 列映射
            row_num: 行号（用于日志）
            
        Returns:
            解析后的订单字典
        """
        order = {
            "order_id": None,
            "customer_name": None,
            "sizes": [],
            "background": None,
            "status": "待处理",
            "priority": "普通",
            "create_time": None,
            "quantity": 1,
            "remarks": None,
            "raw_data": row.copy(),
        }
        
        # 解析订单号（必填）
        if "order_id" in column_mapping:
            order["order_id"] = row.get(column_mapping["order_id"], "").strip()
        
        if not order["order_id"]:
            logger.warning(f"第 {row_num} 行缺少订单号，跳过")
            return None
        
        # 解析客户姓名
        if "customer_name" in column_mapping:
            order["customer_name"] = row.get(column_mapping["customer_name"], "").strip()
        
        # 解析尺寸（支持逗号/分号分隔的多个尺寸）
        if "sizes" in column_mapping:
            sizes_str = row.get(column_mapping["sizes"], "").strip()
            if sizes_str:
                # 分割多种分隔符
                for sep in [",", "；", ";", "、", "/"]:
                    if sep in sizes_str:
                        sizes = [s.strip() for s in sizes_str.split(sep) if s.strip()]
                        order["sizes"] = sizes
                        break
                else:
                    # 没有分隔符，单个尺寸
                    order["sizes"] = [sizes_str]
        
        # 解析背景色
        if "background" in column_mapping:
            order["background"] = row.get(column_mapping["background"], "").strip()
        
        # 解析状态
        if "status" in column_mapping:
            order["status"] = row.get(column_mapping["status"], "待处理").strip()
        
        # 解析优先级/加急标识
        if "priority" in column_mapping:
            priority_str = row.get(column_mapping["priority"], "").strip()
            if priority_str:
                # 检查是否包含加急关键词
                urgent_keywords = ["加急", "特急", "紧急", "urgent", "URGENT", "是", "1", "true"]
                for keyword in urgent_keywords:
                    if keyword in priority_str:
                        order["priority"] = "加急" if "特急" not in priority_str else "特急"
                        break
        
        # 解析创建时间
        if "create_time" in column_mapping:
            time_str = row.get(column_mapping["create_time"], "").strip()
            if time_str:
                parsed_time = DateTimeHelper.parse_datetime(time_str)
                if parsed_time:
                    order["create_time"] = parsed_time
        
        # 解析数量
        if "quantity" in column_mapping:
            qty_str = row.get(column_mapping["quantity"], "1").strip()
            try:
                order["quantity"] = int(qty_str)
            except ValueError:
                order["quantity"] = 1
        
        # 解析备注
        if "remarks" in column_mapping:
            order["remarks"] = row.get(column_mapping["remarks"], "").strip()
        
        return order


class RetouchRecordReader:
    """
    修图记录JSON读取器
    读取修图记录JSON文件
    """
    
    def __init__(self):
        pass
    
    def read(self, file_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        读取修图记录JSON文件
        
        Args:
            file_path: JSON文件路径
            
        Returns:
            (修图记录列表, 错误信息列表)
        """
        records = []
        errors = []
        
        if not os.path.exists(file_path):
            errors.append(f"修图记录JSON文件不存在: {file_path}")
            return records, errors
        
        data = load_json_file(file_path)
        if data is None:
            errors.append(f"读取修图记录JSON文件失败: {file_path}")
            return records, errors
        
        # 支持多种格式：直接是列表，或者是包含records/items字段的对象
        if isinstance(data, list):
            raw_records = data
        elif isinstance(data, dict):
            raw_records = data.get("records", data.get("items", []))
        else:
            errors.append(f"修图记录JSON格式不正确，应为列表或包含records字段的对象")
            return records, errors
        
        for i, raw_record in enumerate(raw_records):
            try:
                record = self._parse_record(raw_record, i)
                if record:
                    records.append(record)
            except Exception as e:
                errors.append(f"解析第 {i+1} 条修图记录失败: {str(e)}")
        
        logger.info(f"读取修图记录完成，共 {len(records)} 条记录，{len(errors)} 个错误")
        return records, errors
    
    def _parse_record(self, raw_record: Dict[str, Any], index: int) -> Optional[Dict[str, Any]]:
        """
        解析单条修图记录
        
        Args:
            raw_record: 原始记录数据
            index: 记录索引（用于日志）
            
        Returns:
            解析后的修图记录字典
        """
        record = {
            "order_id": None,
            "status": "pending",
            "start_time": None,
            "end_time": None,
            "retoucher": None,
            "steps": [],
            "issues": [],
            "raw_data": raw_record.copy(),
        }
        
        # 订单号（必填）
        order_id = raw_record.get("order_id") or raw_record.get("订单号")
        if not order_id:
            logger.warning(f"第 {index+1} 条修图记录缺少订单号，跳过")
            return None
        record["order_id"] = str(order_id).strip()
        
        # 状态
        status = raw_record.get("status") or raw_record.get("状态")
        if status:
            record["status"] = str(status).strip()
        
        # 开始时间
        start_time = raw_record.get("start_time") or raw_record.get("开始时间")
        if start_time:
            if isinstance(start_time, str):
                parsed = DateTimeHelper.parse_datetime(start_time)
                if parsed:
                    record["start_time"] = parsed
            else:
                record["start_time"] = start_time
        
        # 结束时间
        end_time = raw_record.get("end_time") or raw_record.get("完成时间") or raw_record.get("结束时间")
        if end_time:
            if isinstance(end_time, str):
                parsed = DateTimeHelper.parse_datetime(end_time)
                if parsed:
                    record["end_time"] = parsed
            else:
                record["end_time"] = end_time
        
        # 修图师
        record["retoucher"] = raw_record.get("retoucher") or raw_record.get("修图师")
        
        # 修图步骤
        steps = raw_record.get("steps") or raw_record.get("步骤") or []
        if isinstance(steps, list):
            record["steps"] = steps
        
        # 发现的问题
        issues = raw_record.get("issues") or raw_record.get("问题") or []
        if isinstance(issues, list):
            record["issues"] = issues
        
        return record


class PrintQueueReader:
    """
    打印队列JSON读取器
    读取打印队列JSON文件
    """
    
    def __init__(self):
        pass
    
    def read(self, file_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        读取打印队列JSON文件
        
        Args:
            file_path: JSON文件路径
            
        Returns:
            (打印队列列表, 错误信息列表)
        """
        queue = []
        errors = []
        
        if not os.path.exists(file_path):
            errors.append(f"打印队列JSON文件不存在: {file_path}")
            return queue, errors
        
        data = load_json_file(file_path)
        if data is None:
            errors.append(f"读取打印队列JSON文件失败: {file_path}")
            return queue, errors
        
        # 支持多种格式
        if isinstance(data, list):
            raw_items = data
        elif isinstance(data, dict):
            raw_items = data.get("queue", data.get("items", data.get("jobs", [])))
        else:
            errors.append(f"打印队列JSON格式不正确，应为列表或包含queue字段的对象")
            return queue, errors
        
        for i, raw_item in enumerate(raw_items):
            try:
                item = self._parse_queue_item(raw_item, i)
                if item:
                    queue.append(item)
            except Exception as e:
                errors.append(f"解析第 {i+1} 条打印队列项失败: {str(e)}")
        
        logger.info(f"读取打印队列完成，共 {len(queue)} 条记录，{len(errors)} 个错误")
        return queue, errors
    
    def _parse_queue_item(self, raw_item: Dict[str, Any], index: int) -> Optional[Dict[str, Any]]:
        """
        解析单个打印队列项
        
        Args:
            raw_item: 原始队列项数据
            index: 索引（用于日志）
            
        Returns:
            解析后的队列项字典
        """
        item = {
            "order_id": None,
            "added_time": None,
            "status": "pending",
            "printer": None,
            "copies": 1,
            "priority": "普通",
            "raw_data": raw_item.copy(),
        }
        
        # 订单号（必填）
        order_id = raw_item.get("order_id") or raw_item.get("订单号") or raw_item.get("job_id")
        if not order_id:
            logger.warning(f"第 {index+1} 条打印队列项缺少订单号，跳过")
            return None
        item["order_id"] = str(order_id).strip()
        
        # 添加时间
        added_time = raw_item.get("added_time") or raw_item.get("添加时间") or raw_item.get("submit_time")
        if added_time:
            if isinstance(added_time, str):
                parsed = DateTimeHelper.parse_datetime(added_time)
                if parsed:
                    item["added_time"] = parsed
            else:
                item["added_time"] = added_time
        
        # 状态
        status = raw_item.get("status") or raw_item.get("状态")
        if status:
            item["status"] = str(status).strip()
        
        # 打印机
        item["printer"] = raw_item.get("printer") or raw_item.get("打印机")
        
        # 份数
        copies = raw_item.get("copies") or raw_item.get("份数") or raw_item.get("count")
        if copies:
            try:
                item["copies"] = int(copies)
            except ValueError:
                item["copies"] = 1
        
        # 优先级
        item["priority"] = raw_item.get("priority") or raw_item.get("优先级") or "普通"
        
        return item


class ExportFolderScanner:
    """
    导出文件夹扫描器
    扫描导出文件夹，获取所有照片文件信息
    """
    
    # 支持的图片扩展名
    SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"]
    
    def __init__(self):
        self.file_parser = FileNameParser()
    
    def scan(self, folder_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        扫描导出文件夹
        
        Args:
            folder_path: 文件夹路径
            
        Returns:
            (文件信息列表, 错误信息列表)
        """
        files_info = []
        errors = []
        
        if not os.path.exists(folder_path):
            errors.append(f"导出文件夹不存在: {folder_path}")
            return files_info, errors
        
        if not os.path.isdir(folder_path):
            errors.append(f"路径不是文件夹: {folder_path}")
            return files_info, errors
        
        # 获取所有图片文件
        file_paths = get_file_list(folder_path, self.SUPPORTED_EXTENSIONS)
        
        for file_path in file_paths:
            try:
                file_info = self._parse_file(file_path)
                if file_info:
                    files_info.append(file_info)
            except Exception as e:
                errors.append(f"处理文件失败: {file_path}, 错误: {str(e)}")
        
        logger.info(f"扫描导出文件夹完成，共 {len(files_info)} 个图片文件，{len(errors)} 个错误")
        return files_info, errors
    
    def _parse_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        解析单个文件信息
        
        Args:
            file_path: 文件路径
            
        Returns:
            文件信息字典
        """
        filename = os.path.basename(file_path)
        dirname = os.path.dirname(file_path)
        
        file_info = {
            "file_path": file_path,
            "filename": filename,
            "directory": dirname,
            "file_size": os.path.getsize(file_path),
            "modified_time": datetime.fromtimestamp(os.path.getmtime(file_path)),
            "parsed_info": None,
            "is_valid_name": False,
        }
        
        # 尝试解析文件名
        parsed = self.file_parser.parse(filename)
        if parsed:
            file_info["parsed_info"] = parsed
            file_info["is_valid_name"] = True
        
        return file_info


class DataManager:
    """
    数据管理器
    统一管理所有数据的读取和访问
    """
    
    def __init__(self, data_dir: str = None):
        """
        初始化数据管理器
        
        Args:
            data_dir: 数据目录路径
        """
        self.data_dir = data_dir or DATA_DIR
        
        # 初始化读取器
        self.order_reader = OrderCSVReader()
        self.retouch_reader = RetouchRecordReader()
        self.print_reader = PrintQueueReader()
        self.folder_scanner = ExportFolderScanner()
        
        # 缓存数据
        self._orders: List[Dict[str, Any]] = []
        self._retouch_records: List[Dict[str, Any]] = []
        self._print_queue: List[Dict[str, Any]] = []
        self._export_files: List[Dict[str, Any]] = []
        
        # 错误信息
        self._errors: List[str] = []
    
    def load_all(self, 
                 order_csv: str = None,
                 retouch_json: str = None,
                 print_json: str = None,
                 export_folder: str = None) -> Dict[str, Any]:
        """
        加载所有数据
        
        Args:
            order_csv: 订单CSV文件路径（可选，默认在data_dir中查找）
            retouch_json: 修图记录JSON路径
            print_json: 打印队列JSON路径
            export_folder: 导出文件夹路径
            
        Returns:
            加载结果摘要
        """
        self._errors = []
        
        # 查找默认文件
        if not order_csv:
            order_csv = self._find_file(["orders.csv", "订单.csv", "order.csv"])
        if not retouch_json:
            retouch_json = self._find_file(["retouch.json", "修图记录.json", "retouch_records.json"])
        if not print_json:
            print_json = self._find_file(["print_queue.json", "打印队列.json", "print.json"])
        if not export_folder:
            export_folder = self._find_folder(["export", "导出", "exports", "output"])
        
        # 加载订单
        if order_csv and os.path.exists(order_csv):
            orders, errors = self.order_reader.read(order_csv)
            self._orders = orders
            self._errors.extend(errors)
        else:
            self._errors.append(f"未找到订单CSV文件")
        
        # 加载修图记录
        if retouch_json and os.path.exists(retouch_json):
            records, errors = self.retouch_reader.read(retouch_json)
            self._retouch_records = records
            self._errors.extend(errors)
        
        # 加载打印队列
        if print_json and os.path.exists(print_json):
            queue, errors = self.print_reader.read(print_json)
            self._print_queue = queue
            self._errors.extend(errors)
        
        # 扫描导出文件夹
        if export_folder and os.path.exists(export_folder):
            files, errors = self.folder_scanner.scan(export_folder)
            self._export_files = files
            self._errors.extend(errors)
        else:
            self._errors.append(f"未找到导出文件夹")
        
        return {
            "orders_count": len(self._orders),
            "retouch_records_count": len(self._retouch_records),
            "print_queue_count": len(self._print_queue),
            "export_files_count": len(self._export_files),
            "errors_count": len(self._errors),
            "errors": self._errors[:10],  # 只返回前10个错误
        }
    
    def _find_file(self, possible_names: List[str]) -> Optional[str]:
        """
        在数据目录中查找文件
        
        Args:
            possible_names: 可能的文件名列表
            
        Returns:
            找到的文件路径，未找到返回None
        """
        for name in possible_names:
            path = os.path.join(self.data_dir, name)
            if os.path.exists(path):
                return path
        return None
    
    def _find_folder(self, possible_names: List[str]) -> Optional[str]:
        """
        在数据目录中查找文件夹
        
        Args:
            possible_names: 可能的文件夹名列表
            
        Returns:
            找到的文件夹路径，未找到返回None
        """
        for name in possible_names:
            path = os.path.join(self.data_dir, name)
            if os.path.isdir(path):
                return path
        return None
    
    @property
    def orders(self) -> List[Dict[str, Any]]:
        """获取订单列表"""
        return self._orders
    
    @property
    def retouch_records(self) -> List[Dict[str, Any]]:
        """获取修图记录列表"""
        return self._retouch_records
    
    @property
    def print_queue(self) -> List[Dict[str, Any]]:
        """获取打印队列列表"""
        return self._print_queue
    
    @property
    def export_files(self) -> List[Dict[str, Any]]:
        """获取导出文件列表"""
        return self._export_files
    
    @property
    def errors(self) -> List[str]:
        """获取错误信息列表"""
        return self._errors
    
    def get_order_by_id(self, order_id: str) -> Optional[Dict[str, Any]]:
        """
        根据订单号获取订单
        
        Args:
            order_id: 订单号
            
        Returns:
            订单字典，未找到返回None
        """
        for order in self._orders:
            if order.get("order_id") == order_id:
                return order
        return None
    
    def get_retouch_record_by_order_id(self, order_id: str) -> Optional[Dict[str, Any]]:
        """
        根据订单号获取修图记录
        
        Args:
            order_id: 订单号
            
        Returns:
            修图记录字典，未找到返回None
        """
        for record in self._retouch_records:
            if record.get("order_id") == order_id:
                return record
        return None
    
    def get_print_items_by_order_id(self, order_id: str) -> List[Dict[str, Any]]:
        """
        根据订单号获取打印队列项
        
        Args:
            order_id: 订单号
            
        Returns:
            打印队列项列表
        """
        return [item for item in self._print_queue if item.get("order_id") == order_id]
    
    def get_export_files_by_order_id(self, order_id: str) -> List[Dict[str, Any]]:
        """
        根据订单号获取导出文件
        
        Args:
            order_id: 订单号
            
        Returns:
            导出文件列表
        """
        files = []
        for file_info in self._export_files:
            parsed = file_info.get("parsed_info")
            if parsed and parsed.get("order_id") == order_id:
                files.append(file_info)
        return files
