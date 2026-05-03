import os
import csv
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict


class Exporter:
    def __init__(self, export_dir: str):
        self.export_dir = export_dir
        self._ensure_directory()

    def _ensure_directory(self):
        os.makedirs(self.export_dir, exist_ok=True)

    def export_weekly_report(self, clusters: List[Dict[str, Any]],
                              statistics: Dict[str, Any],
                              report_date: Optional[str] = None) -> str:
        if report_date is None:
            report_date = datetime.now().strftime('%Y年%m月%d日')
        
        week_start = (datetime.now() - timedelta(days=7)).strftime('%Y年%m月%d日')
        week_end = datetime.now().strftime('%Y年%m月%d日')

        urgent_clusters = [c for c in clusters if c.get('urgency_level') == '紧急']
        assigned_clusters = [c for c in clusters if c.get('assigned_department')]
        pending_clusters = [c for c in clusters if c.get('status') == 'pending_review']

        district_stats = defaultdict(lambda: {'count': 0, 'urgent': 0, 'assigned': 0})
        for cluster in clusters:
            district = cluster.get('district', '未知')
            district_stats[district]['count'] += 1
            if cluster.get('urgency_level') == '紧急':
                district_stats[district]['urgent'] += 1
            if cluster.get('assigned_department'):
                district_stats[district]['assigned'] += 1

        report_lines = []
        
        report_lines.append(f"# 社区热线投诉周报 - {report_date}")
        report_lines.append(f"\n> 统计周期：{week_start} 至 {week_end}")
        report_lines.append(f"\n---\n")

        report_lines.append("## 一、总体概览")
        report_lines.append(f"\n| 指标 | 数值 |")
        report_lines.append(f"|------|------|")
        report_lines.append(f"| 事件簇总数 | {len(clusters)} |")
        report_lines.append(f"| 投诉总数 | {statistics.get('total_complaints', 0)} |")
        report_lines.append(f"| 紧急事件簇 | {len(urgent_clusters)} |")
        report_lines.append(f"| 已指派部门 | {len(assigned_clusters)} |")
        report_lines.append(f"| 待复核 | {len(pending_clusters)} |")
        report_lines.append(f"\n")

        report_lines.append("## 二、按街道统计")
        report_lines.append(f"\n| 街道 | 事件簇数 | 紧急事件 | 已指派 |")
        report_lines.append(f"|------|----------|----------|--------|")
        for district, stats in sorted(district_stats.items(), key=lambda x: -x[1]['count']):
            report_lines.append(f"| {district} | {stats['count']} | {stats['urgent']} | {stats['assigned']} |")
        report_lines.append(f"\n")

        report_lines.append("## 三、紧急事件详情")
        if urgent_clusters:
            for i, cluster in enumerate(urgent_clusters, 1):
                report_lines.append(f"\n### {i}. {cluster.get('cluster_id')}")
                report_lines.append(f"\n- **代表摘要**：{cluster.get('representative_summary', '无')}")
                report_lines.append(f"- **投诉数量**：{cluster.get('count', 0)} 条")
                report_lines.append(f"- **所属街道**：{cluster.get('district', '未知')}")
                report_lines.append(f"- **相似原因**：{'、'.join(cluster.get('similar_reasons', []))}")
                report_lines.append(f"- **置信度**：{cluster.get('similarity_score', 0):.2%}")
                report_lines.append(f"- **当前状态**：{self._get_status_display(cluster.get('status'))}")
                if cluster.get('assigned_department'):
                    report_lines.append(f"- **指派部门**：{cluster.get('assigned_department')}")
                if cluster.get('review_notes'):
                    report_lines.append(f"- **复核备注**：{cluster.get('review_notes')}")
        else:
            report_lines.append("\n暂无紧急事件。")
        report_lines.append(f"\n")

        report_lines.append("## 四、待复核事件")
        if pending_clusters:
            pending_clusters_sorted = sorted(
                pending_clusters, 
                key=lambda x: (0 if x.get('urgency_level') == '紧急' else 
                              1 if x.get('urgency_level') == '高' else 2,
                              -x.get('count', 0))
            )
            for i, cluster in enumerate(pending_clusters_sorted[:10], 1):
                report_lines.append(f"\n{i}. **{cluster.get('cluster_id')}**")
                report_lines.append(f"   - 摘要：{cluster.get('representative_summary', '无')[:80]}...")
                report_lines.append(f"   - 投诉数：{cluster.get('count', 0)} | 街道：{cluster.get('district', '未知')}")
                report_lines.append(f"   - 紧急程度：{cluster.get('urgency_level', '普通')}")
        else:
            report_lines.append("\n所有事件已完成复核。")
        report_lines.append(f"\n")

        report_lines.append("## 五、派单建议")
        dept_suggestions = defaultdict(list)
        for cluster in clusters:
            if cluster.get('assigned_department'):
                dept = cluster.get('assigned_department')
                dept_suggestions[dept].append(cluster)
            elif self._suggest_department(cluster):
                dept = self._suggest_department(cluster)
                dept_suggestions[f"[建议] {dept}"].append(cluster)

        if dept_suggestions:
            for dept, dept_clusters in dept_suggestions.items():
                report_lines.append(f"\n### {dept}（共 {len(dept_clusters)} 个事件簇）")
                for cluster in dept_clusters:
                    report_lines.append(f"- {cluster.get('cluster_id')}：{cluster.get('representative_summary', '无')[:60]}...")
        else:
            report_lines.append("\n暂无派单建议。")
        report_lines.append(f"\n")

        report_lines.append("---")
        report_lines.append(f"\n> 报告生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"> 数据来源：重复投诉归并复核台")

        report_content = "\n".join(report_lines)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"weekly_report_{timestamp}.md"
        file_path = os.path.join(self.export_dir, filename)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(report_content)

        return file_path

    def _get_status_display(self, status: str) -> str:
        status_map = {
            'pending_review': '待复核',
            'reviewing': '复核中',
            'confirmed': '已确认',
            'need_split': '需拆分',
            'need_merge': '需合并',
            'assigned': '已指派'
        }
        return status_map.get(status, status)

    def _suggest_department(self, cluster: Dict[str, Any]) -> Optional[str]:
        keywords = cluster.get('keywords', [])
        summary = cluster.get('representative_summary', '').lower()

        keyword_dept_map = {
            '物业': '物业管理部门',
            '停车': '交通管理部门',
            '噪音': '环保部门',
            '环境': '环卫部门',
            '卫生': '环卫部门',
            '垃圾': '环卫部门',
            '绿化': '园林部门',
            '违建': '城管部门',
            '施工': '住建部门',
            '供水': '水务部门',
            '供电': '电力部门',
            '燃气': '燃气公司',
            '电梯': '质监部门',
            '消防': '消防部门',
            '治安': '公安部门',
            '纠纷': '司法所',
            '养老': '民政部门',
            '教育': '教育部门',
            '医疗': '卫健部门'
        }

        for keyword, dept in keyword_dept_map.items():
            if keyword in summary or keyword in [k.lower() for k in keywords]:
                return dept

        return None

    def export_dispatch_suggestions(self, clusters: List[Dict[str, Any]]) -> str:
        rows = []

        header = [
            '事件簇编号',
            '代表摘要',
            '投诉数量',
            '所属街道',
            '紧急程度',
            '相似置信度',
            '相似原因',
            '关键词',
            '当前状态',
            '已指派部门',
            '建议部门',
            '复核备注'
        ]
        rows.append(header)

        for cluster in clusters:
            row = [
                cluster.get('cluster_id', ''),
                cluster.get('representative_summary', ''),
                str(cluster.get('count', 0)),
                cluster.get('district', ''),
                cluster.get('urgency_level', '普通'),
                f"{cluster.get('similarity_score', 0):.2%}",
                '、'.join(cluster.get('similar_reasons', [])),
                '、'.join(cluster.get('keywords', [])),
                self._get_status_display(cluster.get('status')),
                cluster.get('assigned_department') or '',
                self._suggest_department(cluster) or '',
                cluster.get('review_notes') or ''
            ]
            rows.append(row)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"dispatch_suggestions_{timestamp}.csv"
        file_path = os.path.join(self.export_dir, filename)

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)

        return file_path

    def export_clusters_json(self, clusters: List[Dict[str, Any]],
                              statistics: Dict[str, Any]) -> str:
        export_data = {
            'export_time': datetime.now().isoformat(),
            'statistics': statistics,
            'clusters': []
        }

        for cluster in clusters:
            cluster_data = {
                'cluster_id': cluster.get('cluster_id'),
                'count': cluster.get('count'),
                'complaint_ids': cluster.get('complaint_ids'),
                'representative_summary': cluster.get('representative_summary'),
                'keywords': cluster.get('keywords'),
                'similarity_score': cluster.get('similarity_score'),
                'similar_reasons': cluster.get('similar_reasons'),
                'urgency_level': cluster.get('urgency_level'),
                'district': cluster.get('district'),
                'status': cluster.get('status'),
                'assigned_department': cluster.get('assigned_department'),
                'review_notes': cluster.get('review_notes'),
                'work_orders_count': len(cluster.get('work_orders', [])),
                'percentage': cluster.get('percentage')
            }
            export_data['clusters'].append(cluster_data)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"clusters_export_{timestamp}.json"
        file_path = os.path.join(self.export_dir, filename)

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        return file_path

    def export_complaints_detail(self, clusters: List[Dict[str, Any]]) -> str:
        rows = []

        header = [
            '事件簇编号',
            '投诉编号',
            '来电时间',
            '居民姓名',
            '联系电话',
            '所属街道',
            '投诉摘要',
            '紧急程度',
            '事件簇状态',
            '指派部门'
        ]
        rows.append(header)

        for cluster in clusters:
            complaints = cluster.get('complaints', [])
            for complaint in complaints:
                row = [
                    cluster.get('cluster_id', ''),
                    complaint.get('id', ''),
                    self._format_datetime(complaint.get('call_time')),
                    complaint.get('resident_name', ''),
                    complaint.get('phone', ''),
                    complaint.get('district', ''),
                    complaint.get('summary', ''),
                    complaint.get('urgency', '普通'),
                    self._get_status_display(cluster.get('status')),
                    cluster.get('assigned_department') or ''
                ]
                rows.append(row)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"complaints_detail_{timestamp}.csv"
        file_path = os.path.join(self.export_dir, filename)

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)

        return file_path

    def _format_datetime(self, dt) -> str:
        if not dt:
            return ''
        if isinstance(dt, str):
            return dt
        try:
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            return str(dt)
