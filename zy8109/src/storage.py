import os
import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import asdict, is_dataclass

from .risk_detector import RiskFinding, RiskDetector
from .text_features import TextCluster, ShortTextInfo, ClusterManager
from .data_parser import Conversation, PolicyKnowledgeBase, InspectionRecord


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if is_dataclass(obj):
            return asdict(obj)
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        return super().default(obj)


class StorageManager:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def save_findings_to_csv(self, findings: List[RiskFinding], filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"risks_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        filepath = os.path.join(self.output_dir, filename)

        fieldnames = [
            'risk_id',
            'session_id',
            'risk_type',
            'risk_level',
            'description',
            'evidence',
            'confidence',
            'confirmed',
            'inspector_notes',
            'detected_at',
            'suggested_fix'
        ]

        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for finding in findings:
                row = {
                    'risk_id': finding.risk_id,
                    'session_id': finding.session_id,
                    'risk_type': finding.risk_type,
                    'risk_level': finding.risk_level,
                    'description': finding.description,
                    'evidence': finding.evidence.replace('\n', '\\n'),
                    'confidence': f"{finding.confidence:.2f}",
                    'confirmed': '是' if finding.confirmed else '否',
                    'inspector_notes': finding.inspector_notes,
                    'detected_at': finding.detected_at.strftime('%Y-%m-%d %H:%M:%S') if finding.detected_at else '',
                    'suggested_fix': finding.suggested_fix
                }
                writer.writerow(row)

        return filepath

    def load_findings_from_csv(self, filepath: str) -> List[RiskFinding]:
        findings = []

        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)

            for row in reader:
                try:
                    detected_at = None
                    if row.get('detected_at'):
                        detected_at = datetime.strptime(row['detected_at'], '%Y-%m-%d %H:%M:%S')

                    confidence = 0.0
                    try:
                        confidence = float(row.get('confidence', '0.0'))
                    except ValueError:
                        pass

                    finding = RiskFinding(
                        risk_id=row.get('risk_id', ''),
                        session_id=row.get('session_id', ''),
                        risk_type=row.get('risk_type', ''),
                        risk_level=row.get('risk_level', 'medium'),
                        description=row.get('description', ''),
                        evidence=row.get('evidence', '').replace('\\n', '\n'),
                        confidence=confidence,
                        confirmed=row.get('confirmed', '否') == '是',
                        inspector_notes=row.get('inspector_notes', ''),
                        suggested_fix=row.get('suggested_fix', ''),
                        detected_at=detected_at or datetime.now(),
                        metadata={}
                    )
                    findings.append(finding)
                except Exception as e:
                    print(f"Warning: Failed to parse row: {e}")
                    continue

        return findings


class ReportExporter:
    RISK_TYPE_NAMES = {
        'OLD_POLICY': '旧政策话术',
        'IRRELEVANT_ANSWER': '答非所问',
        'FABRICATED_CLAUSE': '疑似编造条款引用',
        'VERSION_CONFLICT': '政策版本冲突'
    }

    RISK_LEVEL_ORDER = {'high': '高', 'medium': '中', 'low': '低'}

    def __init__(self):
        self.generated_at = datetime.now()

    def generate_report(
        self,
        findings: List[RiskFinding],
        clusters: List[TextCluster],
        short_texts: List[ShortTextInfo],
        cluster_stats: Dict[str, Any],
        risk_stats: Dict[str, Any],
        conversations_count: int = 0,
        output_path: Optional[str] = None
    ) -> str:

        report_content = self._build_report_content(
            findings, clusters, short_texts,
            cluster_stats, risk_stats, conversations_count
        )

        if output_path is None:
            output_path = f"report_{self.generated_at.strftime('%Y%m%d_%H%M%S')}.md"

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report_content)

        return output_path

    def _build_report_content(
        self,
        findings: List[RiskFinding],
        clusters: List[TextCluster],
        short_texts: List[ShortTextInfo],
        cluster_stats: Dict[str, Any],
        risk_stats: Dict[str, Any],
        conversations_count: int
    ) -> str:

        lines = []

        lines.append("# 客服话术质检报告")
        lines.append("")
        lines.append(f"> 生成时间: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 一、执行概览")
        lines.append("")
        lines.append(f"- **总检测会话数**: {conversations_count}")
        lines.append(f"- **成功聚类数**: {cluster_stats.get('valid_clustered', 0)}")
        lines.append(f"- **短句/无法聚类数**: {cluster_stats.get('short_texts', 0)}")
        lines.append(f"- **检测到风险数**: {risk_stats.get('total_findings', 0)}")
        lines.append(f"- **已确认风险数**: {risk_stats.get('confirmed_count', 0)}")
        lines.append(f"- **高置信度风险数**: {risk_stats.get('high_confidence_count', 0)}")
        lines.append("")

        lines.append("## 二、意图聚类分析")
        lines.append("")
        lines.append(f"### 2.1 聚类统计")
        lines.append("")
        lines.append(f"- **聚类数量**: {cluster_stats.get('number_of_clusters', 0)}")
        lines.append(f"- **平均聚类大小**: {cluster_stats.get('avg_cluster_size', 0):.1f}")
        lines.append(f"- **最大聚类大小**: {cluster_stats.get('largest_cluster', 0)}")
        lines.append(f"- **最小聚类大小**: {cluster_stats.get('smallest_cluster', 0)}")
        lines.append("")

        if clusters:
            lines.append("### 2.2 各聚类详情")
            lines.append("")
            for i, cluster in enumerate(clusters, 1):
                lines.append(f"#### 聚类 {i}: {cluster.intent_label}")
                lines.append("")
                lines.append(f"- **会话数**: {cluster.size}")
                lines.append(f"- **关键词**: {', '.join(cluster.keywords[:5]) if cluster.keywords else '无'}")
                lines.append("")
                if cluster.representative_texts:
                    lines.append("**代表性文本**:")
                    lines.append("")
                    for j, text in enumerate(cluster.representative_texts, 1):
                        lines.append(f"{j}. {text}")
                    lines.append("")

        if short_texts:
            lines.append("### 2.3 短句/无法聚类会话")
            lines.append("")
            lines.append(f"共 {len(short_texts)} 个会话因文本过短或无法聚类需要人工复核：")
            lines.append("")
            lines.append("| 会话ID | 文本预览 | 词数 | 原因 |")
            lines.append("|--------|----------|------|------|")
            for st in short_texts[:20]:
                preview = st.text.replace('|', '\\|')[:30] + '...' if len(st.text) > 30 else st.text.replace('|', '\\|')
                lines.append(f"| {st.session_id} | {preview} | {st.word_count} | {st.reason} |")
            if len(short_texts) > 20:
                lines.append(f"| ... | ... | ... | ... |")
                lines.append(f"| *(共 {len(short_texts)} 条，仅显示前20条)* | | | |")
            lines.append("")

        lines.append("## 三、风险检测结果")
        lines.append("")

        lines.append("### 3.1 风险统计")
        lines.append("")

        by_type = risk_stats.get('by_type', {})
        if by_type:
            lines.append("**按风险类型分布**:")
            lines.append("")
            lines.append("| 风险类型 | 检测数量 |")
            lines.append("|----------|----------|")
            for risk_type, count in by_type.items():
                type_name = self.RISK_TYPE_NAMES.get(risk_type, risk_type)
                lines.append(f"| {type_name} | {count} |")
            lines.append("")

        by_level = risk_stats.get('by_level', {})
        if by_level:
            lines.append("**按风险等级分布**:")
            lines.append("")
            lines.append("| 风险等级 | 检测数量 |")
            lines.append("|----------|----------|")
            for level, name in [('high', '高'), ('medium', '中'), ('low', '低')]:
                count = by_level.get(level, 0)
                lines.append(f"| {name} | {count} |")
            lines.append("")

        if findings:
            lines.append("### 3.2 风险详情")
            lines.append("")

            for level in ['high', 'medium', 'low']:
                level_findings = [f for f in findings if f.risk_level == level]
                if not level_findings:
                    continue

                level_name = self.RISK_LEVEL_ORDER.get(level, level)
                lines.append(f"#### {level_name}风险")
                lines.append("")

                for finding in level_findings:
                    type_name = self.RISK_TYPE_NAMES.get(finding.risk_type, finding.risk_type)
                    status = "✅ 已确认" if finding.confirmed else "⏳ 待确认"

                    lines.append(f"**[{finding.risk_id}] {type_name}** - {status}")
                    lines.append("")
                    lines.append(f"- **会话ID**: {finding.session_id}")
                    lines.append(f"- **置信度**: {finding.confidence:.1%}")
                    lines.append(f"- **描述**: {finding.description}")
                    lines.append("")
                    lines.append("**证据**:")
                    lines.append("")
                    lines.append("```")
                    for line in finding.evidence.split('\n')[:10]:
                        lines.append(line)
                    if len(finding.evidence.split('\n')) > 10:
                        lines.append("... (更多内容请查看CSV文件)")
                    lines.append("```")
                    lines.append("")

                    if finding.inspector_notes:
                        lines.append(f"**质检员备注**: {finding.inspector_notes}")
                        lines.append("")

        lines.append("## 四、处理建议")
        lines.append("")

        high_count = len([f for f in findings if f.risk_level == 'high'])
        if high_count > 0:
            lines.append(f"### 4.1 紧急处理 ({high_count} 项高风险)")
            lines.append("")
            lines.append("1. **立即复核高风险项**: 所有标记为\"高\"的风险需要优先确认")
            lines.append("2. **旧政策话术**: 确认客服是否确实使用了过期政策，如有需要进行再培训")
            lines.append("3. **编造条款引用**: 这是严重违规行为，需要核实并按规定处理")
            lines.append("4. **版本冲突**: 请检查知识库中的政策版本管理，确保生效时间不重叠")
            lines.append("")

        lines.append("### 4.2 常规处理")
        lines.append("")
        lines.append("1. **短句会话**: 建议人工复核所有文本过短的会话")
        lines.append("2. **答非所问**: 检查客服是否理解用户问题，或是否存在系统转译错误")
        lines.append("3. **聚类分析**: 根据聚类结果可以分析客服的常见问题类型")
        lines.append("")

        lines.append("## 五、附录")
        lines.append("")
        lines.append("### 5.1 风险类型说明")
        lines.append("")
        lines.append("| 风险类型 | 说明 |")
        lines.append("|----------|------|")
        lines.append("| 旧政策话术 | 客服回复中使用了已过期或失效的政策条款 |")
        lines.append("| 答非所问 | 客服回复与用户问题语义相似度低，可能没有正确理解问题 |")
        lines.append("| 疑似编造条款引用 | 客服引用了知识库中不存在的条款号或政策内容 |")
        lines.append("| 政策版本冲突 | 知识库中同一政策存在多个版本且生效时间重叠 |")
        lines.append("")

        lines.append("### 5.2 置信度说明")
        lines.append("")
        lines.append("- **高置信度 (>= 70%)**: 算法判断较为准确，建议优先确认")
        lines.append("- **中置信度 (40%-70%)**: 需要人工核实")
        lines.append("- **低置信度 (< 40%)**: 仅供参考，可能为误报")
        lines.append("")

        lines.append("---")
        lines.append(f"*报告由客服话术质检系统自动生成，生成时间: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}*")

        return '\n'.join(lines)

    def generate_summary_json(
        self,
        findings: List[RiskFinding],
        clusters: List[TextCluster],
        short_texts: List[ShortTextInfo],
        cluster_stats: Dict[str, Any],
        risk_stats: Dict[str, Any]
    ) -> Dict[str, Any]:

        summary = {
            'generated_at': self.generated_at.isoformat(),
            'summary': {
                'total_findings': risk_stats.get('total_findings', 0),
                'total_clusters': cluster_stats.get('number_of_clusters', 0),
                'total_conversations': cluster_stats.get('total_conversations', 0),
                'short_text_count': len(short_texts)
            },
            'risks_by_type': risk_stats.get('by_type', {}),
            'risks_by_level': risk_stats.get('by_level', {}),
            'clusters': [],
            'findings': []
        }

        for cluster in clusters:
            summary['clusters'].append({
                'cluster_id': cluster.cluster_id,
                'intent_label': cluster.intent_label,
                'size': cluster.size,
                'keywords': cluster.keywords,
                'session_ids': cluster.session_ids[:10]
            })

        for finding in findings:
            summary['findings'].append({
                'risk_id': finding.risk_id,
                'session_id': finding.session_id,
                'risk_type': finding.risk_type,
                'risk_level': finding.risk_level,
                'confidence': finding.confidence,
                'confirmed': finding.confirmed,
                'description': finding.description
            })

        return summary
