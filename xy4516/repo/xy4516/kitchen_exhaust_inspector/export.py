import json
from pathlib import Path
from datetime import datetime
from .models import (
    Store, InspectionBatch, CleaningRecord, SensorReading, PhotoRecord,
    Rectification, Risk, Review, FileRecord
)
from .db import get_db
from .review import ReviewManager

class Exporter:
    """导出器"""
    
    def __init__(self, batch_id):
        self.batch_id = batch_id
        self.batch_info = self._get_batch_info()
    
    def _get_batch_info(self):
        """获取批次信息"""
        batch = InspectionBatch.get_by_id(self.batch_id)
        if batch:
            return batch
        return {'batch_name': 'Unknown', 'inspection_month': 'Unknown'}
    
    def export_markdown(self, output_path):
        """导出 Markdown 巡检包"""
        output_path = Path(output_path)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # 生成主报告
        main_report = self._generate_main_report()
        main_file = output_path / '巡检报告.md'
        main_file.write_text(main_report, encoding='utf-8')
        
        # 生成风险详情
        risks_report = self._generate_risks_report()
        risks_file = output_path / '风险清单.md'
        risks_file.write_text(risks_report, encoding='utf-8')
        
        # 生成门店详情报告
        stores_report = self._generate_stores_report()
        stores_file = output_path / '门店详情.md'
        stores_file.write_text(stores_report, encoding='utf-8')
        
        # 生成复核报告
        reviews_report = self._generate_reviews_report()
        reviews_file = output_path / '复核记录.md'
        reviews_file.write_text(reviews_report, encoding='utf-8')
        
        print(f"Markdown 巡检包已导出到: {output_path}")
        return output_path
    
    def export_json(self, output_path):
        """导出 JSON 审计明细"""
        output_path = Path(output_path)
        
        audit_data = {
            'export_time': datetime.now().isoformat(),
            'batch_info': self.batch_info,
            'summary': self._get_summary(),
            'stores': self._get_stores_data(),
            'cleaning_records': self._get_cleaning_data(),
            'sensor_readings': self._get_sensor_data(),
            'photo_records': self._get_photo_data(),
            'rectifications': self._get_rectification_data(),
            'risks': self._get_risks_data(),
            'reviews': self._get_reviews_data(),
            'file_records': self._get_file_records_data()
        }
        
        output_path.write_text(json.dumps(audit_data, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"JSON 审计明细已导出到: {output_path}")
        return output_path
    
    def _generate_main_report(self):
        """生成主报告"""
        summary = self._get_summary()
        batch = self.batch_info
        
        report = f"""# 后厨油烟巡检报告

## 基本信息

- **巡检批次**: {batch.get('batch_name', '-')}
- **巡检月份**: {batch.get('inspection_month', '-')}
- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 概览统计

| 项目 | 数量 |
|------|------|
| 门店总数 | {summary['total_stores']} |
| 清洗记录 | {summary['cleaning_records']} |
| 传感器读数 | {summary['sensor_readings']} |
| 照片记录 | {summary['photo_records']} |
| 整改记录 | {summary['rectifications']} |

---

## 风险概览

| 风险等级 | 数量 |
|----------|------|
| 🔴 高风险 | {summary['high_risks']} |
| 🟡 中风险 | {summary['medium_risks']} |
| 🟢 低风险 | {summary['low_risks']} |
| **总计** | **{summary['total_risks']}** |

---

## 复核统计

| 状态 | 数量 |
|------|------|
| 待复核 | {summary['unreviewed_risks']} |
| 已复核 | {summary['reviewed_risks']} |
| ✓ 已确认 | {summary['confirmed_risks']} |
| ✗ 误报 | {summary['false_alarm_risks']} |
| ✓ 已解决 | {summary['resolved_risks']} |

---

## 快速链接

- [风险清单](./风险清单.md)
- [门店详情](./门店详情.md)
- [复核记录](./复核记录.md)

---

*本报告由后厨油烟巡检归档员自动生成*
"""
        return report
    
    def _generate_risks_report(self):
        """生成风险报告"""
        risks = Risk.get_all(batch_id=self.batch_id)
        review_manager = ReviewManager()
        
        # 按风险等级分组
        high_risks = [r for r in risks if r.get('risk_level') == 'high']
        medium_risks = [r for r in risks if r.get('risk_level') == 'medium']
        low_risks = [r for r in risks if r.get('risk_level') == 'low']
        
        report = f"""# 风险清单

## 风险类型说明

| 类型代码 | 说明 |
|----------|------|
| missing_cleaning | 遗漏清洗记录 |
| overdue_cleaning | 清洗超期 |
| emission_exceeding | 排放超限 |
| photo_mismatch | 照片归属错误 |
| rectification_overdue | 整改超期 |
| missing_photos | 缺少照片 |

---

"""
        
        # 高风险
        report += "## 🔴 高风险\n\n"
        if high_risks:
            for i, risk in enumerate(high_risks, 1):
                report += self._format_risk(risk, i, review_manager)
        else:
            report += "暂无高风险\n\n"
        
        # 中风险
        report += "## 🟡 中风险\n\n"
        if medium_risks:
            for i, risk in enumerate(medium_risks, 1):
                report += self._format_risk(risk, i, review_manager)
        else:
            report += "暂无中风险\n\n"
        
        # 低风险
        report += "## 🟢 低风险\n\n"
        if low_risks:
            for i, risk in enumerate(low_risks, 1):
                report += self._format_risk(risk, i, review_manager)
        else:
            report += "暂无低风险\n\n"
        
        return report
    
    def _format_risk(self, risk, index, review_manager):
        """格式化单个风险"""
        reviews = review_manager.get_reviews_by_risk(risk['id'])
        
        text = f"### {index}. 门店 {risk['store_code']}\n\n"
        text += f"- **风险类型**: {risk['risk_type']}\n"
        text += f"- **描述**: {risk['description']}\n"
        text += f"- **检测时间**: {risk.get('detected_at', '-')}\n"
        
        if reviews:
            text += f"- **复核状态**: 已复核\n"
            for review in reviews:
                result_text = {
                    'confirmed': '✓ 确认属实',
                    'false_alarm': '✗ 误报',
                    'resolved': '✓ 已解决'
                }.get(review['review_result'], review['review_result'])
                text += f"  - 复核人: {review['reviewer']}\n"
                text += f"  - 结果: {result_text}\n"
                if review.get('comments'):
                    text += f"  - 备注: {review['comments']}\n"
        else:
            text += f"- **复核状态**: 待复核\n"
        
        text += "\n"
        return text
    
    def _generate_stores_report(self):
        """生成门店详情报告"""
        stores = Store.get_all()
        cleaning_records = CleaningRecord.get_all(batch_id=self.batch_id)
        sensor_readings = SensorReading.get_all(batch_id=self.batch_id)
        photo_records = PhotoRecord.get_all(batch_id=self.batch_id)
        rectifications = Rectification.get_all(batch_id=self.batch_id)
        risks = Risk.get_all(batch_id=self.batch_id)
        
        # 按门店分组
        store_data = {}
        for store in stores:
            code = store['store_code']
            store_data[code] = {
                'info': store,
                'cleaning': [r for r in cleaning_records if r['store_code'] == code],
                'sensor': [r for r in sensor_readings if r['store_code'] == code],
                'photo': [r for r in photo_records if r['store_code'] == code],
                'rectification': [r for r in rectifications if r['store_code'] == code],
                'risks': [r for r in risks if r['store_code'] == code]
            }
        
        report = "# 门店详情\n\n"
        
        for store_code, data in sorted(store_data.items()):
            store = data['info']
            report += f"## {store_code} - {store.get('store_name', store_code)}\n\n"
            
            # 清洗记录
            report += "### 清洗记录\n"
            if data['cleaning']:
                for rec in data['cleaning']:
                    report += f"- 清洗日期: {rec.get('cleaning_date', '-')}\n"
                    if rec.get('cleaning_company'):
                        report += f"  - 清洗公司: {rec['cleaning_company']}\n"
                    if rec.get('next_cleaning_date'):
                        report += f"  - 下次清洗日期: {rec['next_cleaning_date']}\n"
            else:
                report += "- 无清洗记录\n"
            report += "\n"
            
            # 传感器读数
            report += "### 传感器读数\n"
            if data['sensor']:
                report += f"共 {len(data['sensor'])} 条读数记录\n\n"
                # 显示最新的几条
                for rec in data['sensor'][:5]:
                    parts = []
                    if rec.get('reading_date'):
                        parts.append(f"日期: {rec['reading_date']}")
                    if rec.get('pm25') is not None:
                        parts.append(f"PM2.5: {rec['pm25']}")
                    if rec.get('oil_concentration') is not None:
                        parts.append(f"油烟浓度: {rec['oil_concentration']}")
                    report += f"- {', '.join(parts)}\n"
            else:
                report += "- 无传感器读数\n"
            report += "\n"
            
            # 照片记录
            report += "### 照片记录\n"
            if data['photo']:
                photo_types = {}
                for rec in data['photo']:
                    p_type = rec.get('photo_type', '其他')
                    if p_type not in photo_types:
                        photo_types[p_type] = 0
                    photo_types[p_type] += 1
                
                report += f"共 {len(data['photo'])} 张照片\n"
                for p_type, count in photo_types.items():
                    report += f"- {p_type}: {count} 张\n"
            else:
                report += "- 无照片记录\n"
            report += "\n"
            
            # 整改记录
            report += "### 整改记录\n"
            if data['rectification']:
                for rec in data['rectification']:
                    status_text = {
                        'pending': '待处理',
                        'in_progress': '处理中',
                        'completed': '已完成',
                        'overdue': '已超期'
                    }.get(rec.get('status', 'pending'), rec.get('status'))
                    report += f"- 问题: {rec.get('issue_description', '-')}\n"
                    report += f"  - 预约日期: {rec.get('appointment_date', '-')}\n"
                    report += f"  - 状态: {status_text}\n"
            else:
                report += "- 无整改记录\n"
            report += "\n"
            
            # 风险
            if data['risks']:
                high_count = sum(1 for r in data['risks'] if r['risk_level'] == 'high')
                medium_count = sum(1 for r in data['risks'] if r['risk_level'] == 'medium')
                low_count = sum(1 for r in data['risks'] if r['risk_level'] == 'low')
                
                report += "### 风险\n"
                report += f"- 高风险: {high_count}, 中风险: {medium_count}, 低风险: {low_count}\n"
                for risk in data['risks']:
                    level_icon = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}.get(risk['risk_level'], '')
                    report += f"  - {level_icon} {risk['description']}\n"
            report += "\n"
            report += "---\n\n"
        
        return report
    
    def _generate_reviews_report(self):
        """生成复核报告"""
        review_manager = ReviewManager()
        stats = review_manager.get_review_stats(self.batch_id)
        unreviewed = review_manager.get_unreviewed_risks(self.batch_id)
        reviewed = review_manager.get_reviewed_risks(self.batch_id)
        
        report = "# 复核记录\n\n"
        
        # 统计
        report += "## 复核统计\n\n"
        report += f"| 项目 | 数量 |\n"
        report += f"|------|------|\n"
        report += f"| 总风险数 | {stats['total_risks']} |\n"
        report += f"| 待复核 | {stats['unreviewed']} |\n"
        report += f"| 已复核 | {stats['reviewed']} |\n"
        report += f"| ✓ 已确认 | {stats['by_result']['confirmed']} |\n"
        report += f"| ✗ 误报 | {stats['by_result']['false_alarm']} |\n"
        report += f"| ✓ 已解决 | {stats['by_result']['resolved']} |\n\n"
        
        # 待复核
        report += "## 待复核风险\n\n"
        if unreviewed:
            for risk in unreviewed:
                level_icon = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}.get(risk['risk_level'], '')
                report += f"- {level_icon} 门店 {risk['store_code']}: {risk['description']}\n"
                report += f"  - 风险ID: {risk['id']}\n\n"
        else:
            report += "所有风险已复核完成\n\n"
        
        # 已复核
        report += "## 已复核风险\n\n"
        if reviewed:
            for item in reviewed:
                level_icon = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}.get(item['risk_level'], '')
                result_text = {
                    'confirmed': '✓ 确认属实',
                    'false_alarm': '✗ 误报',
                    'resolved': '✓ 已解决'
                }.get(item['review_result'], item['review_result'])
                
                report += f"- {level_icon} 门店 {item['store_code']}: {item['description']}\n"
                report += f"  - 复核人: {item['reviewer']}\n"
                report += f"  - 结果: {result_text}\n"
                if item.get('comments'):
                    report += f"  - 备注: {item['comments']}\n"
                report += "\n"
        else:
            report += "暂无已复核记录\n\n"
        
        return report
    
    def _get_summary(self):
        """获取汇总数据"""
        stores = Store.get_all()
        cleaning = CleaningRecord.get_all(batch_id=self.batch_id)
        sensor = SensorReading.get_all(batch_id=self.batch_id)
        photo = PhotoRecord.get_all(batch_id=self.batch_id)
        rectification = Rectification.get_all(batch_id=self.batch_id)
        risks = Risk.get_all(batch_id=self.batch_id)
        
        review_manager = ReviewManager()
        review_stats = review_manager.get_review_stats(self.batch_id)
        
        return {
            'total_stores': len(stores),
            'cleaning_records': len(cleaning),
            'sensor_readings': len(sensor),
            'photo_records': len(photo),
            'rectifications': len(rectification),
            'total_risks': len(risks),
            'high_risks': sum(1 for r in risks if r['risk_level'] == 'high'),
            'medium_risks': sum(1 for r in risks if r['risk_level'] == 'medium'),
            'low_risks': sum(1 for r in risks if r['risk_level'] == 'low'),
            'unreviewed_risks': review_stats['unreviewed'],
            'reviewed_risks': review_stats['reviewed'],
            'confirmed_risks': review_stats['by_result']['confirmed'],
            'false_alarm_risks': review_stats['by_result']['false_alarm'],
            'resolved_risks': review_stats['by_result']['resolved'],
        }
    
    def _get_stores_data(self):
        """获取门店数据"""
        return Store.get_all()
    
    def _get_cleaning_data(self):
        """获取清洗数据"""
        return CleaningRecord.get_all(batch_id=self.batch_id)
    
    def _get_sensor_data(self):
        """获取传感器数据"""
        return SensorReading.get_all(batch_id=self.batch_id)
    
    def _get_photo_data(self):
        """获取照片数据"""
        return PhotoRecord.get_all(batch_id=self.batch_id)
    
    def _get_rectification_data(self):
        """获取整改数据"""
        return Rectification.get_all(batch_id=self.batch_id)
    
    def _get_risks_data(self):
        """获取风险数据"""
        return Risk.get_all(batch_id=self.batch_id)
    
    def _get_reviews_data(self):
        """获取复核数据"""
        review_manager = ReviewManager()
        return review_manager.get_reviewed_risks(self.batch_id)
    
    def _get_file_records_data(self):
        """获取文件记录数据"""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM file_records WHERE batch_id = ?",
            (self.batch_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
