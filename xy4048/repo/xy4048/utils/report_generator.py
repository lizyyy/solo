import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

from config import CONFIG, TaskStatus
from database import (
    DatabaseManager, DeliveryTask, CoolerBox, DrugBatch,
    DeliveryRoute, DeliveryPoint, PackingItem, TemperatureReading,
    Attachment, AuditLog, AuditPackage, ExceptionRecord,
    AttachmentType, ExceptionType
)
from utils import AttachmentManager


@dataclass
class TemperatureRiskAssessment:
    total_readings: int = 0
    overtemp_count: int = 0
    max_temperature: float = 0.0
    min_temperature: float = 0.0
    avg_temperature: float = 0.0
    has_consecutive_overtemp: bool = False
    consecutive_count: int = 0
    risk_level: str = "正常"
    risk_details: str = ""


class ReportGenerator:
    def __init__(self, db: DatabaseManager):
        self.db = db
        self.config = CONFIG
        self.attachment_manager = AttachmentManager(db)
    
    def assess_temperature_risk(self, task_id: int) -> TemperatureRiskAssessment:
        readings = self.db.get_all(
            TemperatureReading,
            "task_id = ?",
            (task_id,)
        )
        
        if not readings:
            return TemperatureRiskAssessment(
                risk_level="无数据",
                risk_details="没有温度读数"
            )
        
        temperatures = [r.temperature for r in readings]
        overtemp_readings = [r for r in readings if r.is_overtemp]
        
        max_temp = max(temperatures)
        min_temp = min(temperatures)
        avg_temp = sum(temperatures) / len(temperatures)
        
        sorted_readings = sorted(readings, key=lambda r: r.reading_time)
        
        max_consecutive = 0
        current_consecutive = 0
        for reading in sorted_readings:
            if reading.is_overtemp:
                current_consecutive += 1
                max_consecutive = max(max_consecutive, current_consecutive)
            else:
                current_consecutive = 0
        
        has_consecutive = max_consecutive >= self.config.consecutive_overtemp_count
        
        risk_level = "正常"
        risk_details = "温度数据在正常范围内"
        
        if overtemp_readings:
            if has_consecutive:
                risk_level = "高风险"
                risk_details = f"存在连续{max_consecutive}次超温记录，需要复核"
            else:
                risk_level = "中等风险"
                risk_details = f"存在{len(overtemp_readings)}次孤立超温记录"
        
        return TemperatureRiskAssessment(
            total_readings=len(readings),
            overtemp_count=len(overtemp_readings),
            max_temperature=max_temp,
            min_temperature=min_temp,
            avg_temperature=avg_temp,
            has_consecutive_overtemp=has_consecutive,
            consecutive_count=max_consecutive,
            risk_level=risk_level,
            risk_details=risk_details
        )
    
    def generate_handling_opinion(self, assessment: TemperatureRiskAssessment) -> str:
        if assessment.risk_level == "正常":
            return "温度数据正常，可正常归档。"
        elif assessment.risk_level == "中等风险":
            return f"存在{assessment.overtemp_count}次孤立超温记录，建议查看具体超温时间段，确认是否为开箱操作等正常情况。"
        elif assessment.risk_level == "高风险":
            return f"存在连续{assessment.consecutive_count}次超温，属于严重风险事件。需要：1) 立即通知相关人员；2) 评估药品质量影响；3) 记录详细处理措施；4) 完成复核后才能归档。"
        else:
            return "无温度数据，需要确认温度记录仪是否正常工作。"
    
    def create_audit_package(self, task_id: int, operator: str = "") -> Optional[AuditPackage]:
        task = self.db.get_by_id(DeliveryTask, task_id)
        if not task:
            return None
        
        assessment = self.assess_temperature_risk(task_id)
        handling_opinion = self.generate_handling_opinion(assessment)
        attachments_hash = self.attachment_manager.calculate_attachments_hash(task_id)
        
        package_number = f"AUD{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        audit_package = AuditPackage(
            task_id=task_id,
            package_number=package_number,
            temperature_risk=assessment.risk_details,
            handling_opinion=handling_opinion,
            attachments_hash=attachments_hash,
            generated_at=datetime.now()
        )
        
        audit_package = self.db.create(audit_package)
        
        self.db.log_audit(
            task_id=task_id,
            action="审计包生成",
            operator=operator,
            details=f"生成审计包: {package_number}, 风险等级: {assessment.risk_level}"
        )
        
        return audit_package
    
    def generate_markdown_report(self, task_id: int, output_path: Optional[Path] = None) -> Tuple[bool, Optional[Path], str]:
        task = self.db.get_by_id(DeliveryTask, task_id)
        if not task:
            return False, None, "任务不存在"
        
        assessment = self.assess_temperature_risk(task_id)
        
        cooler_box = None
        if task.cooler_box_id:
            cooler_box = self.db.get_by_id(CoolerBox, task.cooler_box_id)
        
        delivery_point = None
        if task.delivery_point_id:
            delivery_point = self.db.get_by_id(DeliveryPoint, task.delivery_point_id)
        
        route = None
        if task.route_id:
            route = self.db.get_by_id(DeliveryRoute, task.route_id)
        
        packing_items = self.db.get_all(
            PackingItem,
            "task_id = ?",
            (task_id,)
        )
        
        attachments = self.db.get_all(
            Attachment,
            "task_id = ?",
            (task_id,)
        )
        
        audit_logs = self.db.get_all(
            AuditLog,
            "task_id = ?",
            (task_id,)
        )
        
        exceptions = self.db.get_all(
            ExceptionRecord,
            "task_id = ?",
            (task_id,)
        )
        
        audit_package = self.db.get_by_field(AuditPackage, "task_id", task_id)
        
        report_lines = []
        
        report_lines.append(f"# 冷藏药品交接复盘报告")
        report_lines.append("")
        report_lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"> 任务编号: {task.task_number}")
        report_lines.append("")
        
        report_lines.append("## 一、任务基本信息")
        report_lines.append("")
        report_lines.append(f"| 项目 | 内容 |")
        report_lines.append(f"|------|------|")
        report_lines.append(f"| 任务编号 | {task.task_number} |")
        report_lines.append(f"| 当前状态 | {task.status.value} |")
        report_lines.append(f"| 药师 | {task.pharmacist or '-'} |")
        report_lines.append(f"| 配送员 | {task.courier or '-'} |")
        report_lines.append(f"| 装箱时间 | {task.packing_time.strftime('%Y-%m-%d %H:%M:%S') if task.packing_time else '-'} |")
        report_lines.append(f"| 发车时间 | {task.departure_time.strftime('%Y-%m-%d %H:%M:%S') if task.departure_time else '-'} |")
        report_lines.append(f"| 到达时间 | {task.arrival_time.strftime('%Y-%m-%d %H:%M:%S') if task.arrival_time else '-'} |")
        report_lines.append(f"| 签收时间 | {task.sign_time.strftime('%Y-%m-%d %H:%M:%S') if task.sign_time else '-'} |")
        report_lines.append(f"| 归档时间 | {task.archive_time.strftime('%Y-%m-%d %H:%M:%S') if task.archive_time else '-'} |")
        report_lines.append("")
        
        report_lines.append("## 二、设备与配送信息")
        report_lines.append("")
        if cooler_box:
            report_lines.append(f"### 冷藏箱信息")
            report_lines.append(f"- 箱号: {cooler_box.box_number}")
            report_lines.append(f"- 设备号: {cooler_box.device_id or '-'}")
            report_lines.append(f"- 描述: {cooler_box.description or '-'}")
            report_lines.append("")
        
        if route:
            report_lines.append(f"### 配送路线")
            report_lines.append(f"- 路线名称: {route.route_name}")
            report_lines.append(f"- 描述: {route.description or '-'}")
            report_lines.append("")
        
        if delivery_point:
            report_lines.append(f"### 收货点信息")
            report_lines.append(f"- 名称: {delivery_point.point_name}")
            report_lines.append(f"- 地址: {delivery_point.address or '-'}")
            report_lines.append(f"- 联系人: {delivery_point.contact_person or '-'}")
            report_lines.append(f"- 联系电话: {delivery_point.contact_phone or '-'}")
            report_lines.append("")
        
        report_lines.append("## 三、温度数据分析")
        report_lines.append("")
        report_lines.append(f"### 3.1 温度统计")
        report_lines.append("")
        report_lines.append(f"| 指标 | 数值 |")
        report_lines.append(f"|------|------|")
        report_lines.append(f"| 总读数数量 | {assessment.total_readings} |")
        report_lines.append(f"| 超温次数 | {assessment.overtemp_count} |")
        report_lines.append(f"| 最高温度 | {assessment.max_temperature:.2f}°C |")
        report_lines.append(f"| 最低温度 | {assessment.min_temperature:.2f}°C |")
        report_lines.append(f"| 平均温度 | {assessment.avg_temperature:.2f}°C |")
        report_lines.append(f"| 正常范围 | {self.config.temperature_min}-{self.config.temperature_max}°C |")
        report_lines.append("")
        
        report_lines.append(f"### 3.2 风险评估")
        report_lines.append("")
        report_lines.append(f"**风险等级: {assessment.risk_level}**")
        report_lines.append("")
        report_lines.append(f"{assessment.risk_details}")
        report_lines.append("")
        
        if assessment.has_consecutive_overtemp:
            report_lines.append(f"> ⚠️ 警告: 存在连续{assessment.consecutive_count}次超温记录!")
            report_lines.append("")
        
        report_lines.append("## 四、装箱清单")
        report_lines.append("")
        
        if packing_items:
            report_lines.append(f"| 序号 | 药品名称 | 批号 | 规格 | 数量 | 单位 | 备注 |")
            report_lines.append(f"|------|----------|------|------|------|------|------|")
            
            for idx, item in enumerate(packing_items, 1):
                drug_batch = self.db.get_by_id(DrugBatch, item.drug_batch_id)
                if drug_batch:
                    report_lines.append(
                        f"| {idx} | {drug_batch.drug_name} | {drug_batch.batch_number} | "
                        f"{drug_batch.specification or '-'} | {item.quantity} | {item.unit} | {item.notes or '-'} |"
                    )
        else:
            report_lines.append("> 暂无装箱清单")
        report_lines.append("")
        
        report_lines.append("## 五、附件清单")
        report_lines.append("")
        
        if attachments:
            report_lines.append(f"| 序号 | 文件名 | 类型 | 文件大小 | 哈希值 |")
            report_lines.append(f"|------|--------|------|----------|--------|")
            
            for idx, att in enumerate(attachments, 1):
                att_type = att.attachment_type
                if hasattr(att_type, 'value'):
                    att_type = att_type.value
                size_str = f"{att.file_size / 1024:.1f} KB" if att.file_size > 1024 else f"{att.file_size} B"
                short_hash = att.sha256_hash[:16] + "..."
                report_lines.append(
                    f"| {idx} | {att.original_filename} | {att_type} | {size_str} | {short_hash} |"
                )
        else:
            report_lines.append("> 暂无附件")
        report_lines.append("")
        
        report_lines.append("## 六、异常记录")
        report_lines.append("")
        
        if exceptions:
            report_lines.append(f"| 序号 | 类型 | 详情 | 状态 | 解决时间 |")
            report_lines.append(f"|------|------|------|------|----------|")
            
            for idx, exc in enumerate(exceptions, 1):
                exc_type = exc.exception_type
                if hasattr(exc_type, 'value'):
                    exc_type = exc_type.value
                status = "已解决" if exc.is_resolved else "待解决"
                resolved_time = exc.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if exc.resolved_at else '-'
                report_lines.append(
                    f"| {idx} | {exc_type} | {exc.details or '-'} | {status} | {resolved_time} |"
                )
        else:
            report_lines.append("> 无异常记录")
        report_lines.append("")
        
        report_lines.append("## 七、审计日志")
        report_lines.append("")
        
        if audit_logs:
            report_lines.append(f"| 序号 | 操作 | 操作员 | 详情 | 时间 |")
            report_lines.append(f"|------|------|--------|------|------|")
            
            for idx, log in enumerate(audit_logs, 1):
                log_time = log.created_at.strftime('%Y-%m-%d %H:%M:%S') if log.created_at else '-'
                report_lines.append(
                    f"| {idx} | {log.action} | {log.operator or '-'} | {log.details or '-'} | {log_time} |"
                )
        else:
            report_lines.append("> 无审计日志")
        report_lines.append("")
        
        if audit_package:
            report_lines.append("## 八、审计评估")
            report_lines.append("")
            report_lines.append(f"### 8.1 温度风险评估")
            report_lines.append("")
            report_lines.append(audit_package.temperature_risk or "无")
            report_lines.append("")
            report_lines.append(f"### 8.2 处理意见")
            report_lines.append("")
            report_lines.append(audit_package.handling_opinion or "无")
            report_lines.append("")
            report_lines.append(f"### 8.3 完整性校验")
            report_lines.append("")
            report_lines.append(f"- 附件哈希: {audit_package.attachments_hash or '-'}")
            report_lines.append(f"- 审计包编号: {audit_package.package_number}")
            report_lines.append(f"- 生成时间: {audit_package.generated_at.strftime('%Y-%m-%d %H:%M:%S') if audit_package.generated_at else '-'}")
            report_lines.append("")
        
        report_lines.append("---")
        report_lines.append("")
        report_lines.append(f"*报告由冷藏药品交接温控追溯台自动生成*")
        
        markdown_content = "\n".join(report_lines)
        
        if output_path is None:
            output_path = CONFIG.exports_dir / f"report_{task.task_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}.md"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        return True, output_path, markdown_content
