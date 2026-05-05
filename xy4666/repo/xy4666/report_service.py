import json
from datetime import datetime
from models import db, Sample, AnomalySample, DuplicateSample, AuditLog
from import_service import ImportService

class ReportService:
    def __init__(self):
        self.import_service = ImportService()
    
    def generate_markdown_report(self, start_date=None, end_date=None, include_all_anomalies=True):
        """生成Markdown格式的检测报告"""
        # 获取统计数据
        total_samples = Sample.query.count()
        normal_samples = Sample.query.filter_by(status='normal').count()
        fixed_samples = Sample.query.filter_by(status='fixed').count()
        
        # 风险统计
        critical_risk = Sample.query.filter_by(risk_level='critical').count()
        warning_risk = Sample.query.filter_by(risk_level='warning').count()
        normal_risk = Sample.query.filter_by(risk_level='normal').count()
        
        # 异常统计
        total_anomalies = AnomalySample.query.count()
        fixed_anomalies = AnomalySample.query.filter_by(is_fixed=True).count()
        pending_anomalies = AnomalySample.query.filter_by(is_fixed=False).count()
        
        # 重复统计
        total_duplicates = DuplicateSample.query.count()
        pending_duplicates = DuplicateSample.query.filter_by(status='pending').count()
        
        # 生成报告
        report = []
        report.append("# 纺织品检测实验室报告")
        report.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # 一、总体概况
        report.append("## 一、总体概况")
        report.append("")
        report.append("### 1.1 样本统计")
        report.append(f"| 类别 | 数量 |")
        report.append(f"|------|------|")
        report.append(f"| 总样本数 | {total_samples} |")
        report.append(f"| 正常样本 | {normal_samples} |")
        report.append(f"| 修复样本 | {fixed_samples} |")
        report.append("")
        
        report.append("### 1.2 风险等级分布")
        report.append(f"| 风险等级 | 数量 | 占比 |")
        report.append(f"|----------|------|------|")
        if total_samples > 0:
            report.append(f"| 严重风险 (critical) | {critical_risk} | {critical_risk/total_samples*100:.1f}% |")
            report.append(f"| 警告风险 (warning) | {warning_risk} | {warning_risk/total_samples*100:.1f}% |")
            report.append(f"| 正常风险 (normal) | {normal_risk} | {normal_risk/total_samples*100:.1f}% |")
        else:
            report.append(f"| 严重风险 (critical) | 0 | 0.0% |")
            report.append(f"| 警告风险 (warning) | 0 | 0.0% |")
            report.append(f"| 正常风险 (normal) | 0 | 0.0% |")
        report.append("")
        
        # 二、异常样本详情
        report.append("## 二、异常样本详情")
        report.append("")
        report.append("### 2.1 异常统计")
        report.append(f"| 状态 | 数量 |")
        report.append(f"|------|------|")
        report.append(f"| 总异常数 | {total_anomalies} |")
        report.append(f"| 待修复 | {pending_anomalies} |")
        report.append(f"| 已修复 | {fixed_anomalies} |")
        report.append("")
        
        if include_all_anomalies and pending_anomalies > 0:
            report.append("### 2.2 待修复异常详情")
            report.append("")
            
            pending = AnomalySample.query.filter_by(is_fixed=False).all()
            for anomaly in pending:
                report.append(f"#### 异常ID: {anomaly.id}")
                report.append(f"- **文件来源**: {anomaly.original_filename}")
                report.append(f"- **行号**: {anomaly.line_number}")
                report.append(f"- **样本编号**: {anomaly.sample_id if anomaly.sample_id else '无'}")
                report.append(f"- **异常类型**: {self._translate_anomaly_type(anomaly.anomaly_type)}")
                report.append(f"- **异常原因**: {anomaly.anomaly_reason}")
                if anomaly.affected_fields:
                    fields = json.loads(anomaly.affected_fields)
                    report.append(f"- **受影响字段**: {', '.join(fields)}")
                report.append(f"- **原始数据**: {anomaly.raw_data}")
                report.append("")
        
        if include_all_anomalies and fixed_anomalies > 0:
            report.append("### 2.3 已修复异常详情")
            report.append("")
            
            fixed = AnomalySample.query.filter_by(is_fixed=True).all()
            for anomaly in fixed:
                report.append(f"#### 异常ID: {anomaly.id}")
                report.append(f"- **文件来源**: {anomaly.original_filename}")
                report.append(f"- **样本编号**: {anomaly.sample_id if anomaly.sample_id else '无'}")
                report.append(f"- **异常类型**: {self._translate_anomaly_type(anomaly.anomaly_type)}")
                report.append(f"- **修复人员**: {anomaly.fixed_by if anomaly.fixed_by else '未记录'}")
                report.append(f"- **修复时间**: {anomaly.fixed_at.strftime('%Y-%m-%d %H:%M:%S') if anomaly.fixed_at else '未知'}")
                if anomaly.fix_notes:
                    report.append(f"- **修复备注**: {anomaly.fix_notes}")
                if anomaly.fixed_sample_id:
                    report.append(f"- **关联样本ID**: {anomaly.fixed_sample_id}")
                report.append("")
        
        # 三、重复样本
        report.append("## 三、重复样本")
        report.append("")
        report.append(f"总重复记录数: {total_duplicates}")
        report.append(f"待处理重复: {pending_duplicates}")
        report.append("")
        
        if pending_duplicates > 0:
            report.append("### 3.1 待处理重复详情")
            report.append("")
            
            pending_dup = DuplicateSample.query.filter_by(status='pending').all()
            for dup in pending_dup:
                report.append(f"#### 重复ID: {dup.id}")
                report.append(f"- **样本编号**: {dup.sample_id}")
                report.append(f"- **来源文件**: {dup.source_filename}")
                report.append(f"- **原始样本ID**: {dup.original_sample_id}")
                if dup.differing_fields:
                    diffs = json.loads(dup.differing_fields)
                    report.append(f"- **差异字段**: {json.dumps(diffs, ensure_ascii=False)}")
                report.append("")
        
        # 四、高风险样本
        report.append("## 四、高风险样本")
        report.append("")
        
        high_risk = Sample.query.filter(Sample.risk_level.in_(['critical', 'warning'])).order_by(Sample.risk_score.desc()).all()
        
        if high_risk:
            report.append(f"### 4.1 风险样本列表 (共{len(high_risk)}个)")
            report.append("")
            report.append(f"| 样本编号 | 风险等级 | 风险评分 | 主要问题 |")
            report.append(f"|----------|----------|----------|----------|")
            
            for sample in high_risk:
                issues = self._identify_issues(sample)
                report.append(f"| {sample.sample_id} | {sample.risk_level} | {sample.risk_score:.1f} | {issues} |")
        else:
            report.append("当前无高风险样本")
        report.append("")
        
        # 五、审计信息
        report.append("## 五、审计信息")
        report.append("")
        
        recent_imports = AuditLog.query.filter_by(action='import').order_by(AuditLog.created_at.desc()).limit(10).all()
        
        if recent_imports:
            report.append("### 5.1 最近导入记录")
            report.append("")
            report.append(f"| 时间 | 操作 | 来源 |")
            report.append(f"|------|------|------|")
            for log in recent_imports:
                report.append(f"| {log.created_at.strftime('%Y-%m-%d %H:%M:%S')} | {log.action} | {log.import_source if log.import_source else '未知'} |")
        report.append("")
        
        report.append("---")
        report.append("*报告由纺织品检测实验室系统自动生成*")
        
        return "\n".join(report)
    
    def generate_audit_package(self, start_date=None, end_date=None):
        """生成JSON格式的审计包"""
        # 收集所有审计相关数据
        audit_data = {
            'generated_at': datetime.utcnow().isoformat(),
            'period': {
                'start': start_date.isoformat() if start_date else None,
                'end': end_date.isoformat() if end_date else None
            },
            'samples': {
                'total': Sample.query.count(),
                'by_risk_level': {
                    'critical': Sample.query.filter_by(risk_level='critical').count(),
                    'warning': Sample.query.filter_by(risk_level='warning').count(),
                    'normal': Sample.query.filter_by(risk_level='normal').count()
                },
                'by_status': {
                    'normal': Sample.query.filter_by(status='normal').count(),
                    'fixed': Sample.query.filter_by(status='fixed').count(),
                    'duplicate': Sample.query.filter_by(status='duplicate').count()
                }
            },
            'anomalies': {
                'total': AnomalySample.query.count(),
                'pending': AnomalySample.query.filter_by(is_fixed=False).count(),
                'fixed': AnomalySample.query.filter_by(is_fixed=True).count(),
                'by_type': {}
            },
            'duplicates': {
                'total': DuplicateSample.query.count(),
                'pending': DuplicateSample.query.filter_by(status='pending').count(),
                'resolved': DuplicateSample.query.filter(DuplicateSample.status != 'pending').count()
            },
            'audit_logs': [],
            'pending_anomalies_details': [],
            'high_risk_samples': []
        }
        
        # 按类型统计异常
        anomaly_types = db.session.query(
            AnomalySample.anomaly_type,
            db.func.count(AnomalySample.id)
        ).group_by(AnomalySample.anomaly_type).all()
        
        for anomaly_type, count in anomaly_types:
            audit_data['anomalies']['by_type'][anomaly_type] = count
        
        # 待修复异常详情
        pending_anomalies = AnomalySample.query.filter_by(is_fixed=False).all()
        for anomaly in pending_anomalies:
            audit_data['pending_anomalies_details'].append(anomaly.to_dict())
        
        # 高风险样本
        high_risk = Sample.query.filter(Sample.risk_level.in_(['critical', 'warning'])).all()
        for sample in high_risk:
            sample_dict = sample.to_dict()
            sample_dict['issues'] = self._identify_issues(sample)
            audit_data['high_risk_samples'].append(sample_dict)
        
        # 审计日志（最近100条）
        logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(100).all()
        for log in logs:
            audit_data['audit_logs'].append(log.to_dict())
        
        return json.dumps(audit_data, ensure_ascii=False, indent=2)
    
    def _translate_anomaly_type(self, anomaly_type):
        """转换异常类型为中文"""
        translations = {
            'missing_field': '缺失字段',
            'invalid_id': '无效编号',
            'out_of_range': '数值越界',
            'duplicate': '重复样本'
        }
        return translations.get(anomaly_type, anomaly_type)
    
    def _identify_issues(self, sample):
        """识别样本的主要问题"""
        issues = []
        
        if sample.delta_e is not None:
            if sample.delta_e >= 4.0:
                issues.append(f"色差ΔE={sample.delta_e:.2f}(严重)")
            elif sample.delta_e >= 3.0:
                issues.append(f"色差ΔE={sample.delta_e:.2f}(警告)")
        
        if sample.friction_dry_grade is not None and sample.friction_dry_grade < 3:
            issues.append(f"干摩擦={sample.friction_dry_grade}级")
        if sample.friction_wet_grade is not None and sample.friction_wet_grade < 3:
            issues.append(f"湿摩擦={sample.friction_wet_grade}级")
        
        if sample.washing_color_fastness is not None and sample.washing_color_fastness < 3:
            issues.append(f"洗涤色牢度={sample.washing_color_fastness}级")
        if sample.washing_staining is not None and sample.washing_staining < 3:
            issues.append(f"洗涤沾色={sample.washing_staining}级")
        
        return "; ".join(issues) if issues else "无明显问题"
