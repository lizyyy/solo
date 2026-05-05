# -*- coding: utf-8 -*-
"""
证件照影楼交付前复核工具 - 问题检测引擎
负责检测各种交付前的问题：漏尺寸、背景色不符、文件命名撞单、
未修完却进打印、加急单超时等
"""

import os
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Set
from config import (
    ISSUE_TYPES, STANDARD_SIZES, STANDARD_BACKGROUNDS,
    URGENT_CONFIG, RETOUCH_STATUS
)
from utils import (
    logger, FileNameParser, ImageAnalyzer, 
    DateTimeHelper, DataValidator
)
from data_reader import DataManager


class BaseDetector:
    """
    问题检测器基类
    所有具体检测器都应该继承此类
    """
    
    def __init__(self, data_manager: DataManager):
        """
        初始化检测器
        
        Args:
            data_manager: 数据管理器实例
        """
        self.data_manager = data_manager
        self.file_parser = FileNameParser()
        self.image_analyzer = ImageAnalyzer()
        self.issues: List[Dict[str, Any]] = []
    
    def detect(self) -> List[Dict[str, Any]]:
        """
        执行检测
        
        Returns:
            检测到的问题列表
        """
        raise NotImplementedError("子类必须实现detect方法")
    
    def _add_issue(self, issue_type: str, order_id: str, 
                   details: Dict[str, Any] = None, severity: str = None):
        """
        添加问题
        
        Args:
            issue_type: 问题类型
            order_id: 订单号
            details: 详细信息
            severity: 严重程度（可选，默认使用配置中的值）
        """
        issue_config = ISSUE_TYPES.get(issue_type, {})
        issue = {
            "issue_type": issue_type,
            "issue_name": issue_config.get("name", issue_type),
            "severity": severity or issue_config.get("severity", "medium"),
            "order_id": order_id,
            "detected_time": datetime.now(),
            "details": details or {},
            "resolved": False,
            "resolution_notes": None,
        }
        self.issues.append(issue)
        logger.debug(f"检测到问题: {issue_type} - 订单 {order_id}")


class MissingSizeDetector(BaseDetector):
    """
    漏尺寸检测器
    检测订单要求的尺寸在导出文件夹中是否缺失
    """
    
    def detect(self) -> List[Dict[str, Any]]:
        """
        执行漏尺寸检测
        
        检测逻辑：
        1. 遍历每个订单
        2. 获取订单要求的所有尺寸
        3. 检查导出文件夹中是否有对应尺寸的文件
        4. 记录缺失的尺寸
        """
        self.issues = []
        
        orders = self.data_manager.orders
        export_files = self.data_manager.export_files
        
        # 构建订单号到导出文件的映射
        order_to_files: Dict[str, List[Dict[str, Any]]] = {}
        for file_info in export_files:
            parsed = file_info.get("parsed_info")
            if parsed:
                order_id = parsed.get("order_id")
                if order_id:
                    if order_id not in order_to_files:
                        order_to_files[order_id] = []
                    order_to_files[order_id].append(file_info)
        
        # 检查每个订单
        for order in orders:
            order_id = order.get("order_id")
            required_sizes = order.get("sizes", [])
            
            if not required_sizes:
                continue
            
            # 获取该订单已有的文件尺寸
            existing_sizes: Set[str] = set()
            if order_id in order_to_files:
                for file_info in order_to_files[order_id]:
                    parsed = file_info.get("parsed_info")
                    if parsed:
                        size = parsed.get("size")
                        if size:
                            existing_sizes.add(size)
            
            # 检查缺失的尺寸
            missing_sizes = []
            for required_size in required_sizes:
                # 检查尺寸是否完全匹配
                if required_size not in existing_sizes:
                    # 尝试模糊匹配（例如"一寸"和"1寸"）
                    matched = False
                    for existing in existing_sizes:
                        if self._fuzzy_match_size(required_size, existing):
                            matched = True
                            break
                    if not matched:
                        missing_sizes.append(required_size)
            
            if missing_sizes:
                self._add_issue(
                    issue_type="missing_size",
                    order_id=order_id,
                    details={
                        "required_sizes": required_sizes,
                        "existing_sizes": list(existing_sizes),
                        "missing_sizes": missing_sizes,
                        "customer_name": order.get("customer_name"),
                    }
                )
        
        logger.info(f"漏尺寸检测完成，发现 {len(self.issues)} 个问题")
        return self.issues
    
    def _fuzzy_match_size(self, size1: str, size2: str) -> bool:
        """
        模糊匹配尺寸名称
        
        Args:
            size1: 第一个尺寸名称
            size2: 第二个尺寸名称
            
        Returns:
            是否匹配
        """
        # 移除空格
        s1 = size1.replace(" ", "")
        s2 = size2.replace(" ", "")
        
        # 直接匹配
        if s1 == s2:
            return True
        
        # 中文数字和阿拉伯数字转换
        num_map = {
            "一": "1", "二": "2", "三": "3", "四": "4", "五": "5",
            "六": "6", "七": "7", "八": "8", "九": "9", "十": "10",
            "小": "", "大": "",
        }
        
        for cn, num in num_map.items():
            s1 = s1.replace(cn, num)
            s2 = s2.replace(cn, num)
        
        return s1 == s2


class BackgroundMismatchDetector(BaseDetector):
    """
    背景色不符检测器
    检测实际背景色与订单要求是否不符
    """
    
    def detect(self) -> List[Dict[str, Any]]:
        """
        执行背景色不符检测
        
        检测逻辑：
        1. 遍历每个导出文件
        2. 获取订单要求的背景色
        3. 分析图片实际背景色
        4. 比较是否匹配
        """
        self.issues = []
        
        orders = self.data_manager.orders
        export_files = self.data_manager.export_files
        
        # 构建订单号到订单的映射
        order_map: Dict[str, Dict[str, Any]] = {}
        for order in orders:
            order_id = order.get("order_id")
            if order_id:
                order_map[order_id] = order
        
        # 检查每个导出文件
        for file_info in export_files:
            parsed = file_info.get("parsed_info")
            if not parsed:
                continue
            
            order_id = parsed.get("order_id")
            file_background = parsed.get("background")
            file_path = file_info.get("file_path")
            filename = file_info.get("filename")
            
            if not order_id or not file_path:
                continue
            
            # 获取订单要求的背景色
            required_background = None
            if order_id in order_map:
                required_background = order_map[order_id].get("background")
            
            # 如果订单没有指定背景色，使用文件名中的背景色作为期望
            expected_background = required_background or file_background
            
            if not expected_background:
                continue
            
            # 检查期望的背景色是否是标准背景色
            if expected_background not in STANDARD_BACKGROUNDS:
                logger.warning(f"未知的标准背景色: {expected_background}, 跳过检测")
                continue
            
            # 分析实际背景色
            try:
                actual_color = self.image_analyzer.analyze_background_color(file_path)
                if actual_color is None:
                    logger.warning(f"无法分析背景色: {file_path}")
                    continue
                
                # 检查是否匹配
                standard = STANDARD_BACKGROUNDS[expected_background]
                expected_color = standard["rgb"]
                tolerance = standard["tolerance"]
                
                # 计算颜色距离
                import math
                color_distance = math.sqrt(
                    (actual_color[0] - expected_color[0]) ** 2 +
                    (actual_color[1] - expected_color[1]) ** 2 +
                    (actual_color[2] - expected_color[2]) ** 2
                )
                
                if color_distance > tolerance:
                    self._add_issue(
                        issue_type="background_mismatch",
                        order_id=order_id,
                        details={
                            "filename": filename,
                            "file_path": file_path,
                            "expected_background": expected_background,
                            "expected_color": expected_color,
                            "actual_color": actual_color,
                            "color_distance": round(color_distance, 2),
                            "tolerance": tolerance,
                            "customer_name": order_map.get(order_id, {}).get("customer_name") if order_id in order_map else None,
                        }
                    )
                    
            except Exception as e:
                logger.error(f"分析背景色时出错: {file_path}, 错误: {e}")
                continue
        
        logger.info(f"背景色不符检测完成，发现 {len(self.issues)} 个问题")
        return self.issues


class NamingConflictDetector(BaseDetector):
    """
    文件命名撞单检测器
    检测同一订单号对应多个不同客户或规格的情况
    """
    
    def detect(self) -> List[Dict[str, Any]]:
        """
        执行文件命名撞单检测
        
        检测逻辑：
        1. 收集所有文件名解析后的信息
        2. 按订单号分组
        3. 检查同一订单号下的客户姓名、尺寸、背景色是否一致
        4. 记录冲突
        """
        self.issues = []
        
        export_files = self.data_manager.export_files
        orders = self.data_manager.orders
        
        # 构建订单号到订单的映射
        order_map: Dict[str, Dict[str, Any]] = {}
        for order in orders:
            order_id = order.get("order_id")
            if order_id:
                order_map[order_id] = order
        
        # 按订单号分组收集文件信息
        order_file_info: Dict[str, List[Dict[str, Any]]] = {}
        
        for file_info in export_files:
            parsed = file_info.get("parsed_info")
            if not parsed:
                continue
            
            order_id = parsed.get("order_id")
            if not order_id:
                continue
            
            if order_id not in order_file_info:
                order_file_info[order_id] = []
            
            order_file_info[order_id].append({
                "parsed": parsed,
                "filename": file_info.get("filename"),
                "file_path": file_info.get("file_path"),
            })
        
        # 检查每个订单号的文件
        for order_id, file_list in order_file_info.items():
            if len(file_list) < 1:
                continue
            
            # 获取订单中的客户信息
            order_customer = None
            if order_id in order_map:
                order_customer = order_map[order_id].get("customer_name")
            
            # 收集所有文件中的客户姓名、尺寸、背景色
            customers = set()
            sizes = set()
            backgrounds = set()
            filenames = []
            
            for file_info in file_list:
                parsed = file_info["parsed"]
                filename = file_info["filename"]
                
                customer = parsed.get("customer_name")
                size = parsed.get("size")
                background = parsed.get("background")
                
                if customer:
                    customers.add(customer)
                if size:
                    sizes.add(size)
                if background:
                    backgrounds.add(background)
                filenames.append(filename)
            
            # 检查客户姓名冲突
            conflicts = []
            
            # 1. 文件名之间的客户姓名冲突
            if len(customers) > 1:
                conflicts.append({
                    "type": "customer_conflict_in_files",
                    "message": "同一订单号对应多个不同客户姓名",
                    "customers": list(customers),
                })
            
            # 2. 文件名与订单中的客户姓名冲突
            if order_customer and customers and order_customer not in customers:
                conflicts.append({
                    "type": "customer_conflict_with_order",
                    "message": "文件名中的客户姓名与订单记录不符",
                    "order_customer": order_customer,
                    "file_customers": list(customers),
                })
            
            # 3. 同一尺寸+背景色组合出现多次（可能是重复文件）
            size_bg_combinations = {}
            for file_info in file_list:
                parsed = file_info["parsed"]
                size = parsed.get("size")
                background = parsed.get("background")
                key = (size, background)
                
                if key in size_bg_combinations:
                    size_bg_combinations[key].append(file_info["filename"])
                else:
                    size_bg_combinations[key] = [file_info["filename"]]
            
            for key, files in size_bg_combinations.items():
                if len(files) > 1:
                    conflicts.append({
                        "type": "duplicate_size_background",
                        "message": f"同一尺寸背景组合({key[0]}_{key[1]})存在多个文件",
                        "size": key[0],
                        "background": key[1],
                        "files": files,
                    })
            
            if conflicts:
                self._add_issue(
                    issue_type="naming_conflict",
                    order_id=order_id,
                    details={
                        "conflicts": conflicts,
                        "filenames": filenames,
                        "customers": list(customers),
                        "sizes": list(sizes),
                        "backgrounds": list(backgrounds),
                        "order_customer": order_customer,
                    }
                )
        
        logger.info(f"文件命名撞单检测完成，发现 {len(self.issues)} 个问题")
        return self.issues


class UnfinishedInPrintDetector(BaseDetector):
    """
    未修完却进打印检测器
    检测修图未完成的订单是否进入了打印队列
    """
    
    def detect(self) -> List[Dict[str, Any]]:
        """
        执行未修完却进打印检测
        
        检测逻辑：
        1. 获取所有打印队列中的订单
        2. 检查每个订单的修图状态
        3. 如果修图未完成但已在打印队列中，记录问题
        """
        self.issues = []
        
        print_queue = self.data_manager.print_queue
        retouch_records = self.data_manager.retouch_records
        orders = self.data_manager.orders
        
        # 构建订单号到修图记录的映射
        retouch_map: Dict[str, Dict[str, Any]] = {}
        for record in retouch_records:
            order_id = record.get("order_id")
            if order_id:
                retouch_map[order_id] = record
        
        # 构建订单号到订单的映射
        order_map: Dict[str, Dict[str, Any]] = {}
        for order in orders:
            order_id = order.get("order_id")
            if order_id:
                order_map[order_id] = order
        
        # 定义未完成的修图状态
        unfinished_statuses = {"pending", "in_progress", "reviewing", "rejected",
                               "待修图", "修图中", "审核中", "已驳回"}
        
        # 检查打印队列中的每个订单
        for print_item in print_queue:
            order_id = print_item.get("order_id")
            if not order_id:
                continue
            
            # 获取修图记录
            retouch_record = retouch_map.get(order_id)
            
            # 情况1：没有修图记录（可能跳过了修图流程）
            if not retouch_record:
                self._add_issue(
                    issue_type="unfinished_in_print",
                    order_id=order_id,
                    details={
                        "print_status": print_item.get("status"),
                        "print_added_time": print_item.get("added_time"),
                        "printer": print_item.get("printer"),
                        "copies": print_item.get("copies"),
                        "customer_name": order_map.get(order_id, {}).get("customer_name"),
                        "issue_detail": "订单无修图记录但已进入打印队列",
                    }
                )
                continue
            
            # 情况2：有修图记录但状态未完成
            retouch_status = retouch_record.get("status", "")
            
            if retouch_status in unfinished_statuses:
                self._add_issue(
                    issue_type="unfinished_in_print",
                    order_id=order_id,
                    details={
                        "retouch_status": retouch_status,
                        "retouch_start_time": retouch_record.get("start_time"),
                        "retouch_end_time": retouch_record.get("end_time"),
                        "retoucher": retouch_record.get("retoucher"),
                        "print_status": print_item.get("status"),
                        "print_added_time": print_item.get("added_time"),
                        "printer": print_item.get("printer"),
                        "copies": print_item.get("copies"),
                        "customer_name": order_map.get(order_id, {}).get("customer_name"),
                        "issue_detail": f"修图状态为'{retouch_status}'但已进入打印队列",
                    }
                )
        
        logger.info(f"未修完却进打印检测完成，发现 {len(self.issues)} 个问题")
        return self.issues


class UrgentOvertimeDetector(BaseDetector):
    """
    加急单超时检测器
    检测加急单是否超出规定时间限制
    """
    
    def detect(self) -> List[Dict[str, Any]]:
        """
        执行加急单超时检测
        
        检测逻辑：
        1. 获取所有加急订单
        2. 计算从下单到现在的时间
        3. 检查是否超出加急单时间限制
        """
        self.issues = []
        
        orders = self.data_manager.orders
        retouch_records = self.data_manager.retouch_records
        
        # 构建订单号到修图记录的映射
        retouch_map: Dict[str, Dict[str, Any]] = {}
        for record in retouch_records:
            order_id = record.get("order_id")
            if order_id:
                retouch_map[order_id] = record
        
        # 获取时间限制
        time_limit_hours = URGENT_CONFIG.get("time_limit_hours", 2)
        urgent_keywords = URGENT_CONFIG.get("urgent_keywords", ["加急", "特急", "紧急"])
        
        # 检查每个订单
        for order in orders:
            order_id = order.get("order_id")
            if not order_id:
                continue
            
            # 判断是否为加急单
            is_urgent = False
            
            # 检查priority字段
            priority = order.get("priority", "")
            if priority:
                for keyword in urgent_keywords:
                    if keyword in str(priority):
                        is_urgent = True
                        break
            
            # 检查remarks字段
            remarks = order.get("remarks", "")
            if remarks and not is_urgent:
                for keyword in urgent_keywords:
                    if keyword in str(remarks):
                        is_urgent = True
                        break
            
            # 检查修图记录中的优先级
            if not is_urgent and order_id in retouch_map:
                retouch_record = retouch_map[order_id]
                retouch_priority = retouch_record.get("priority", "")
                if retouch_priority:
                    for keyword in urgent_keywords:
                        if keyword in str(retouch_priority):
                            is_urgent = True
                            break
            
            if not is_urgent:
                continue
            
            # 获取开始时间
            start_time = None
            
            # 优先使用订单创建时间
            if order.get("create_time"):
                if isinstance(order["create_time"], datetime):
                    start_time = order["create_time"]
            
            # 其次使用修图开始时间
            if not start_time and order_id in retouch_map:
                retouch_start = retouch_map[order_id].get("start_time")
                if isinstance(retouch_start, datetime):
                    start_time = retouch_start
            
            if not start_time:
                logger.warning(f"加急单 {order_id} 无法确定开始时间，跳过超时检测")
                continue
            
            # 检查是否超时
            current_time = datetime.now()
            is_overtime, time_info = DateTimeHelper.is_urgent_overtime(
                start_time=start_time,
                limit_hours=time_limit_hours,
                current_time=current_time
            )
            
            if is_overtime:
                # 获取修图状态
                retouch_status = None
                if order_id in retouch_map:
                    retouch_status = retouch_map[order_id].get("status")
                
                self._add_issue(
                    issue_type="urgent_overtime",
                    order_id=order_id,
                    details={
                        "start_time": start_time,
                        "current_time": current_time,
                        "time_limit_hours": time_limit_hours,
                        "elapsed_hours": round(time_info["elapsed_hours"], 2),
                        "overtime_hours": round(time_info["elapsed_hours"] - time_limit_hours, 2),
                        "customer_name": order.get("customer_name"),
                        "priority": priority,
                        "retouch_status": retouch_status,
                    },
                    severity="critical"
                )
        
        logger.info(f"加急单超时检测完成，发现 {len(self.issues)} 个问题")
        return self.issues


class MissingFileDetector(BaseDetector):
    """
    文件缺失检测器
    检测订单记录存在但对应文件不存在的情况
    """
    
    def detect(self) -> List[Dict[str, Any]]:
        """
        执行文件缺失检测
        
        检测逻辑：
        1. 遍历所有订单
        2. 检查订单是否有对应的导出文件
        3. 如果订单存在但没有任何导出文件，记录问题
        """
        self.issues = []
        
        orders = self.data_manager.orders
        export_files = self.data_manager.export_files
        
        # 收集所有有导出文件的订单号
        orders_with_files = set()
        for file_info in export_files:
            parsed = file_info.get("parsed_info")
            if parsed:
                order_id = parsed.get("order_id")
                if order_id:
                    orders_with_files.add(order_id)
        
        # 检查每个订单
        for order in orders:
            order_id = order.get("order_id")
            if not order_id:
                continue
            
            # 检查订单状态是否应该有文件
            # 通常"已完成"、"已审核"、"待交付"等状态应该有文件
            status = order.get("status", "")
            status_lower = str(status).lower()
            
            # 需要检查的状态
            should_have_file = False
            need_file_statuses = ["已完成", "已审核", "待交付", "completed", "approved", "ready"]
            for s in need_file_statuses:
                if s in status or s.lower() in status_lower:
                    should_have_file = True
                    break
            
            # 如果订单应该有文件但没有
            if should_have_file and order_id not in orders_with_files:
                self._add_issue(
                    issue_type="missing_file",
                    order_id=order_id,
                    details={
                        "customer_name": order.get("customer_name"),
                        "order_status": status,
                        "required_sizes": order.get("sizes", []),
                        "background": order.get("background"),
                        "issue_detail": f"订单状态为'{status}'但无对应导出文件",
                    }
                )
        
        logger.info(f"文件缺失检测完成，发现 {len(self.issues)} 个问题")
        return self.issues


class ExtraFileDetector(BaseDetector):
    """
    多余文件检测器
    检测导出文件夹中有未在订单中记录的文件
    """
    
    def detect(self) -> List[Dict[str, Any]]:
        """
        执行多余文件检测
        
        检测逻辑：
        1. 遍历所有导出文件
        2. 检查文件对应的订单号是否在订单列表中
        3. 如果文件存在但订单不存在，记录问题
        """
        self.issues = []
        
        orders = self.data_manager.orders
        export_files = self.data_manager.export_files
        
        # 收集所有订单号
        valid_order_ids = set()
        for order in orders:
            order_id = order.get("order_id")
            if order_id:
                valid_order_ids.add(order_id)
        
        # 检查每个导出文件
        for file_info in export_files:
            parsed = file_info.get("parsed_info")
            filename = file_info.get("filename")
            file_path = file_info.get("file_path")
            
            # 情况1：文件名无法解析（可能是多余文件）
            if not parsed:
                self._add_issue(
                    issue_type="extra_file",
                    order_id="UNKNOWN",
                    details={
                        "filename": filename,
                        "file_path": file_path,
                        "file_size": file_info.get("file_size"),
                        "modified_time": file_info.get("modified_time"),
                        "issue_detail": "文件名无法解析，可能是多余文件",
                    },
                    severity="low"
                )
                continue
            
            # 情况2：文件名可以解析但订单号不在订单列表中
            order_id = parsed.get("order_id")
            if order_id and order_id not in valid_order_ids:
                self._add_issue(
                    issue_type="extra_file",
                    order_id=order_id,
                    details={
                        "filename": filename,
                        "file_path": file_path,
                        "parsed_info": parsed,
                        "file_size": file_info.get("file_size"),
                        "modified_time": file_info.get("modified_time"),
                        "issue_detail": "文件对应的订单号不在订单列表中，可能是多余文件或已取消订单",
                    },
                    severity="low"
                )
        
        logger.info(f"多余文件检测完成，发现 {len(self.issues)} 个问题")
        return self.issues


class IssueDetectorEngine:
    """
    问题检测引擎
    整合所有检测器，执行完整的问题检测
    """
    
    def __init__(self, data_manager: DataManager):
        """
        初始化检测引擎
        
        Args:
            data_manager: 数据管理器实例
        """
        self.data_manager = data_manager
        
        # 注册所有检测器
        self.detectors = [
            MissingSizeDetector(data_manager),
            BackgroundMismatchDetector(data_manager),
            NamingConflictDetector(data_manager),
            UnfinishedInPrintDetector(data_manager),
            UrgentOvertimeDetector(data_manager),
            MissingFileDetector(data_manager),
            ExtraFileDetector(data_manager),
        ]
        
        self.all_issues: List[Dict[str, Any]] = []
    
    def run_all(self) -> Dict[str, Any]:
        """
        运行所有检测器
        
        Returns:
            检测结果汇总
        """
        self.all_issues = []
        
        logger.info("开始执行问题检测...")
        
        for detector in self.detectors:
            detector_name = detector.__class__.__name__
            logger.info(f"运行检测器: {detector_name}")
            
            try:
                issues = detector.detect()
                self.all_issues.extend(issues)
            except Exception as e:
                logger.error(f"检测器 {detector_name} 运行失败: {e}")
        
        # 统计结果
        result = self._generate_summary()
        
        logger.info(f"问题检测完成，共发现 {len(self.all_issues)} 个问题")
        return result
    
    def _generate_summary(self) -> Dict[str, Any]:
        """
        生成检测结果汇总
        
        Returns:
            汇总信息
        """
        # 按问题类型分组
        issues_by_type: Dict[str, List[Dict[str, Any]]] = {}
        for issue in self.all_issues:
            issue_type = issue["issue_type"]
            if issue_type not in issues_by_type:
                issues_by_type[issue_type] = []
            issues_by_type[issue_type].append(issue)
        
        # 按严重程度分组
        issues_by_severity: Dict[str, List[Dict[str, Any]]] = {}
        for issue in self.all_issues:
            severity = issue["severity"]
            if severity not in issues_by_severity:
                issues_by_severity[severity] = []
            issues_by_severity[severity].append(issue)
        
        # 按订单号分组
        issues_by_order: Dict[str, List[Dict[str, Any]]] = {}
        for issue in self.all_issues:
            order_id = issue["order_id"]
            if order_id not in issues_by_order:
                issues_by_order[order_id] = []
            issues_by_order[order_id].append(issue)
        
        return {
            "total_issues": len(self.all_issues),
            "issues_by_type": {
                issue_type: {
                    "count": len(issues),
                    "name": ISSUE_TYPES.get(issue_type, {}).get("name", issue_type),
                    "issues": issues,
                }
                for issue_type, issues in issues_by_type.items()
            },
            "issues_by_severity": {
                severity: {
                    "count": len(issues),
                    "issues": issues,
                }
                for severity, issues in issues_by_severity.items()
            },
            "issues_by_order": issues_by_order,
            "detection_time": datetime.now(),
        }
    
    def get_issues_by_order(self, order_id: str) -> List[Dict[str, Any]]:
        """
        获取指定订单的所有问题
        
        Args:
            order_id: 订单号
            
        Returns:
            问题列表
        """
        return [issue for issue in self.all_issues if issue["order_id"] == order_id]
    
    def get_issues_by_type(self, issue_type: str) -> List[Dict[str, Any]]:
        """
        获取指定类型的所有问题
        
        Args:
            issue_type: 问题类型
            
        Returns:
            问题列表
        """
        return [issue for issue in self.all_issues if issue["issue_type"] == issue_type]
    
    def get_issues_by_severity(self, severity: str) -> List[Dict[str, Any]]:
        """
        获取指定严重程度的所有问题
        
        Args:
            severity: 严重程度
            
        Returns:
            问题列表
        """
        return [issue for issue in self.all_issues if issue["severity"] == severity]
