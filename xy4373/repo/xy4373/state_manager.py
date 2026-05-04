import os
import json
import shutil
from typing import List, Dict, Any, Optional
from datetime import datetime
from config import config
import logging

logger = logging.getLogger(__name__)


class StateManager:
    """状态管理器，用于保存和恢复检查状态"""
    
    def __init__(self, state_file: str = None):
        self.state_file = state_file or config.state_file
        self._state: Dict[str, Any] = {
            "version": "1.0",
            "last_updated": None,
            "projects": {},
            "check_results": [],
            "fix_confirmations": {}
        }
        self._load_state()
    
    def _load_state(self) -> None:
        """从文件加载状态"""
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    self._state = json.load(f)
                logger.info(f"状态已从 {self.state_file} 加载")
            except Exception as e:
                logger.warning(f"加载状态文件时出错: {str(e)}，将使用空状态")
                # 备份损坏的状态文件
                if os.path.exists(self.state_file):
                    backup_file = f"{self.state_file}.backup.{datetime.now().strftime('%Y%m%d%H%M%S')}"
                    shutil.copy2(self.state_file, backup_file)
                    logger.info(f"已备份损坏的状态文件到 {backup_file}")
    
    def _save_state(self) -> None:
        """保存状态到文件"""
        try:
            self._state["last_updated"] = datetime.now().isoformat()
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(self._state, f, ensure_ascii=False, indent=2)
            logger.info(f"状态已保存到 {self.state_file}")
        except Exception as e:
            logger.error(f"保存状态文件时出错: {str(e)}")
    
    def save_project_scan(self, directory_path: str, scan_results: List[Dict[str, Any]]) -> None:
        """
        保存项目扫描结果
        
        Args:
            directory_path: 项目目录路径
            scan_results: 扫描结果列表
        """
        project_id = self._get_project_id(directory_path)
        
        # 保存项目信息
        self._state["projects"][project_id] = {
            "path": directory_path,
            "scan_time": datetime.now().isoformat(),
            "scan_results": scan_results
        }
        
        self._save_state()
    
    def save_check_result(self, check_result: Dict[str, Any]) -> None:
        """
        保存单个检查结果
        
        Args:
            check_result: 检查结果字典（来自 Checker.check_program）
        """
        folder_path = check_result["folder_path"]
        
        # 查找是否已存在此文件夹的检查结果
        existing_index = None
        for i, result in enumerate(self._state["check_results"]):
            if result["folder_path"] == folder_path:
                existing_index = i
                break
        
        if existing_index is not None:
            # 保留修复确认状态
            if "fix_confirmations" in self._state["check_results"][existing_index]:
                check_result["fix_confirmations"] = self._state["check_results"][existing_index]["fix_confirmations"]
            
            # 更新现有结果
            self._state["check_results"][existing_index] = check_result
        else:
            # 添加新结果
            check_result["fix_confirmations"] = {}
            self._state["check_results"].append(check_result)
        
        self._save_state()
    
    def save_check_results(self, check_results: List[Dict[str, Any]]) -> None:
        """
        批量保存检查结果
        
        Args:
            check_results: 检查结果列表
        """
        for result in check_results:
            self.save_check_result(result)
    
    def get_check_results(self, directory_path: str = None) -> List[Dict[str, Any]]:
        """
        获取检查结果
        
        Args:
            directory_path: 可选，指定项目目录路径，只返回该目录下的结果
            
        Returns:
            检查结果列表
        """
        if directory_path:
            project_id = self._get_project_id(directory_path)
            # 查找属于该项目的检查结果
            return [
                result for result in self._state["check_results"]
                if result["folder_path"].startswith(directory_path)
            ]
        else:
            return self._state["check_results"].copy()
    
    def get_pending_items(self, directory_path: str = None) -> List[Dict[str, Any]]:
        """
        获取待处理的检查项（未通过且未确认修复的项）
        
        Args:
            directory_path: 可选，指定项目目录路径
            
        Returns:
            待处理项列表
        """
        pending_items = []
        check_results = self.get_check_results(directory_path)
        
        for result in check_results:
            folder_name = result["folder_name"]
            folder_path = result["folder_path"]
            program_name = result["program_name"]
            overall_status = result["overall_status"]
            checks = result.get("checks", [])
            fix_confirmations = result.get("fix_confirmations", {})
            
            for check in checks:
                check_type = check["type"]
                status = check["status"]
                message = check["message"]
                severity = check["severity"]
                
                # 检查是否为未通过的项
                if status in ["failed", "warning"]:
                    # 检查是否已确认修复
                    is_confirmed = fix_confirmations.get(check_type, False)
                    
                    if not is_confirmed:
                        pending_items.append({
                            "folder_name": folder_name,
                            "folder_path": folder_path,
                            "program_name": program_name,
                            "overall_status": overall_status,
                            "check_type": check_type,
                            "check_status": status,
                            "message": message,
                            "severity": severity,
                            "is_confirmed": is_confirmed
                        })
        
        # 按严重程度排序
        severity_order = {"high": 0, "medium": 1, "low": 2, "info": 3}
        pending_items.sort(key=lambda x: severity_order.get(x["severity"], 3))
        
        return pending_items
    
    def confirm_fix(self, folder_path: str, check_type: str) -> bool:
        """
        确认修复某个检查项
        
        Args:
            folder_path: 文件夹路径
            check_type: 检查类型
            
        Returns:
            是否成功确认
        """
        for result in self._state["check_results"]:
            if result["folder_path"] == folder_path:
                if "fix_confirmations" not in result:
                    result["fix_confirmations"] = {}
                
                result["fix_confirmations"][check_type] = True
                result["fix_confirmations"][f"{check_type}_time"] = datetime.now().isoformat()
                
                # 更新整体状态
                self._update_overall_status(result)
                
                self._save_state()
                logger.info(f"已确认修复: {folder_path} - {check_type}")
                return True
        
        logger.warning(f"未找到检查结果: {folder_path}")
        return False
    
    def unconfirm_fix(self, folder_path: str, check_type: str) -> bool:
        """
        取消确认修复
        
        Args:
            folder_path: 文件夹路径
            check_type: 检查类型
            
        Returns:
            是否成功取消确认
        """
        for result in self._state["check_results"]:
            if result["folder_path"] == folder_path:
                if "fix_confirmations" in result and check_type in result["fix_confirmations"]:
                    del result["fix_confirmations"][check_type]
                    # 也删除时间戳
                    time_key = f"{check_type}_time"
                    if time_key in result["fix_confirmations"]:
                        del result["fix_confirmations"][time_key]
                    
                    # 更新整体状态
                    self._update_overall_status(result)
                    
                    self._save_state()
                    logger.info(f"已取消确认修复: {folder_path} - {check_type}")
                    return True
        
        logger.warning(f"未找到检查结果或确认记录: {folder_path} - {check_type}")
        return False
    
    def _update_overall_status(self, result: Dict[str, Any]) -> None:
        """更新检查结果的整体状态"""
        checks = result.get("checks", [])
        fix_confirmations = result.get("fix_confirmations", {})
        
        # 统计未确认的问题
        unconfirmed_failed = 0
        unconfirmed_warning = 0
        passed = 0
        
        for check in checks:
            check_type = check["type"]
            status = check["status"]
            is_confirmed = fix_confirmations.get(check_type, False)
            
            if is_confirmed:
                # 已确认修复的项视为已解决
                passed += 1
            elif status == "failed":
                unconfirmed_failed += 1
            elif status == "warning":
                unconfirmed_warning += 1
            elif status == "passed":
                passed += 1
        
        # 确定整体状态
        if unconfirmed_failed > 0:
            result["overall_status"] = "failed"
        elif unconfirmed_warning > 0:
            result["overall_status"] = "warning"
        elif passed == len(checks):
            result["overall_status"] = "passed"
        else:
            result["overall_status"] = "unknown"
    
    def export_report(self, directory_path: str = None, format: str = "json") -> str:
        """
        导出检查报告
        
        Args:
            directory_path: 可选，指定项目目录路径
            format: 导出格式，支持 "json", "csv", "html"
            
        Returns:
            报告内容（字符串）
        """
        check_results = self.get_check_results(directory_path)
        pending_items = self.get_pending_items(directory_path)
        
        # 统计信息
        total_programs = len(check_results)
        total_passed = sum(1 for r in check_results if r["overall_status"] == "passed")
        total_failed = sum(1 for r in check_results if r["overall_status"] == "failed")
        total_warning = sum(1 for r in check_results if r["overall_status"] == "warning")
        total_pending = len(pending_items)
        
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_programs": total_programs,
                "passed": total_passed,
                "failed": total_failed,
                "warning": total_warning,
                "pending_items": total_pending
            },
            "programs": check_results,
            "pending_items": pending_items
        }
        
        if format == "json":
            return json.dumps(report_data, ensure_ascii=False, indent=2)
        
        elif format == "csv":
            # 生成CSV格式
            lines = []
            # 表头
            lines.append("节目名称,文件夹,状态,检查类型,检查状态,消息,严重程度,是否已确认")
            
            # 数据行
            for item in pending_items:
                line = f'"{item["program_name"]}","{item["folder_name"]}","{item["overall_status"]}","{item["check_type"]}","{item["check_status"]}","{item["message"]}","{item["severity"]}","{item["is_confirmed"]}"'
                lines.append(line)
            
            return "\n".join(lines)
        
        elif format == "html":
            # 生成HTML格式
            html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>播客交付检查报告</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
        h1 {{ color: #333; }}
        .summary {{ background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
        .summary-item {{ display: inline-block; margin-right: 20px; }}
        .passed {{ color: green; font-weight: bold; }}
        .failed {{ color: red; font-weight: bold; }}
        .warning {{ color: orange; font-weight: bold; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        tr:nth-child(even) {{ background-color: #f9f9f9; }}
        .severity-high {{ color: red; }}
        .severity-medium {{ color: orange; }}
        .severity-low {{ color: blue; }}
        .generated-at {{ color: #666; font-size: 12px; margin-top: 20px; }}
    </style>
</head>
<body>
    <h1>播客交付检查报告</h1>
    
    <div class="summary">
        <h2>概览</h2>
        <div class="summary-item">总节目数: <strong>{total_programs}</strong></div>
        <div class="summary-item">通过: <span class="passed">{total_passed}</span></div>
        <div class="summary-item">失败: <span class="failed">{total_failed}</span></div>
        <div class="summary-item">警告: <span class="warning">{total_warning}</span></div>
        <div class="summary-item">待处理项: <strong>{total_pending}</strong></div>
    </div>
    
    <h2>待处理项</h2>
    <table>
        <thead>
            <tr>
                <th>节目名称</th>
                <th>文件夹</th>
                <th>整体状态</th>
                <th>检查类型</th>
                <th>检查状态</th>
                <th>消息</th>
                <th>严重程度</th>
            </tr>
        </thead>
        <tbody>
"""
            
            for item in pending_items:
                status_class = ""
                if item["overall_status"] == "passed":
                    status_class = "passed"
                elif item["overall_status"] == "failed":
                    status_class = "failed"
                elif item["overall_status"] == "warning":
                    status_class = "warning"
                
                check_status_class = ""
                if item["check_status"] == "passed":
                    check_status_class = "passed"
                elif item["check_status"] == "failed":
                    check_status_class = "failed"
                elif item["check_status"] == "warning":
                    check_status_class = "warning"
                
                severity_class = f"severity-{item['severity']}"
                
                html += f"""            <tr>
                <td>{item['program_name']}</td>
                <td>{item['folder_name']}</td>
                <td class="{status_class}">{item['overall_status']}</td>
                <td>{item['check_type']}</td>
                <td class="{check_status_class}">{item['check_status']}</td>
                <td>{item['message']}</td>
                <td class="{severity_class}">{item['severity']}</td>
            </tr>
"""
            
            html += f"""        </tbody>
    </table>
    
    <div class="generated-at">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
</body>
</html>"""
            
            return html
        
        else:
            logger.warning(f"不支持的导出格式: {format}，使用JSON格式")
            return json.dumps(report_data, ensure_ascii=False, indent=2)
    
    def export_report_to_file(self, file_path: str, directory_path: str = None, format: str = None) -> bool:
        """
        导出检查报告到文件
        
        Args:
            file_path: 目标文件路径
            directory_path: 可选，指定项目目录路径
            format: 导出格式，默认根据文件扩展名推断
            
        Returns:
            是否成功导出
        """
        # 根据文件扩展名推断格式
        if format is None:
            ext = os.path.splitext(file_path)[1].lower()
            if ext == ".json":
                format = "json"
            elif ext == ".csv":
                format = "csv"
            elif ext == ".html":
                format = "html"
            else:
                format = "json"
        
        try:
            report_content = self.export_report(directory_path, format)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(report_content)
            
            logger.info(f"报告已导出到: {file_path}")
            return True
        except Exception as e:
            logger.error(f"导出报告时出错: {str(e)}")
            return False
    
    def reset_state(self) -> None:
        """重置状态（清空所有数据）"""
        self._state = {
            "version": "1.0",
            "last_updated": None,
            "projects": {},
            "check_results": [],
            "fix_confirmations": {}
        }
        self._save_state()
        logger.info("状态已重置")
    
    def _get_project_id(self, directory_path: str) -> str:
        """根据目录路径生成项目ID"""
        # 使用绝对路径的哈希作为ID
        import hashlib
        abs_path = os.path.abspath(directory_path)
        return hashlib.md5(abs_path.encode('utf-8')).hexdigest()
