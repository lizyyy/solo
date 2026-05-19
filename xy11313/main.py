#!/usr/bin/env python3
import os
import sys
from datetime import datetime
from models import init_db
from services import DataImporter, AnomalyDetector, IncidentReviewer, IncidentQuery, ReportExporter

class BusDispatchSystem:
    def __init__(self, db_path='bus_scheduling.db'):
        self.db_path = db_path
        self.session = init_db(db_path)
        self.importer = DataImporter(self.session)
        self.detector = AnomalyDetector(self.session)
        self.reviewer = IncidentReviewer(self.session)
        self.query = IncidentQuery(self.session)
        self.exporter = ReportExporter(self.session)
    
    def import_schedule(self, csv_file):
        print(f"\n=== 导入站点时刻表: {csv_file} ===")
        result = self.importer.import_schedule_csv(csv_file)
        if result['success']:
            print(f"成功导入: {result['valid']} 条记录")
            print(f"失败记录: {result['invalid']} 条")
            if result['invalid'] > 0:
                print("\n错误记录详情:")
                bad_records = self.importer.get_bad_records(result['import_file_id'])
                for br in bad_records:
                    print(f"  行 {br.line_number}: {br.failure_reason}")
                    print(f"    建议: {br.correction_suggestion}")
        else:
            print(f"导入失败: {result.get('error', '未知错误')}")
        return result
    
    def import_gps(self, json_file):
        print(f"\n=== 导入GPS数据: {json_file} ===")
        result = self.importer.import_gps_json(json_file)
        if result['success']:
            print(f"成功导入: {result['valid']} 条记录")
            print(f"失败记录: {result['invalid']} 条")
        else:
            print(f"导入失败: {result.get('error', '未知错误')}")
        return result
    
    def import_appeals(self, file_path):
        print(f"\n=== 导入申诉单: {file_path} ===")
        result = self.importer.import_appeal_form(file_path)
        if result['success']:
            print(f"成功导入: {result['valid']} 条记录")
            print(f"失败记录: {result['invalid']} 条")
        else:
            print(f"导入失败: {result.get('error', '未知错误')}")
        return result
    
    def detect_anomalies(self, date_str=None):
        print("\n=== 检测异常事件 ===")
        if date_str:
            date = datetime.strptime(date_str, '%Y-%m-%d')
        else:
            date = datetime(2024, 5, 20)
        
        incidents = self.detector.detect_anomalies(date)
        print(f"发现 {len(incidents)} 个异常事件")
        for inc in incidents:
            if inc.get('created'):
                print(f"  - {inc['incident_number']}: {inc['anomaly_type']} - {inc.get('description', '')}")
        return incidents
    
    def review_incident(self, incident_id, reviewer, responsibility, notes):
        print(f"\n=== 复核事件: {incident_id} ===")
        result = self.reviewer.manual_review(incident_id, reviewer, responsibility, notes)
        if result['success']:
            print(f"事件 {incident_id} 复核完成")
            print(f"责任判定: {responsibility}")
            print(f"复核意见: {notes}")
        else:
            print(f"复核失败: {result.get('error', '未知错误')}")
        return result
    
    def query_incidents(self, filters=None):
        print("\n=== 查询异常事件 ===")
        if filters:
            print("筛选条件:")
            for k, v in filters.items():
                if v:
                    print(f"  {k}: {v}")
        
        result = self.query.query_incidents(**(filters or {}), page=1, page_size=100)
        print(f"\n共找到 {result['total_count']} 条记录")
        
        if result['data']:
            print(f"\n{'事件编号':<20} {'日期':<20} {'异常类型':<15} {'责任方':<15} {'状态':<10}")
            print("-" * 80)
            for inc in result['data']:
                print(f"{inc['incident_number']:<20} {inc['incident_date']:<20} {inc['anomaly_type_name']:<15} {inc['responsibility_name']:<15} {inc['status']:<10}")
        
        return result
    
    def export_report(self, output_file, filters=None):
        print(f"\n=== 导出报告: {output_file} ===")
        if output_file.endswith('.xlsx'):
            result = self.exporter.export_incidents_to_excel(output_file, **(filters or {}))
        else:
            result = self.exporter.export_incidents_to_csv(output_file, **(filters or {}))
        
        if result['success']:
            print(f"报告已导出: {result['output_file']}")
            print(f"共 {result['total_records']} 条记录")
        else:
            print(f"导出失败: {result.get('error', '未知错误')}")
        return result
    
    def show_statistics(self):
        print("\n=== 统计概览 ===")
        stats = self.query.get_statistics()
        print(f"总事件数: {stats['total_incidents']}")
        print(f"\n按异常类型:")
        for k, v in stats['by_anomaly_type'].items():
            print(f"  {k}: {v}")
        print(f"\n按责任方:")
        for k, v in stats['by_responsibility'].items():
            print(f"  {k}: {v}")
        print(f"\n按状态:")
        for k, v in stats['by_status'].items():
            print(f"  {k}: {v}")
        return stats

def main():
    print("=" * 60)
    print("校车调度异常事件管理系统")
    print("=" * 60)
    
    system = BusDispatchSystem()
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_dir = os.path.join(base_dir, 'sample_data')
    
    system.import_schedule(os.path.join(sample_dir, 'schedule_normal.csv'))
    system.import_schedule(os.path.join(sample_dir, 'schedule_with_errors.csv'))
    system.import_gps(os.path.join(sample_dir, 'gps_data.json'))
    system.import_appeals(os.path.join(sample_dir, 'appeals.json'))
    
    system.detect_anomalies('2024-05-20')
    
    result = system.query.query_incidents(page=1, page_size=10)
    if result['data']:
        inc_id = result['data'][0]['id']
        system.review_incident(inc_id, '调度员张三', 'traffic', '交通拥堵导致晚点')
    
    system.query_incidents()
    system.show_statistics()
    
    report_file = os.path.join(base_dir, 'incident_report.xlsx')
    system.export_report(report_file)
    
    print("\n" + "=" * 60)
    print("处理完成！")
    print(f"数据库文件: {system.db_path}")
    print(f"报告文件: {report_file}")
    print("=" * 60)

if __name__ == '__main__':
    main()
