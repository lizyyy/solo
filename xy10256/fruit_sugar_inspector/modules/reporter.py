import json
import os
from typing import Dict, List, Any
from datetime import datetime


class Reporter:
    def __init__(self, output_dir: str = 'data/output'):
        self.output_dir = output_dir
        self.ensure_output_dir()

    def ensure_output_dir(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def generate_intermediate_results(self, data: Dict[str, Any], filename: str) -> str:
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath

    def generate_final_report(self, batch_info: Dict[str, Any], validation_result: Dict[str, Any],
                              sampling_info: Dict[str, Any], sampling_stats: Dict[str, Any],
                              batch_grade_info: Dict[str, Any], anomaly_result: Dict[str, Any],
                              classification_details: List[Dict[str, Any]]) -> Dict[str, Any]:
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        batch_id = batch_info.get('batch_id', 'unknown')
        
        report = {
            'report_id': f'RPT_{batch_id}_{timestamp}',
            'generated_at': datetime.now().isoformat(),
            'batch_info': {
                'batch_id': batch_info.get('batch_id'),
                'fruit_type': batch_info.get('fruit_type'),
                'batch_size': batch_info.get('batch_size'),
                'production_date': batch_info.get('production_date'),
                'source_farm': batch_info.get('source_farm')
            },
            'validation_result': validation_result,
            'sampling_info': sampling_info,
            'sampling_statistics': sampling_stats,
            'classification_result': batch_grade_info,
            'anomaly_detection': anomaly_result,
            'recommendations': self._generate_recommendations(anomaly_result, batch_grade_info, sampling_info),
            'classification_details': self._summarize_classification(classification_details),
            'overall_conclusion': self._generate_conclusion(anomaly_result, batch_grade_info)
        }
        
        return report

    def _summarize_classification(self, details: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not details:
            return {}
        
        sugars = [d['sugar'] for d in details]
        
        return {
            'total_samples': len(details),
            'sugar_statistics': {
                'min': min(sugars),
                'max': max(sugars),
                'average': sum(sugars) / len(sugars),
                'range': max(sugars) - min(sugars)
            },
            'samples': [
                {
                    'id': d['sample_id'],
                    'sugar': d['sugar'],
                    'grade': d['grade'],
                    'is_valid': d['is_valid'],
                    'near_boundary': d['near_boundary']['is_near']
                }
                for d in details
            ]
        }

    def _generate_recommendations(self, anomaly_result: Dict[str, Any],
                                  batch_grade_info: Dict[str, Any],
                                  sampling_info: Dict[str, Any]) -> List[str]:
        recommendations = []
        
        status = anomaly_result.get('overall_status', 'normal')
        
        if status == 'intercepted':
            recommendations.append('【紧急】批次检测存在严重问题，请立即暂停出货并进行全面复核')
            for alert in anomaly_result.get('alerts', []):
                if 'action_required' in alert:
                    recommendations.append(f'  - {alert["action_required"]}')
        elif status == 'needs_review':
            recommendations.append('【建议】批次存在需要关注的问题，建议进行人工复核')
            for warning in anomaly_result.get('warnings', []):
                if 'action_required' in warning:
                    recommendations.append(f'  - {warning["action_required"]}')
        
        if not sampling_info.get('meets_recommended', False):
            recommendations.append('建议增加抽样数量以提高检测置信度')
        
        confidence = batch_grade_info.get('confidence', 0)
        if confidence < 0.90:
            recommendations.append(f'当前分级置信度为 {confidence:.1%}，建议增加复核样本')
        
        if not recommendations:
            recommendations.append('批次检测通过，可正常进入下一道工序')
        
        return recommendations

    def _generate_conclusion(self, anomaly_result: Dict[str, Any],
                             batch_grade_info: Dict[str, Any]) -> Dict[str, Any]:
        status = anomaly_result.get('overall_status', 'normal')
        grade = batch_grade_info.get('batch_grade', '未知')
        confidence = batch_grade_info.get('confidence', 0)
        
        status_mapping = {
            'normal': '正常',
            'has_anomalies': '存在异常',
            'needs_review': '待复核',
            'intercepted': '已拦截'
        }
        
        return {
            'status': status_mapping.get(status, status),
            'status_code': status,
            'grade': grade,
            'confidence': confidence,
            'can_ship': status == 'normal',
            'summary': self._generate_summary_text(status, grade, confidence)
        }

    def _generate_summary_text(self, status: str, grade: str, confidence: float) -> str:
        if status == 'intercepted':
            return f'批次被拦截，存在严重质量风险。建议等级: {grade}'
        elif status == 'needs_review':
            return f'批次需要人工复核。建议等级: {grade} (置信度: {confidence:.1%})'
        elif status == 'has_anomalies':
            return f'批次存在异常，但不影响主要分级。建议等级: {grade}'
        else:
            return f'批次检测正常，建议等级: {grade} (置信度: {confidence:.1%})'

    def save_report(self, report: Dict[str, Any], format_type: str = 'both') -> Dict[str, str]:
        saved_files = {}
        batch_id = report['batch_info'].get('batch_id', 'unknown')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if format_type in ['json', 'both']:
            json_filename = f'report_{batch_id}_{timestamp}.json'
            json_path = os.path.join(self.output_dir, json_filename)
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            saved_files['json'] = json_path
        
        if format_type in ['txt', 'both']:
            txt_filename = f'report_{batch_id}_{timestamp}.txt'
            txt_path = os.path.join(self.output_dir, txt_filename)
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(self._format_text_report(report))
            saved_files['txt'] = txt_path
        
        return saved_files

    def _format_text_report(self, report: Dict[str, Any]) -> str:
        lines = []
        lines.append('=' * 70)
        lines.append('                   水果糖度抽检分级报告')
        lines.append('=' * 70)
        lines.append(f'报告编号: {report["report_id"]}')
        lines.append(f'生成时间: {report["generated_at"]}')
        lines.append('')
        
        lines.append('-' * 70)
        lines.append('一、批次基本信息')
        lines.append('-' * 70)
        batch = report['batch_info']
        lines.append(f'  批次编号: {batch["batch_id"]}')
        lines.append(f'  水果类型: {batch["fruit_type"]}')
        lines.append(f'  批次数量: {batch["batch_size"]} 个')
        lines.append(f'  生产日期: {batch["production_date"]}')
        lines.append(f'  来源农场: {batch["source_farm"]}')
        lines.append('')
        
        lines.append('-' * 70)
        lines.append('二、批次验证结果')
        lines.append('-' * 70)
        validation = report['validation_result']
        lines.append(f'  验证状态: {"通过" if validation["valid"] else "未通过"}')
        if validation['errors']:
            lines.append(f'  错误信息:')
            for err in validation['errors']:
                lines.append(f'    - {err}')
        lines.append('')
        
        lines.append('-' * 70)
        lines.append('三、抽样信息')
        lines.append('-' * 70)
        sampling = report['sampling_info']
        lines.append(f'  批次大小: {sampling["batch_size"]}')
        lines.append(f'  抽样数量: {sampling["sample_size"]}')
        lines.append(f'  抽样比例: {sampling["sample_ratio"]:.1%}')
        lines.append(f'  最低要求: {sampling["min_required"]} 个')
        lines.append(f'  推荐数量: {sampling["recommended"]} 个')
        lines.append(f'  满足最低要求: {"是" if sampling["meets_min_requirement"] else "否"}')
        lines.append(f'  满足推荐要求: {"是" if sampling["meets_recommended"] else "否"}')
        
        stats = report.get('sampling_statistics', {})
        if stats:
            lines.append(f'  抽样糖度范围: {stats.get("sugar_min", "N/A"):.1f} - {stats.get("sugar_max", "N/A"):.1f}')
            lines.append(f'  抽样平均糖度: {stats.get("sugar_avg", "N/A"):.2f}')
        lines.append('')
        
        lines.append('-' * 70)
        lines.append('四、分级结果')
        lines.append('-' * 70)
        classification = report['classification_result']
        lines.append(f'  建议批次等级: {classification["batch_grade"]}')
        lines.append(f'  分级置信度: {classification["confidence"]:.1%}')
        lines.append(f'  检测样本数: {classification["total_samples"]}')
        lines.append(f'  等级分布:')
        for grade, dist in classification.get('distribution', {}).items():
            lines.append(f'    - {grade}: {dist["count"]} 个 ({dist["percentage"]:.1%})')
        lines.append('')
        
        lines.append('-' * 70)
        lines.append('五、异常检测结果')
        lines.append('-' * 70)
        anomaly = report['anomaly_detection']
        lines.append(f'  总体状态: {anomaly["overall_status"]}')
        lines.append(f'  需要拦截: {"是" if anomaly["interception_needed"] else "否"}')
        lines.append(f'  需要复核: {"是" if anomaly["review_needed"] else "否"}')
        
        if anomaly['alerts']:
            lines.append('')
            lines.append('  【警报】')
            for alert in anomaly['alerts']:
                lines.append(f'    - [{alert["severity"]}] {alert["message"]}')
        
        if anomaly['warnings']:
            lines.append('')
            lines.append('  【警告】')
            for warning in anomaly['warnings']:
                lines.append(f'    - [{warning["severity"]}] {warning["message"]}')
        
        if anomaly['anomalies']:
            lines.append('')
            lines.append('  【异常记录】')
            for anom in anomaly['anomalies']:
                lines.append(f'    - [{anom["severity"]}] {anom["message"]}')
        lines.append('')
        
        lines.append('-' * 70)
        lines.append('六、建议与措施')
        lines.append('-' * 70)
        for rec in report['recommendations']:
            lines.append(f'  {rec}')
        lines.append('')
        
        lines.append('-' * 70)
        lines.append('七、总体结论')
        lines.append('-' * 70)
        conclusion = report['overall_conclusion']
        lines.append(f'  状态: {conclusion["status"]}')
        lines.append(f'  建议等级: {conclusion["grade"]}')
        lines.append(f'  置信度: {conclusion["confidence"]:.1%}')
        lines.append(f'  能否出货: {"是" if conclusion["can_ship"] else "否"}')
        lines.append(f'  总结: {conclusion["summary"]}')
        lines.append('')
        
        lines.append('-' * 70)
        lines.append('八、样本分级详情')
        lines.append('-' * 70)
        details = report.get('classification_details', {})
        samples = details.get('samples', [])
        lines.append(f'  样本总数: {len(samples)}')
        
        sugar_stats = details.get('sugar_statistics', {})
        if sugar_stats:
            lines.append(f'  糖度统计:')
            lines.append(f'    最小值: {sugar_stats.get("min", "N/A"):.1f}')
            lines.append(f'    最大值: {sugar_stats.get("max", "N/A"):.1f}')
            lines.append(f'    平均值: {sugar_stats.get("average", "N/A"):.2f}')
            lines.append(f'    极差: {sugar_stats.get("range", "N/A"):.1f}')
        
        lines.append('')
        lines.append('  样本列表:')
        lines.append(f'  {"样本ID":<12} {"糖度":<8} {"等级":<8} {"有效":<6} {"边界":<6}')
        lines.append('  ' + '-' * 45)
        for s in samples:
            lines.append(f'  {s["id"]:<12} {s["sugar"]:<8.1f} {s["grade"]:<8} {"是" if s["is_valid"] else "否":<6} {"是" if s["near_boundary"] else "否":<6}')
        
        lines.append('')
        lines.append('=' * 70)
        lines.append('                          报告结束')
        lines.append('=' * 70)
        
        return '\n'.join(lines)
