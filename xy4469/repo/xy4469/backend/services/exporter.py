import json
import csv
from io import StringIO
from datetime import datetime
from typing import Dict, List, Any
from models import Batch, Particle, Control, AuditLog, db
from services.classifier import MicroplasticClassifier
from config import Config

class DataExporter:
    @staticmethod
    def generate_quality_report(batch_id: str) -> str:
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        if not batch:
            raise ValueError(f'批次 {batch_id} 不存在')
        
        particles = Particle.query.filter_by(batch_id=batch.id).all()
        controls = Control.query.filter_by(batch_id=batch.id).all()
        
        stats = DataExporter._calculate_statistics(particles)
        reviewed_count = sum(1 for p in particles if p.manual_classification is not None)
        total_count = len(particles)
        
        report_lines = []
        report_lines.append('# 微塑料滤膜质检报告')
        report_lines.append('')
        report_lines.append('## 基本信息')
        report_lines.append('')
        report_lines.append(f'- **批次编号**: {batch.batch_id}')
        report_lines.append(f'- **样本名称**: {batch.sample_name}')
        if batch.collection_date:
            report_lines.append(f'- **采样日期**: {batch.collection_date}')
        if batch.location:
            report_lines.append(f'- **采样地点**: {batch.location}')
        if batch.sample_type:
            report_lines.append(f'- **样本类型**: {batch.sample_type}')
        if batch.technician:
            report_lines.append(f'- **检测人员**: {batch.technician}')
        report_lines.append(f'- **报告生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        report_lines.append('')
        
        report_lines.append('## 统计摘要')
        report_lines.append('')
        report_lines.append(f'- **总颗粒数**: {total_count}')
        report_lines.append(f'- **已复核**: {reviewed_count} ({(reviewed_count/total_count*100):.1f}%)' if total_count > 0 else '- **已复核**: 0')
        report_lines.append(f'- **未复核**: {total_count - reviewed_count}')
        report_lines.append('')
        
        report_lines.append('### 分类统计')
        report_lines.append('')
        report_lines.append('| 类型 | 数量 | 占比 | 风险等级 |')
        report_lines.append('|------|------|------|----------|')
        
        for cls, count in stats['classification_stats'].items():
            if count > 0:
                label = MicroplasticClassifier.get_classification_label(cls)
                percentage = (count / total_count * 100) if total_count > 0 else 0
                risk_level = '高' if cls == 'fiber' else ('中' if cls == 'particle' else '低')
                report_lines.append(f'| {label} | {count} | {percentage:.1f}% | {risk_level} |')
        
        report_lines.append('')
        
        report_lines.append('### 风险统计')
        report_lines.append('')
        report_lines.append('| 风险等级 | 数量 | 占比 |')
        report_lines.append('|----------|------|------|')
        
        for risk, count in stats['risk_stats'].items():
            if count > 0:
                label = MicroplasticClassifier.get_risk_label(risk)
                percentage = (count / total_count * 100) if total_count > 0 else 0
                report_lines.append(f'| {label} | {count} | {percentage:.1f}% |')
        
        report_lines.append('')
        
        if controls:
            report_lines.append('## 空白对照')
            report_lines.append('')
            for ctrl in controls:
                report_lines.append(f'### {ctrl.control_name}')
                report_lines.append('')
                report_lines.append(f'- **对照类型**: {ctrl.control_type}')
                report_lines.append(f'- **颗粒数**: {ctrl.particle_count}')
                report_lines.append(f'- **纤维数**: {ctrl.fiber_count}')
                report_lines.append(f'- **气泡数**: {ctrl.bubble_count}')
                if ctrl.notes:
                    report_lines.append(f'- **备注**: {ctrl.notes}')
                report_lines.append('')
        
        report_lines.append('## 高风险颗粒列表')
        report_lines.append('')
        
        high_risk_particles = [p for p in particles if p.risk_level == 'high']
        if high_risk_particles:
            report_lines.append('| 颗粒编号 | 分类 | 置信度 | 面积 | 是否复核 |')
            report_lines.append('|----------|------|--------|------|----------|')
            
            for p in high_risk_particles[:20]:
                cls_label = MicroplasticClassifier.get_classification_label(p.get_final_classification())
                confidence = f'{p.get_final_confidence()*100:.0f}%'
                area = f'{p.area:.2f}' if p.area else '-'
                reviewed = '是' if p.is_reviewed else '否'
                report_lines.append(f'| {p.particle_id} | {cls_label} | {confidence} | {area} | {reviewed} |')
            
            if len(high_risk_particles) > 20:
                report_lines.append('')
                report_lines.append(f'*注: 共 {len(high_risk_particles)} 个高风险颗粒，仅显示前 20 个，完整列表请查看 CSV 风险清单*')
        else:
            report_lines.append('本批次无高风险颗粒。')
        
        report_lines.append('')
        
        if batch.notes:
            report_lines.append('## 备注')
            report_lines.append('')
            report_lines.append(batch.notes)
            report_lines.append('')
        
        report_lines.append('---')
        report_lines.append('')
        report_lines.append(f'*本报告由微塑料滤膜初筛台自动生成，生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*')
        
        return '\n'.join(report_lines)
    
    @staticmethod
    def generate_risk_csv(batch_id: str) -> str:
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        if not batch:
            raise ValueError(f'批次 {batch_id} 不存在')
        
        particles = Particle.query.filter_by(batch_id=batch.id).all()
        
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            'batch_id', 'particle_id', 'classification', 'classification_label',
            'confidence', 'risk_level', 'risk_label', 'area', 'perimeter',
            'aspect_ratio', 'circularity', 'is_reviewed', 'reviewed_by',
            'reviewed_at', 'x_coordinate', 'y_coordinate', 'is_flagged'
        ])
        
        for p in particles:
            final_cls = p.get_final_classification()
            final_conf = p.get_final_confidence()
            
            writer.writerow([
                batch.batch_id,
                p.particle_id,
                final_cls,
                MicroplasticClassifier.get_classification_label(final_cls),
                f'{final_conf:.4f}',
                p.risk_level or 'unknown',
                MicroplasticClassifier.get_risk_label(p.risk_level) if p.risk_level else '未知',
                f'{p.area:.4f}' if p.area else '',
                f'{p.perimeter:.4f}' if p.perimeter else '',
                f'{p.aspect_ratio:.4f}' if p.aspect_ratio else '',
                f'{p.circularity:.4f}' if p.circularity else '',
                '1' if p.is_reviewed else '0',
                p.reviewed_by or '',
                p.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if p.reviewed_at else '',
                f'{p.x_coordinate:.4f}' if p.x_coordinate else '',
                f'{p.y_coordinate:.4f}' if p.y_coordinate else '',
                '1' if p.is_flagged else '0'
            ])
        
        return output.getvalue()
    
    @staticmethod
    def generate_audit_json(batch_id: str) -> str:
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        if not batch:
            raise ValueError(f'批次 {batch_id} 不存在')
        
        particles = Particle.query.filter_by(batch_id=batch.id).all()
        controls = Control.query.filter_by(batch_id=batch.id).all()
        
        audit_data = {
            'audit_version': '1.0',
            'generated_at': datetime.now().isoformat(),
            'batch': batch.to_dict(),
            'particles': [],
            'controls': [],
            'audit_trail': [],
            'statistics': {}
        }
        
        for p in particles:
            audit_data['particles'].append({
                'id': p.id,
                'particle_id': p.particle_id,
                'features': {
                    'area': p.area,
                    'perimeter': p.perimeter,
                    'aspect_ratio': p.aspect_ratio,
                    'circularity': p.circularity,
                    'solidity': p.solidity,
                    'extent': p.extent,
                    'mean_intensity': p.mean_intensity,
                    'max_intensity': p.max_intensity,
                    'min_intensity': p.min_intensity,
                    'color': [p.color_r, p.color_g, p.color_b] if all([p.color_r, p.color_g, p.color_b]) else None
                },
                'classification': {
                    'auto': {
                        'label': p.auto_classification,
                        'confidence': p.auto_confidence
                    },
                    'manual': {
                        'label': p.manual_classification,
                        'confidence': p.manual_confidence,
                        'reviewed_by': p.reviewed_by,
                        'reviewed_at': p.reviewed_at.isoformat() if p.reviewed_at else None,
                        'notes': p.review_notes
                    },
                    'final': {
                        'label': p.get_final_classification(),
                        'confidence': p.get_final_confidence(),
                        'label_cn': MicroplasticClassifier.get_classification_label(p.get_final_classification())
                    }
                },
                'risk': {
                    'level': p.risk_level,
                    'label_cn': MicroplasticClassifier.get_risk_label(p.risk_level) if p.risk_level else None
                },
                'location': {
                    'image_path': p.image_path,
                    'x_coordinate': p.x_coordinate,
                    'y_coordinate': p.y_coordinate
                },
                'is_flagged': p.is_flagged,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'updated_at': p.updated_at.isoformat() if p.updated_at else None
            })
        
        for ctrl in controls:
            audit_data['controls'].append(ctrl.to_dict())
        
        audit_logs = AuditLog.query.filter_by(entity_type='batch', entity_id=batch.id).all()
        for log in audit_logs:
            audit_data['audit_trail'].append(log.to_dict())
        
        stats = DataExporter._calculate_statistics(particles)
        audit_data['statistics'] = stats
        
        return json.dumps(audit_data, ensure_ascii=False, indent=2)
    
    @staticmethod
    def _calculate_statistics(particles: List[Particle]) -> Dict[str, Any]:
        classification_stats = {cls: 0 for cls in Config.CLASSIFICATION_CLASSES}
        risk_stats = {risk: 0 for risk in Config.RISK_LEVELS}
        auto_stats = {cls: 0 for cls in Config.CLASSIFICATION_CLASSES}
        manual_stats = {cls: 0 for cls in Config.CLASSIFICATION_CLASSES}
        
        total_area = 0.0
        area_count = 0
        reviewed_count = 0
        flagged_count = 0
        
        for p in particles:
            final_cls = p.get_final_classification()
            if final_cls in classification_stats:
                classification_stats[final_cls] += 1
            
            if p.risk_level in risk_stats:
                risk_stats[p.risk_level] += 1
            
            if p.auto_classification in auto_stats:
                auto_stats[p.auto_classification] += 1
            
            if p.manual_classification:
                if p.manual_classification in manual_stats:
                    manual_stats[p.manual_classification] += 1
                reviewed_count += 1
            
            if p.area:
                total_area += p.area
                area_count += 1
            
            if p.is_flagged:
                flagged_count += 1
        
        return {
            'total_count': len(particles),
            'reviewed_count': reviewed_count,
            'flagged_count': flagged_count,
            'average_area': total_area / area_count if area_count > 0 else 0,
            'classification_stats': classification_stats,
            'risk_stats': risk_stats,
            'auto_classification_stats': auto_stats,
            'manual_classification_stats': manual_stats
        }
