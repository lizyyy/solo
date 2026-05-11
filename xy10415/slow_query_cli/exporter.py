import json
import csv
from datetime import datetime, timedelta
from typing import Dict, List
from .models import QueryPattern
from .analyzer import QueryAnalyzer
from .config_manager import ConfigManager


class ReportExporter:
    @staticmethod
    def export_trend_report(
        analyzer: QueryAnalyzer,
        config_manager: ConfigManager,
        output_path: str,
        format: str = 'json'
    ) -> None:
        trends = ReportExporter._generate_trend_data(analyzer, config_manager)
        
        if format.lower() == 'json':
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(trends, f, ensure_ascii=False, indent=2, default=str)
        elif format.lower() == 'csv':
            ReportExporter._export_csv(trends, output_path)
        else:
            raise ValueError(f"不支持的导出格式: {format}")

    @staticmethod
    def _generate_trend_data(
        analyzer: QueryAnalyzer,
        config_manager: ConfigManager
    ) -> Dict:
        stats = analyzer.get_statistics()
        owner_reports = []
        
        for owner in config_manager.get_all_owners():
            patterns = analyzer.get_patterns_by_owner(owner)
            if patterns:
                owner_info = config_manager.get_owner_info(owner)
                owner_reports.append({
                    'owner': owner,
                    'service': owner_info.service if owner_info else '未知服务',
                    'pattern_count': len(patterns),
                    'total_queries': sum(p.total_count for p in patterns),
                    'total_execution_time': sum(p.total_execution_time for p in patterns),
                    'avg_execution_time': (
                        sum(p.avg_execution_time for p in patterns) / len(patterns)
                        if patterns
                        else 0
                    ),
                    'max_execution_time': max(p.max_execution_time for p in patterns) if patterns else 0,
                    'patterns': [
                        {
                            'tables': pattern.tables,
                            'database': pattern.database,
                            'total_count': pattern.total_count,
                            'total_execution_time': pattern.total_execution_time,
                            'avg_execution_time': pattern.avg_execution_time,
                            'max_execution_time': pattern.max_execution_time,
                            'first_seen': pattern.first_seen,
                            'last_seen': pattern.last_seen,
                            'is_confirmed': pattern.is_confirmed,
                            'sql_digest': pattern.sql_digest
                        }
                        for pattern in patterns
                    ]
                })

        unassigned_patterns = analyzer.get_unassigned_patterns()
        
        return {
            'generated_at': datetime.now(),
            'statistics': stats,
            'config_conflicts': config_manager.get_conflicts(),
            'unknown_tables': sorted(list(
                analyzer.get_unknown_tables_in_queries() |
                config_manager.get_unknown_tables()
            )),
            'parse_errors': [
                {
                    'time': e.query_time,
                    'error': e.error,
                    'sql': e.raw_sql
                }
                for e in analyzer.get_parse_errors()
            ],
            'duplicate_notes': analyzer.get_duplicate_notes(),
            'owner_reports': owner_reports,
            'unassigned_patterns': [
                {
                    'tables': pattern.tables,
                    'database': pattern.database,
                    'total_count': pattern.total_count,
                    'total_execution_time': pattern.total_execution_time,
                    'avg_execution_time': pattern.avg_execution_time,
                    'max_execution_time': pattern.max_execution_time,
                    'first_seen': pattern.first_seen,
                    'last_seen': pattern.last_seen,
                    'sql_digest': pattern.sql_digest
                }
                for pattern in unassigned_patterns
            ]
        }

    @staticmethod
    def _export_csv(trends: Dict, output_path: str) -> None:
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(['# 统计信息'])
            writer.writerow(['指标', '值'])
            stats = trends['statistics']
            writer.writerow(['总查询数', stats['total_queries']])
            writer.writerow(['唯一模式数', stats['unique_patterns']])
            writer.writerow(['解析错误数', stats['parse_errors']])
            writer.writerow(['总执行时间(秒)', stats['total_execution_time']])
            writer.writerow(['分配负责人的模式', stats['assigned_to_owners']])
            writer.writerow(['未分配模式', stats['unassigned_patterns']])
            writer.writerow([])

            if trends['config_conflicts']:
                writer.writerow(['# 配置冲突'])
                for conflict in trends['config_conflicts']:
                    writer.writerow([conflict])
                writer.writerow([])

            if trends['unknown_tables']:
                writer.writerow(['# 未知表'])
                for table in trends['unknown_tables']:
                    writer.writerow([table])
                writer.writerow([])

            writer.writerow(['# 负责人分派清单'])
            writer.writerow([
                '负责人', '服务', '模式数', '总查询数',
                '总执行时间(秒)', '平均执行时间(秒)', '最大执行时间(秒)'
            ])
            for report in trends['owner_reports']:
                writer.writerow([
                    report['owner'],
                    report['service'],
                    report['pattern_count'],
                    report['total_queries'],
                    report['total_execution_time'],
                    report['avg_execution_time'],
                    report['max_execution_time']
                ])
