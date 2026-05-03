import csv
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import sqlite3

from backend.config import Config, DATA_DIR
from backend.database import get_db, rows_to_dict_list


class IssueExporter:
    @staticmethod
    def export_issues_csv(flight_numbers: Optional[List[str]] = None) -> str:
        output_path = os.path.join(DATA_DIR, f'issues_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            if flight_numbers and len(flight_numbers) > 0:
                placeholders = ','.join(['?'] * len(flight_numbers))
                cursor.execute(f'''
                    SELECT id, flight_number, issue_type, issue_code, severity,
                           description, related_order_id, related_scan_id,
                           related_confirm_id, is_resolved, resolution_note,
                           resolved_by, resolved_at, created_at
                    FROM issues 
                    WHERE flight_number IN ({placeholders})
                    ORDER BY created_at DESC
                ''', flight_numbers)
            else:
                cursor.execute('''
                    SELECT id, flight_number, issue_type, issue_code, severity,
                           description, related_order_id, related_scan_id,
                           related_confirm_id, is_resolved, resolution_note,
                           resolved_by, resolved_at, created_at
                    FROM issues 
                    ORDER BY created_at DESC
                ''')
            
            issues = cursor.fetchall()
            
            fieldnames = [
                'Issue ID', '航班号', '问题类型', '问题代码', '严重程度',
                '描述', '关联订单ID', '关联扫码ID', '关联装载ID',
                '是否已解决', '解决备注', '解决人', '解决时间', '创建时间'
            ]
            
            with open(output_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(fieldnames)
                
                for issue in issues:
                    writer.writerow([
                        issue['id'],
                        issue['flight_number'],
                        issue['issue_type'],
                        issue['issue_code'] or '',
                        issue['severity'],
                        issue['description'],
                        issue['related_order_id'] or '',
                        issue['related_scan_id'] or '',
                        issue['related_confirm_id'] or '',
                        '是' if issue['is_resolved'] else '否',
                        issue['resolution_note'] or '',
                        issue['resolved_by'] or '',
                        issue['resolved_at'] or '',
                        issue['created_at']
                    ])
        
        return output_path


class ManifestReporter:
    @staticmethod
    def generate_flight_report(flight_number: str) -> str:
        report_lines = []
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM flights WHERE flight_number = ?', (flight_number,))
            flight = cursor.fetchone()
            
            if not flight:
                return f"# 错误\n\n未找到航班 {flight_number}"
            
            flight_id = flight['id']
            
            report_lines.append(f"# 航空配餐舱单复核报告")
            report_lines.append(f"")
            report_lines.append(f"**航班号**: {flight['flight_number']}")
            report_lines.append(f"**机型**: {flight['aircraft_type'] or '未知'}")
            report_lines.append(f"**注册号**: {flight['aircraft_registration'] or '未知'}")
            report_lines.append(f"**航线**: {flight['departure_airport'] or 'N/A'} → {flight['arrival_airport'] or 'N/A'}")
            report_lines.append(f"**计划起飞**: {flight['scheduled_departure_time'] or 'N/A'}")
            report_lines.append(f"**报告生成时间**: {datetime.now().isoformat()}")
            report_lines.append(f"")
            report_lines.append(f"---")
            report_lines.append(f"")
            
            cursor.execute('''
                SELECT cabin_class, seats_count, meal_capacity, is_original
                FROM cabin_configs 
                WHERE flight_id = ?
                ORDER BY is_original DESC, cabin_class
            ''', (flight_id,))
            cabin_configs = cursor.fetchall()
            
            if cabin_configs:
                report_lines.append(f"## 1. 舱位配置信息")
                report_lines.append(f"")
                
                original_configs = [c for c in cabin_configs if c['is_original'] == 1]
                new_configs = [c for c in cabin_configs if c['is_original'] == 0]
                
                if new_configs:
                    report_lines.append(f"⚠️ **检测到机型变更**")
                    report_lines.append(f"")
                    report_lines.append(f"### 原机型配置")
                    report_lines.append(f"")
                    report_lines.append(f"| 舱位等级 | 座位数 | 配餐容量 |")
                    report_lines.append(f"|----------|--------|----------|")
                    for cfg in original_configs:
                        report_lines.append(f"| {cfg['cabin_class']} | {cfg['seats_count']} | {cfg['meal_capacity'] or cfg['seats_count']} |")
                    
                    report_lines.append(f"")
                    report_lines.append(f"### 新机型配置")
                    report_lines.append(f"")
                    report_lines.append(f"| 舱位等级 | 座位数 | 配餐容量 |")
                    report_lines.append(f"|----------|--------|----------|")
                    for cfg in new_configs:
                        report_lines.append(f"| {cfg['cabin_class']} | {cfg['seats_count']} | {cfg['meal_capacity'] or cfg['seats_count']} |")
                else:
                    report_lines.append(f"| 舱位等级 | 座位数 | 配餐容量 |")
                    report_lines.append(f"|----------|--------|----------|")
                    for cfg in cabin_configs:
                        report_lines.append(f"| {cfg['cabin_class']} | {cfg['seats_count']} | {cfg['meal_capacity'] or cfg['seats_count']} |")
                
                report_lines.append(f"")
            
            cursor.execute('''
                SELECT cabin_class, meal_category, is_special,
                       COUNT(*) as order_count, SUM(quantity) as total_meals
                FROM meal_orders 
                WHERE flight_number = ?
                GROUP BY cabin_class, meal_category, is_special
                ORDER BY cabin_class, meal_category
            ''', (flight_number,))
            orders_summary = cursor.fetchall()
            
            report_lines.append(f"## 2. 餐食订单汇总")
            report_lines.append(f"")
            report_lines.append(f"| 舱位等级 | 餐食类别 | 特殊餐 | 订单数 | 总份数 |")
            report_lines.append(f"|----------|----------|--------|--------|--------|")
            
            for row in orders_summary:
                is_special = "是" if row['is_special'] else "否"
                report_lines.append(f"| {row['cabin_class']} | {row['meal_category']} | {is_special} | {row['order_count']} | {row['total_meals']} |")
            
            report_lines.append(f"")
            
            cursor.execute('''
                SELECT special_meal_code, special_meal_description,
                       COUNT(*) as count, GROUP_CONCAT(seat_number) as seats
                FROM meal_orders 
                WHERE flight_number = ? AND is_special = 1
                GROUP BY special_meal_code, special_meal_description
            ''', (flight_number,))
            special_meals = cursor.fetchall()
            
            if special_meals:
                report_lines.append(f"### 2.1 特殊餐详情")
                report_lines.append(f"")
                report_lines.append(f"| 特殊餐代码 | 描述 | 数量 | 座位号 |")
                report_lines.append(f"|------------|------|------|--------|")
                for row in special_meals:
                    report_lines.append(f"| {row['special_meal_code'] or 'N/A'} | {row['special_meal_description'] or 'N/A'} | {row['count']} | {row['seats']} |")
                report_lines.append(f"")
            
            cursor.execute('''
                SELECT match_status, COUNT(*) as count
                FROM meal_matches 
                WHERE flight_id = ?
                GROUP BY match_status
            ''', (flight_id,))
            match_summary = cursor.fetchall()
            
            report_lines.append(f"## 3. 餐食匹配状态")
            report_lines.append(f"")
            report_lines.append(f"| 匹配状态 | 数量 |")
            report_lines.append(f"|----------|------|")
            
            for row in match_summary:
                report_lines.append(f"| {row['match_status']} | {row['count']} |")
            
            report_lines.append(f"")
            
            cursor.execute('''
                SELECT window_check, COUNT(*) as count
                FROM meal_matches 
                WHERE flight_id = ?
                GROUP BY window_check
            ''', (flight_id,))
            window_summary = cursor.fetchall()
            
            has_risk = any(w['window_check'] in ['risk_hot', 'risk_cold', 'expired'] for w in window_summary)
            
            if has_risk:
                report_lines.append(f"## 4. ⚠️ 保温窗口风险预警")
                report_lines.append(f"")
                report_lines.append(f"| 风险状态 | 数量 |")
                report_lines.append(f"|----------|------|")
                
                for row in window_summary:
                    if row['window_check'] != 'ok' and row['window_check'] != 'unknown':
                        report_lines.append(f"| {row['window_check']} | {row['count']} |")
                
                report_lines.append(f"")
            
            cursor.execute('''
                SELECT * FROM issues 
                WHERE flight_number = ? AND is_resolved = 0
                ORDER BY 
                    CASE severity 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        ELSE 4 
                    END,
                    created_at DESC
            ''', (flight_number,))
            issues = cursor.fetchall()
            
            if issues:
                report_lines.append(f"## 5. ⚠️ 待解决问题")
                report_lines.append(f"")
                
                for i, issue in enumerate(issues, 1):
                    severity_label = {
                        'critical': '🔴 严重',
                        'high': '🟠 高',
                        'medium': '🟡 中',
                        'low': '🟢 低'
                    }.get(issue['severity'], issue['severity'])
                    
                    report_lines.append(f"### 5.{i} {severity_label} - {issue['issue_type']}")
                    report_lines.append(f"")
                    report_lines.append(f"**描述**: {issue['description']}")
                    if issue['related_order_id']:
                        report_lines.append(f"**关联订单**: {issue['related_order_id']}")
                    if issue['related_scan_id']:
                        report_lines.append(f"**关联扫码**: {issue['related_scan_id']}")
                    if issue['related_confirm_id']:
                        report_lines.append(f"**关联装载**: {issue['related_confirm_id']}")
                    report_lines.append(f"")
            
            cursor.execute('''
                SELECT * FROM notes 
                WHERE flight_number = ?
                ORDER BY created_at DESC
            ''', (flight_number,))
            notes = cursor.fetchall()
            
            if notes:
                report_lines.append(f"## 6. 人工备注")
                report_lines.append(f"")
                
                for i, note in enumerate(notes, 1):
                    report_lines.append(f"### 6.{i} {note['note_type']} - {note['created_by']}")
                    report_lines.append(f"")
                    report_lines.append(f"**时间**: {note['created_at']}")
                    report_lines.append(f"**内容**: {note['content']}")
                    if note['related_entity_type']:
                        report_lines.append(f"**关联**: {note['related_entity_type']} - {note['related_entity_id'] or 'N/A'}")
                    report_lines.append(f"")
            
            report_lines.append(f"---")
            report_lines.append(f"")
            report_lines.append(f"*报告由航空配餐调度复核工具生成*")
        
        return '\n'.join(report_lines)
    
    @staticmethod
    def export_manifest_report(flight_number: str) -> str:
        report_content = ManifestReporter.generate_flight_report(flight_number)
        output_path = os.path.join(DATA_DIR, f'manifest_{flight_number}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md')
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return output_path
