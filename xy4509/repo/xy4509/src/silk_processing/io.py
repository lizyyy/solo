import json
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from .models import (
    CocoonBatch,
    MoistureInspection,
    TemperaturePoint,
    CookingCurve,
    BreakageRecord,
    DeliveryRecord,
    ProcessCalculation,
    BatchProcessData,
    CocoonGrade,
    DeliveryGrade,
    BreakageSeverity,
)


class DataImporter:
    """数据导入器"""
    
    @staticmethod
    def parse_date(date_str: str) -> datetime:
        """解析日期字符串"""
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except (ValueError, AttributeError):
                continue
        return datetime.now()
    
    @classmethod
    def import_cocoon_batches_from_csv(cls, file_path: str) -> List[CocoonBatch]:
        """从CSV导入蚕茧批次"""
        batches = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                batch = CocoonBatch(
                    batch_id=row.get('batch_id', row.get('批次编号', '')),
                    source=row.get('source', row.get('来源产地', '')),
                    purchase_date=cls.parse_date(row.get('purchase_date', row.get('收购日期', ''))),
                    total_weight_kg=float(row.get('total_weight_kg', row.get('总重量(kg)', 0))),
                    grade=CocoonGrade(row.get('grade', row.get('蚕茧等级', 'C'))),
                    supplier=row.get('supplier', row.get('供应商', None)),
                    notes=row.get('notes', row.get('备注', None)),
                )
                batches.append(batch)
        return batches
    
    @classmethod
    def import_moisture_inspections_from_csv(cls, file_path: str) -> List[MoistureInspection]:
        """从CSV导入含水率抽检"""
        inspections = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                inspection = MoistureInspection(
                    inspection_id=row.get('inspection_id', row.get('抽检编号', '')),
                    batch_id=row.get('batch_id', row.get('批次编号', '')),
                    inspection_date=cls.parse_date(row.get('inspection_date', row.get('抽检日期', ''))),
                    sample_weight_g=float(row.get('sample_weight_g', row.get('样品重量(g)', 0))),
                    dry_weight_g=float(row.get('dry_weight_g', row.get('烘干后重量(g)', 0))),
                    moisture_content=float(row.get('moisture_content', row.get('含水率(%)', 0))) if row.get('moisture_content', row.get('含水率(%)')) else None,
                    inspector=row.get('inspector', row.get('抽检人', None)),
                    notes=row.get('notes', row.get('备注', None)),
                )
                inspections.append(inspection)
        return inspections
    
    @classmethod
    def import_cooking_curves_from_csv(cls, file_path: str) -> List[CookingCurve]:
        """从CSV导入煮茧温度曲线"""
        curves = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                points_str = row.get('temperature_points', row.get('温度点', '[]'))
                try:
                    points_data = json.loads(points_str)
                except json.JSONDecodeError:
                    points_data = []
                
                temperature_points = [
                    TemperaturePoint(time_min=float(p.get('time_min', p.get('时间(分钟)', 0))),
                                   temperature=float(p.get('temperature', p.get('温度(℃)', 0))))
                    for p in points_data
                ]
                
                curve = CookingCurve(
                    curve_id=row.get('curve_id', row.get('曲线编号', '')),
                    batch_id=row.get('batch_id', row.get('批次编号', '')),
                    cooking_date=cls.parse_date(row.get('cooking_date', row.get('煮茧日期', ''))),
                    curve_name=row.get('curve_name', row.get('曲线名称', '默认曲线')),
                    temperature_points=temperature_points,
                    operator=row.get('operator', row.get('操作人', None)),
                    notes=row.get('notes', row.get('备注', None)),
                )
                curves.append(curve)
        return curves
    
    @classmethod
    def import_breakage_records_from_csv(cls, file_path: str) -> List[BreakageRecord]:
        """从CSV导入断头记录"""
        records = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                severity_str = row.get('severity', row.get('严重程度', 'MEDIUM'))
                try:
                    severity = BreakageSeverity(severity_str.upper())
                except ValueError:
                    severity = BreakageSeverity.MEDIUM
                
                record = BreakageRecord(
                    record_id=row.get('record_id', row.get('记录编号', '')),
                    batch_id=row.get('batch_id', row.get('批次编号', '')),
                    record_date=cls.parse_date(row.get('record_date', row.get('记录日期', ''))),
                    machine_id=row.get('machine_id', row.get('机器编号', '')),
                    spindle_count=int(float(row.get('spindle_count', row.get('锭数', 0)))),
                    breakage_count=int(float(row.get('breakage_count', row.get('断头次数', 0)))),
                    operating_hours=float(row.get('operating_hours', row.get('运行时间(小时)', 0))),
                    breakage_per_hour=float(row.get('breakage_per_hour', row.get('每小时断头数', 0))) if row.get('breakage_per_hour', row.get('每小时断头数')) else None,
                    severity=severity,
                    operator=row.get('operator', row.get('记录人', None)),
                    notes=row.get('notes', row.get('备注', None)),
                )
                records.append(record)
        return records
    
    @classmethod
    def import_delivery_records_from_csv(cls, file_path: str) -> List[DeliveryRecord]:
        """从CSV导入交货记录"""
        records = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                grade_str = row.get('grade', row.get('交货等级', '三级'))
                try:
                    grade = DeliveryGrade(grade_str)
                except ValueError:
                    grade = DeliveryGrade.GRADE_3
                
                record = DeliveryRecord(
                    delivery_id=row.get('delivery_id', row.get('交货编号', '')),
                    batch_id=row.get('batch_id', row.get('批次编号', '')),
                    delivery_date=cls.parse_date(row.get('delivery_date', row.get('交货日期', ''))),
                    silk_weight_kg=float(row.get('silk_weight_kg', row.get('丝重量(kg)', 0))),
                    grade=grade,
                    filature_rate=float(row.get('filature_rate', row.get('出丝率(%)', 0))) if row.get('filature_rate', row.get('出丝率(%)')) else None,
                    customer=row.get('customer', row.get('客户', None)),
                    inspector=row.get('inspector', row.get('检验人', None)),
                    notes=row.get('notes', row.get('备注', None)),
                )
                records.append(record)
        return records
    
    @classmethod
    def import_from_json(cls, file_path: str) -> Dict[str, Any]:
        """从JSON导入数据"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        result = {}
        
        if 'batches' in data:
            batches = []
            for item in data['batches']:
                item['purchase_date'] = cls.parse_date(item.get('purchase_date', ''))
                batches.append(CocoonBatch(**item))
            result['batches'] = batches
        
        if 'moisture_inspections' in data:
            inspections = []
            for item in data['moisture_inspections']:
                item['inspection_date'] = cls.parse_date(item.get('inspection_date', ''))
                inspections.append(MoistureInspection(**item))
            result['moisture_inspections'] = inspections
        
        if 'cooking_curves' in data:
            curves = []
            for item in data['cooking_curves']:
                item['cooking_date'] = cls.parse_date(item.get('cooking_date', ''))
                if 'temperature_points' in item:
                    item['temperature_points'] = [
                        TemperaturePoint(**p) for p in item['temperature_points']
                    ]
                curves.append(CookingCurve(**item))
            result['cooking_curves'] = curves
        
        if 'breakage_records' in data:
            records = []
            for item in data['breakage_records']:
                item['record_date'] = cls.parse_date(item.get('record_date', ''))
                records.append(BreakageRecord(**item))
            result['breakage_records'] = records
        
        if 'delivery_records' in data:
            records = []
            for item in data['delivery_records']:
                item['delivery_date'] = cls.parse_date(item.get('delivery_date', ''))
                records.append(DeliveryRecord(**item))
            result['delivery_records'] = records
        
        return result


class DataExporter:
    """数据导出器"""
    
    @staticmethod
    def model_to_dict(obj) -> Dict[str, Any]:
        """将模型转换为字典"""
        if hasattr(obj, 'dict'):
            data = obj.dict()
            for key, value in data.items():
                if isinstance(value, datetime):
                    data[key] = value.strftime("%Y-%m-%d %H:%M:%S")
                elif isinstance(value, list) and value and hasattr(value[0], 'dict'):
                    data[key] = [DataExporter.model_to_dict(item) for item in value]
            return data
        return dict(obj)
    
    @classmethod
    def export_cocoon_batches_to_csv(cls, batches: List[CocoonBatch], file_path: str):
        """导出蚕茧批次到CSV"""
        if not batches:
            return
        
        fieldnames = [
            'batch_id', 'source', 'purchase_date', 'total_weight_kg',
            'grade', 'supplier', 'notes', 'created_at', 'updated_at'
        ]
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for batch in batches:
                writer.writerow(cls.model_to_dict(batch))
    
    @classmethod
    def export_moisture_inspections_to_csv(cls, inspections: List[MoistureInspection], file_path: str):
        """导出含水率抽检到CSV"""
        if not inspections:
            return
        
        fieldnames = [
            'inspection_id', 'batch_id', 'inspection_date', 'sample_weight_g',
            'dry_weight_g', 'moisture_content', 'inspector', 'notes'
        ]
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for inspection in inspections:
                writer.writerow(cls.model_to_dict(inspection))
    
    @classmethod
    def export_to_json(cls, data: Dict[str, Any], file_path: str):
        """导出数据到JSON"""
        export_data = {}
        
        if 'batches' in data:
            export_data['batches'] = [cls.model_to_dict(b) for b in data['batches']]
        
        if 'moisture_inspections' in data:
            export_data['moisture_inspections'] = [
                cls.model_to_dict(m) for m in data['moisture_inspections']
            ]
        
        if 'cooking_curves' in data:
            export_data['cooking_curves'] = [
                cls.model_to_dict(c) for c in data['cooking_curves']
            ]
        
        if 'breakage_records' in data:
            export_data['breakage_records'] = [
                cls.model_to_dict(b) for b in data['breakage_records']
            ]
        
        if 'delivery_records' in data:
            export_data['delivery_records'] = [
                cls.model_to_dict(d) for d in data['delivery_records']
            ]
        
        if 'calculations' in data:
            export_data['calculations'] = [
                cls.model_to_dict(c) for c in data['calculations']
            ]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)


class MarkdownExporter:
    """Markdown工艺单导出器"""
    
    @staticmethod
    def generate_process_sheet(
        batch_data: BatchProcessData,
        calculation: ProcessCalculation,
        output_path: str = None,
    ) -> str:
        """
        生成工艺单Markdown
        
        Args:
            batch_data: 批次数据
            calculation: 计算结果
            output_path: 输出文件路径
        
        Returns:
            生成的Markdown内容
        """
        batch = batch_data.batch
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        lines = [
            f"# 缫丝工艺单",
            "",
            f"**生成时间**: {now}",
            f"**计算编号**: {calculation.calculation_id}",
            "",
            "---",
            "",
            "## 一、蚕茧批次信息",
            "",
            "| 项目 | 内容 |",
            "|------|------|",
            f"| 批次编号 | {batch.batch_id} |",
            f"| 来源产地 | {batch.source} |",
            f"| 收购日期 | {batch.purchase_date.strftime('%Y-%m-%d')} |",
            f"| 总重量 | {batch.total_weight_kg:.2f} kg |",
            f"| 蚕茧等级 | {batch.grade.value} |",
            f"| 供应商 | {batch.supplier or '-'} |",
            "",
        ]
        
        if batch_data.moisture_inspections:
            lines.extend([
                "## 二、含水率抽检信息",
                "",
                "| 抽检编号 | 抽检日期 | 样品重量(g) | 烘干重量(g) | 含水率(%) | 抽检人 |",
                "|----------|----------|-------------|-------------|-----------|--------|",
            ])
            
            for insp in batch_data.moisture_inspections:
                moisture = f"{insp.moisture_content:.2f}" if insp.moisture_content else "-"
                lines.append(
                    f"| {insp.inspection_id} | {insp.inspection_date.strftime('%Y-%m-%d')} | "
                    f"{insp.sample_weight_g:.1f} | {insp.dry_weight_g:.1f} | {moisture} | "
                    f"{insp.inspector or '-'} |"
                )
            lines.append("")
        
        lines.extend([
            "## 三、补水计算",
            "",
            "| 项目 | 数值 |",
            "|------|------|",
            f"| 当前含水率 | {calculation.current_moisture:.2f}% |",
            f"| 目标含水率 | {calculation.target_moisture:.2f}% |",
            f"| **需补水量** | **{calculation.water_supplement_kg:.2f} kg** |",
            "",
            "## 四、煮茧参数建议",
            "",
            "| 项目 | 建议值 |",
            "|------|--------|",
            f"| **煮茧温度** | **{calculation.recommended_cooking_temp:.1f} ℃** |",
            f"| **煮茧时间** | **{calculation.recommended_cooking_time_min:.1f} 分钟** |",
            f"| 浸泡时间 | {calculation.soaking_time_min:.1f} 分钟 |" if calculation.soaking_time_min else "",
            f"| 蒸汽压力 | {calculation.steam_pressure:.3f} MPa |" if calculation.steam_pressure else "",
            "",
        ])
        
        if batch_data.cooking_curves:
            lines.extend([
                "### 历史温度曲线参考",
                "",
            ])
            for curve in batch_data.cooking_curves:
                lines.extend([
                    f"#### {curve.curve_name}",
                    "",
                    f"- 煮茧日期: {curve.cooking_date.strftime('%Y-%m-%d')}",
                    f"- 总时间: {curve.total_cooking_time_min:.1f} 分钟",
                    f"- 最高温度: {curve.max_temperature:.1f} ℃",
                    "",
                ])
        
        lines.extend([
            "## 五、出丝率预估",
            "",
            "| 项目 | 预估值 |",
            "|------|--------|",
            f"| **预估出丝率** | **{calculation.estimated_filature_rate:.2f}%** |",
            f"| **预估产丝量** | **{calculation.estimated_silk_output_kg:.2f} kg** |",
            "",
        ])
        
        lines.extend([
            "## 六、断头风险评估",
            "",
            "| 项目 | 评估结果 |",
            "|------|----------|",
            f"| **风险等级** | **{calculation.breakage_risk_level}** |",
            f"| 预估每小时断头数 | {calculation.estimated_breakage_per_hour:.2f} 次/小时 |",
            "",
        ])
        
        if calculation.risk_factors:
            lines.extend([
                "### 风险因素",
                "",
            ])
            for factor in calculation.risk_factors:
                lines.append(f"- ⚠️ {factor}")
            lines.append("")
        
        if calculation.anomalies:
            lines.extend([
                "## 七、异常数据提示",
                "",
            ])
            for anomaly in calculation.anomalies:
                severity = "🔴" if anomaly.get('severity') == 'high' else "🟡"
                lines.append(f"{severity} **[{anomaly.get('type')}]** {anomaly.get('message')}")
            lines.append("")
        
        if calculation.warnings:
            lines.extend([
                "## 八、警告信息",
                "",
            ])
            for warning in calculation.warnings:
                lines.append(f"- ⚠️ {warning}")
            lines.append("")
        
        lines.extend([
            "## 九、人工复核",
            "",
            "| 项目 | 内容 |",
            "|------|------|",
            f"| 复核人 | {calculation.reviewed_by or '待复核'} |",
            f"| 复核时间 | {calculation.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if calculation.reviewed_at else '待复核'} |",
            f"| 复核备注 | {calculation.reviewer_notes or '无'} |",
            "",
            "---",
            "",
            f"*本工艺单由缫丝工艺计算工具自动生成，仅供参考。请根据实际情况调整参数。*",
        ])
        
        content = "\n".join(line for line in lines if line is not None)
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        return content
