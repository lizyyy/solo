from datetime import datetime
from pathlib import Path
from typing import Optional

from models.order import Order
from models.patient import Patient
from models.measurement import Measurement
from models.attachment import Attachment
from models.fitting_record import FittingRecord
from models.rework_record import ReworkRecord
from core.patient_repository import PatientRepository
from core.measurement_repository import MeasurementRepository
from core.attachment_repository import AttachmentRepository
from core.fitting_repository import FittingRecordRepository
from core.rework_repository import ReworkRecordRepository


class MarkdownReporter:
    def __init__(self):
        self.patient_repo = PatientRepository()
        self.measurement_repo = MeasurementRepository()
        self.attachment_repo = AttachmentRepository()
        self.fitting_repo = FittingRecordRepository()
        self.rework_repo = ReworkRecordRepository()
    
    def generate_delivery_note(
        self,
        order: Order,
        patient: Optional[Patient] = None,
        output_path: Optional[Path] = None
    ) -> str:
        if patient is None:
            patient = self.patient_repo.get_by_id(order.patient_id)
        
        measurements = self.measurement_repo.get_by_order(order.id)
        attachments = self.attachment_repo.get_by_order(order.id)
        fittings = self.fitting_repo.get_by_order(order.id)
        reworks = self.rework_repo.get_by_order(order.id)
        
        markdown = self._build_delivery_note(
            order, patient, measurements, attachments, fittings, reworks
        )
        
        if output_path:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(markdown)
        
        return markdown
    
    def _build_delivery_note(
        self,
        order: Order,
        patient: Optional[Patient],
        measurements: list,
        attachments: list,
        fittings: list,
        reworks: list
    ) -> str:
        lines = []
        
        lines.append("# 假肢矫形交付单")
        lines.append("")
        lines.append(f"**生成日期**: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、基本信息")
        lines.append("")
        lines.append("| 项目 | 内容 |")
        lines.append("|------|------|")
        lines.append(f"| 订单号 | {order.order_number} |")
        lines.append(f"| 患者姓名 | {patient.name if patient else '未知'} |")
        lines.append(f"| 联系电话 | {patient.phone if patient and patient.phone else '-'} |")
        lines.append(f"| 诊断部位 | {order.body_part} |")
        lines.append(f"| 左右侧 | {order.side} |")
        lines.append(f"| 当前状态 | {order.status} |")
        lines.append(f"| 取模日期 | {order.impression_date or '-'} |")
        lines.append(f"| 负责技师 | {order.technician or '-'} |")
        lines.append("")
        
        if measurements:
            lines.append("## 二、尺寸记录")
            lines.append("")
            for m in measurements:
                lines.append(f"### 版本 {m.version}")
                lines.append("")
                dims = m.get_dimensions_dict()
                if dims:
                    lines.append("| 尺寸项 | 数值 |")
                    lines.append("|--------|------|")
                    for key, value in dims.items():
                        lines.append(f"| {key} | {value} |")
                else:
                    lines.append("*无详细尺寸数据*")
                lines.append("")
                if m.technician or m.notes:
                    lines.append(f"- 技师: {m.technician or '-'}")
                    lines.append(f"- 备注: {m.notes or '-'}")
                    lines.append("")
        
        if attachments:
            lines.append("## 三、附件清单")
            lines.append("")
            lines.append("| 文件名 | 类型 | 大小 | 哈希值 |")
            lines.append("|--------|------|------|--------|")
            for a in attachments:
                size_str = self._format_size(a.file_size)
                lines.append(f"| {a.original_name} | {a.file_type} | {size_str} | {a.sha256_hash[:16]}... |")
            lines.append("")
        
        if fittings:
            lines.append("## 四、试穿记录")
            lines.append("")
            for i, f in enumerate(fittings, 1):
                lines.append(f"### 第 {i} 次试穿")
                lines.append("")
                lines.append(f"- **试穿日期**: {f.fitting_date or '-'}")
                lines.append(f"- **技师**: {f.technician or '-'}")
                if f.feedback:
                    lines.append(f"- **反馈**: {f.feedback}")
                if f.adjustments:
                    lines.append(f"- **调整**: {f.adjustments}")
                if f.next_follow_up:
                    lines.append(f"- **下次复诊**: {f.next_follow_up}")
                lines.append("")
        
        if reworks:
            lines.append("## 五、返修记录")
            lines.append("")
            for i, r in enumerate(reworks, 1):
                lines.append(f"### 第 {i} 次返修")
                lines.append("")
                lines.append(f"- **返修日期**: {r.rework_date or '-'}")
                lines.append(f"- **原因**: {r.rework_reason}")
                if r.rework_details:
                    lines.append(f"- **详情**: {r.rework_details}")
                lines.append(f"- **技师**: {r.technician or '-'}")
                status = "已完成" if r.completed_at else "进行中"
                lines.append(f"- **状态**: {status}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 六、交付确认")
        lines.append("")
        lines.append("□ 患者已收到产品")
        lines.append("")
        lines.append("□ 试穿情况良好")
        lines.append("")
        lines.append("□ 无需要返修的问题")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append(f"*此交付单由「矫形取模适配台」系统生成于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)
    
    def _format_size(self, size: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
