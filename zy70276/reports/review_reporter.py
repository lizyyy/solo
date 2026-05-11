from typing import List, Dict, Any, Optional
from datetime import datetime, date, time
from models.data_models import (
    SalesRecord,
    TrainInfo,
    MealItem,
    PredictionResult,
    QualityReport,
    ReviewReport,
    RecordHistory,
    RecordStatus,
    SampleQuality
)
import uuid
from collections import defaultdict

class ReviewReporter:
    def generate_report(
        self,
        records: List[SalesRecord],
        predictions: List[PredictionResult],
        quality_report: QualityReport,
        trains: Dict[str, TrainInfo],
        meals: Dict[str, MealItem],
        date_range: Optional[tuple] = None
    ) -> ReviewReport:
        
        if not date_range and records:
            dates = [r.date for r in records]
            date_range = (min(dates), max(dates))
        
        train_summary = self._analyze_train_performance(records, trains)
        meal_summary = self._analyze_meal_performance(records, meals)
        quality_summary = self._analyze_quality(records, quality_report)
        predictions_summary = self._analyze_predictions(predictions)
        action_items = self._generate_action_items(records, quality_report, predictions)
        key_insights = self._generate_key_insights(records, quality_report, predictions)
        
        return ReviewReport(
            report_id=str(uuid.uuid4())[:8],
            generated_at=datetime.now(),
            date_range=date_range or (date.today(), date.today()),
            train_summary=train_summary,
            meal_summary=meal_summary,
            quality_summary=quality_summary,
            predictions_summary=predictions_summary,
            action_items=action_items,
            key_insights=key_insights
        )
    
    def _analyze_train_performance(
        self,
        records: List[SalesRecord],
        trains: Dict[str, TrainInfo]
    ) -> Dict[str, Any]:
        
        summary = {}
        
        active_records = [r for r in records if r.status != RecordStatus.WITHDRAWN]
        
        for train_id, train in trains.items():
            train_records = [r for r in active_records if r.train_id == train_id]
            
            if not train_records:
                continue
            
            total_passengers = sum(r.passenger_count for r in train_records)
            total_sold = sum(r.units_sold for r in train_records)
            total_stock = sum(r.initial_stock for r in train_records)
            sold_out_count = sum(1 for r in train_records if r.was_sold_out)
            
            summary[train.train_number] = {
                "train_id": train_id,
                "route": train.route,
                "record_count": len(train_records),
                "total_passengers": total_passengers,
                "total_sold": total_sold,
                "total_stock": total_stock,
                "sell_through_rate": round(total_sold / total_stock, 3) if total_stock > 0 else 0,
                "sold_out_rate": round(sold_out_count / len(train_records), 3) if train_records else 0,
                "average_passengers": round(total_passengers / len(train_records), 0) if train_records else 0
            }
        
        return summary
    
    def _analyze_meal_performance(
        self,
        records: List[SalesRecord],
        meals: Dict[str, MealItem]
    ) -> Dict[str, Any]:
        
        summary = {}
        
        active_records = [r for r in records if r.status != RecordStatus.WITHDRAWN]
        
        for meal_id, meal in meals.items():
            meal_records = [r for r in active_records if r.meal_id == meal_id]
            
            if not meal_records:
                continue
            
            total_sold = sum(r.units_sold for r in meal_records)
            total_stock = sum(r.initial_stock for r in meal_records)
            sold_out_count = sum(1 for r in meal_records if r.was_sold_out)
            total_revenue = total_sold * meal.price
            
            summary[meal.name] = {
                "meal_id": meal_id,
                "category": meal.category,
                "price": meal.price,
                "record_count": len(meal_records),
                "total_sold": total_sold,
                "total_stock": total_stock,
                "total_revenue": round(total_revenue, 2),
                "sell_through_rate": round(total_sold / total_stock, 3) if total_stock > 0 else 0,
                "sold_out_rate": round(sold_out_count / len(meal_records), 3) if meal_records else 0
            }
        
        return summary
    
    def _analyze_quality(
        self,
        records: List[SalesRecord],
        quality_report: QualityReport
    ) -> Dict[str, Any]:
        
        quality_distribution = {
            "normal": 0,
            "missing": 0,
            "suspicious": 0
        }
        
        for r in records:
            if r.status == RecordStatus.WITHDRAWN:
                continue
                
            if r.quality == SampleQuality.NORMAL:
                quality_distribution["normal"] += 1
            elif r.quality == SampleQuality.MISSING:
                quality_distribution["missing"] += 1
            elif r.quality == SampleQuality.SUSPICIOUS:
                quality_distribution["suspicious"] += 1
        
        total = sum(quality_distribution.values())
        
        return {
            "distribution": quality_distribution,
            "percentages": {
                "normal": round(quality_distribution["normal"] / total, 2) if total > 0 else 0,
                "missing": round(quality_distribution["missing"] / total, 2) if total > 0 else 0,
                "suspicious": round(quality_distribution["suspicious"] / total, 2) if total > 0 else 0
            },
            "report_recommendations": quality_report.recommendations,
            "missing_details": quality_report.missing_details,
            "suspicious_details": quality_report.suspicious_details
        }
    
    def _analyze_predictions(self, predictions: List[PredictionResult]) -> Dict[str, Any]:
        
        if not predictions:
            return {
                "count": 0,
                "average_confidence": 0,
                "risk_distribution": {},
                "total_recommended_stock": 0
            }
        
        risk_counts = defaultdict(int)
        total_stock = 0
        confidence_sum = 0
        
        for p in predictions:
            risk_counts[p.risk_assessment.split("：")[0]] += 1
            total_stock += p.recommended_stock
            confidence_sum += p.confidence_score
        
        return {
            "count": len(predictions),
            "average_confidence": round(confidence_sum / len(predictions), 2),
            "risk_distribution": dict(risk_counts),
            "total_recommended_stock": total_stock
        }
    
    def _generate_action_items(
        self,
        records: List[SalesRecord],
        quality_report: QualityReport,
        predictions: List[PredictionResult]
    ) -> List[Dict[str, Any]]:
        
        action_items = []
        
        if quality_report.suspicious_samples > 0:
            action_items.append({
                "priority": "高",
                "type": "数据复核",
                "description": f"发现 {quality_report.suspicious_samples} 条疑似误录记录，建议人工复核",
                "details": quality_report.suspicious_details[:5]
            })
        
        if quality_report.missing_samples > 0:
            action_items.append({
                "priority": "中",
                "type": "数据补录",
                "description": f"发现 {quality_report.missing_samples} 条缺失样本，建议补录关键信息",
                "details": quality_report.missing_details[:5]
            })
        
        high_risk_predictions = [p for p in predictions if "高风险" in p.risk_assessment]
        if high_risk_predictions:
            action_items.append({
                "priority": "高",
                "type": "备货预警",
                "description": f"有 {len(high_risk_predictions)} 个餐品预测为高风险，建议重点关注",
                "details": [{"meal": p.meal_name, "train": p.train_number, "risk": p.risk_assessment} 
                           for p in high_risk_predictions[:5]]
            })
        
        sold_out_records = [r for r in records if r.was_sold_out and r.status != RecordStatus.WITHDRAWN]
        if len(sold_out_records) > 3:
            action_items.append({
                "priority": "中",
                "type": "缺货分析",
                "description": f"历史售罄记录较多（{len(sold_out_records)}次），建议增加安全库存",
                "details": None
            })
        
        return action_items
    
    def _generate_key_insights(
        self,
        records: List[SalesRecord],
        quality_report: QualityReport,
        predictions: List[PredictionResult]
    ) -> List[str]:
        
        insights = []
        
        active_records = [r for r in records if r.status != RecordStatus.WITHDRAWN]
        
        if active_records:
            total_sold = sum(r.units_sold for r in active_records)
            total_stock = sum(r.initial_stock for r in active_records)
            overall_rate = total_sold / total_stock if total_stock > 0 else 0
            insights.append(f"整体售罄率为 {round(overall_rate * 100, 1)}%")
        
        sold_out_count = sum(1 for r in active_records if r.was_sold_out)
        if sold_out_count > 0:
            insights.append(f"历史共发生 {sold_out_count} 次售罄事件")
        
        if quality_report.suspicious_samples > 0:
            insights.append(f"存在 {quality_report.suspicious_samples} 条疑似误录记录需要复核")
        
        if predictions:
            high_conf = sum(1 for p in predictions if p.confidence_score >= 0.7)
            insights.append(f"预测结果中 {high_conf} 个餐品的预测置信度≥70%")
        
        return insights
    
    def format_report_for_reviewer(self, report: ReviewReport) -> str:
        
        lines = [
            "=" * 60,
            "铁路餐车备货预测复核报告",
            "=" * 60,
            f"报告编号: {report.report_id}",
            f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"数据范围: {report.date_range[0]} 至 {report.date_range[1]}",
            "",
            "-" * 40,
            "一、数据质量概览",
            "-" * 40,
        ]
        
        qs = report.quality_summary
        if qs:
            dist = qs["distribution"]
            lines.extend([
                f"  总记录数: {sum(dist.values())}",
                f"  正常样本: {dist['normal']} ({qs['percentages']['normal'] * 100:.0f}%)",
                f"  缺失样本: {dist['missing']} ({qs['percentages']['missing'] * 100:.0f}%)",
                f"  疑似误录: {dist['suspicious']} ({qs['percentages']['suspicious'] * 100:.0f}%)",
            ])
            
            if qs["missing_details"]:
                lines.append("\n  缺失样本详情:")
                for item in qs["missing_details"][:3]:
                    lines.append(f"    - {item['train_number']} {item['meal_name']} ({item['date']}): {', '.join(item['issues'])}")
            
            if qs["suspicious_details"]:
                lines.append("\n  疑似误录样本详情:")
                for item in qs["suspicious_details"][:3]:
                    lines.append(f"    - {item['train_number']} {item['meal_name']} ({item['date']}): {', '.join(item['issues'])}")
        
        lines.extend([
            "",
            "-" * 40,
            "二、车次表现分析",
            "-" * 40,
        ])
        
        for train_num, data in report.train_summary.items():
            lines.extend([
                f"\n  {train_num} ({data['route']}):",
                f"    记录数: {data['record_count']}",
                f"    总客流: {data['total_passengers']}",
                f"    售罄率: {data['sell_through_rate'] * 100:.1f}%",
                f"    缺货率: {data['sold_out_rate'] * 100:.1f}%",
            ])
        
        lines.extend([
            "",
            "-" * 40,
            "三、餐品表现分析",
            "-" * 40,
        ])
        
        for meal_name, data in report.meal_summary.items():
            lines.extend([
                f"\n  {meal_name}:",
                f"    分类: {data['category']}",
                f"    单价: ¥{data['price']}",
                f"    总销量: {data['total_sold']}",
                f"    售罄率: {data['sell_through_rate'] * 100:.1f}%",
                f"    缺货率: {data['sold_out_rate'] * 100:.1f}%",
                f"    总营收: ¥{data['total_revenue']}",
            ])
        
        lines.extend([
            "",
            "-" * 40,
            "四、预测结果概览",
            "-" * 40,
        ])
        
        ps = report.predictions_summary
        if ps and ps["count"] > 0:
            lines.extend([
                f"  预测餐品数: {ps['count']}",
                f"  平均置信度: {ps['average_confidence'] * 100:.0f}%",
                f"  建议备货总量: {ps['total_recommended_stock']}",
            ])
            if ps["risk_distribution"]:
                lines.append("  风险分布:")
                for risk, count in ps["risk_distribution"].items():
                    lines.append(f"    {risk}: {count}个餐品")
        
        lines.extend([
            "",
            "-" * 40,
            "五、关键洞察",
            "-" * 40,
        ])
        
        for i, insight in enumerate(report.key_insights, 1):
            lines.append(f"  {i}. {insight}")
        
        lines.extend([
            "",
            "-" * 40,
            "六、待办事项",
            "-" * 40,
        ])
        
        for i, item in enumerate(report.action_items, 1):
            lines.extend([
                f"\n  [{item['priority']}优先级] {item['type']}",
                f"    {item['description']}",
            ])
            if item["details"]:
                lines.append("    详情:")
                for detail in item["details"]:
                    if isinstance(detail, dict):
                        lines.append(f"      - {detail}")
        
        lines.extend([
            "",
            "=" * 60,
        ])
        
        return "\n".join(lines)
