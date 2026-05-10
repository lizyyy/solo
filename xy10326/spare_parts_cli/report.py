import csv
import json
from datetime import datetime
from typing import Dict, Any
from .core import SparePartsManager


class ReportExporter:
    def __init__(self, manager: SparePartsManager):
        self.manager = manager

    def generate_report(self, format_type: str = 'json',
                        output_path: str = None) -> str:
        stock_data = self.manager.calculate_available_stock()
        suggestions = self.manager.calculate_restock_suggestions()
        alerts = self.manager.get_alerts()
        history = self.manager.get_history(limit=200)
        approvals = self.manager.get_approvals()
        
        report_data = {
            'report_generated_at': datetime.now().isoformat(),
            'summary': {
                'total_items': len(stock_data),
                'low_stock_count': len(alerts['low_stock']),
                'negative_stock_count': len(alerts['negative_stock']),
                'unreturned_borrows_count': len(alerts['unreturned_borrows']),
                'open_exceptions_count': len(alerts['open_exceptions']),
                'restock_suggestions_count': len(suggestions)
            },
            'inventory_status': stock_data,
            'restock_suggestions': suggestions,
            'alerts': alerts,
            'history': history,
            'approvals': approvals
        }
        
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = f'spare_parts_report_{timestamp}.{format_type}'
        
        if format_type == 'json':
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(report_data, f, ensure_ascii=False, indent=2)
        elif format_type == 'csv':
            self._export_csv(report_data, output_path)
        elif format_type == 'txt':
            self._export_txt(report_data, output_path)
        
        return output_path

    def _export_csv(self, data: Dict[str, Any], output_path: str):
        base_name = output_path.rsplit('.', 1)[0]
        
        with open(f'{base_name}_inventory.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if data['inventory_status']:
                headers = list(data['inventory_status'][0].keys())
                writer.writerow(headers)
                for item in data['inventory_status']:
                    writer.writerow([item.get(k, '') for k in headers])
        
        with open(f'{base_name}_suggestions.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if data['restock_suggestions']:
                headers = list(data['restock_suggestions'][0].keys())
                writer.writerow(headers)
                for item in data['restock_suggestions']:
                    writer.writerow([item.get(k, '') for k in headers])
        
        with open(f'{base_name}_alerts.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['alert_type', 'details'])
            for alert_type, items in data['alerts'].items():
                for item in items:
                    writer.writerow([alert_type, json.dumps(item, ensure_ascii=False)])
        
        with open(f'{base_name}_approvals.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if data['approvals']:
                headers = list(data['approvals'][0].keys())
                writer.writerow(headers)
                for item in data['approvals']:
                    writer.writerow([item.get(k, '') for k in headers])

    def _export_txt(self, data: Dict[str, Any], output_path: str):
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('=' * 80 + '\n')
            f.write('维修备件安全库存报告\n')
            f.write(f'生成时间: {data["report_generated_at"]}\n')
            f.write('=' * 80 + '\n\n')
            
            f.write('一、库存概览\n')
            f.write('-' * 80 + '\n')
            summary = data['summary']
            f.write(f'总备件数: {summary["total_items"]}\n')
            f.write(f'低库存数量: {summary["low_stock_count"]}\n')
            f.write(f'负库存数量: {summary["negative_stock_count"]}\n')
            f.write(f'未归还借调: {summary["unreturned_borrows_count"]}\n')
            f.write(f'未解决异常: {summary["open_exceptions_count"]}\n')
            f.write(f'补货建议数: {summary["restock_suggestions_count"]}\n\n')
            
            f.write('二、库存状态详情\n')
            f.write('-' * 80 + '\n')
            for item in data['inventory_status']:
                f.write(f'\n备件编号: {item["part_number"]} - {item["name"]}\n')
                f.write(f'  当前库存: {item["current_stock"]} {item.get("unit", "")}\n')
                f.write(f'  安全库存: {item["safety_stock"]} {item.get("unit", "")}\n')
                f.write(f'  最低库存: {item["min_stock"]} {item.get("unit", "")}\n')
                f.write(f'  在途数量: {item["in_transit"]} {item.get("unit", "")}\n')
                f.write(f'  借出数量: {item["borrowed_out"]} {item.get("unit", "")}\n')
                f.write(f'  可用库存(含在途): {item["available_including_transit"]} {item.get("unit", "")}\n')
            
            f.write('\n三、补货建议\n')
            f.write('-' * 80 + '\n')
            if data['restock_suggestions']:
                for sugg in data['restock_suggestions']:
                    f.write(f'\n{sugg["part_number"]} - {sugg["name"]}\n')
                    f.write(f'  建议补货数量: {sugg["suggested_quantity"]}\n')
                    f.write(f'  原因: {sugg["reason"]}\n')
            else:
                f.write('暂无补货建议\n')
            
            f.write('\n四、预警列表\n')
            f.write('-' * 80 + '\n')
            
            f.write('\n【低库存预警】\n')
            if data['alerts']['low_stock']:
                for alert in data['alerts']['low_stock']:
                    f.write(f'  {alert["part_number"]} - {alert["name"]}: '
                           f'当前{alert["current_stock"]}, 安全库存{alert["safety_stock"]}, '
                           f'缺口{alert["gap"]}\n')
            else:
                f.write('  无\n')
            
            f.write('\n【负库存预警】\n')
            if data['alerts']['negative_stock']:
                for alert in data['alerts']['negative_stock']:
                    f.write(f'  {alert["part_number"]} - {alert["name"]}: '
                           f'当前{alert["current_stock"]}\n')
            else:
                f.write('  无\n')
            
            f.write('\n【未归还借调】\n')
            if data['alerts']['unreturned_borrows']:
                for borrow in data['alerts']['unreturned_borrows']:
                    f.write(f'  {borrow["borrow_number"]}: {borrow["part_number"]}, '
                           f'借出{borrow["borrowed_quantity"] - borrow["returned_quantity"]}, '
                           f'应还日期{borrow["expected_return"]}\n')
            else:
                f.write('  无\n')
            
            f.write('\n【未知备件异常】\n')
            if data['alerts']['unknown_parts']:
                for exc in data['alerts']['unknown_parts']:
                    f.write(f'  {exc["part_number"]}: {exc["message"]}\n')
            else:
                f.write('  无\n')
            
            f.write('\n【数量不一致异常】\n')
            if data['alerts']['quantity_mismatch']:
                for exc in data['alerts']['quantity_mismatch']:
                    f.write(f'  {exc["reference_id"]}: {exc["message"]}\n')
            else:
                f.write('  无\n')
            
            f.write('\n五、审批记录\n')
            f.write('-' * 80 + '\n')
            if data['approvals']:
                for app in data['approvals']:
                    f.write(f'\n[{app["timestamp"]}] {app["action"]} - {app["decision"]}\n')
                    f.write(f'  参考ID: {app["reference_type"]}/{app["reference_id"]}\n')
                    if app['reasons']:
                        f.write(f'  意见: {app["reasons"]}\n')
                    if app['operator']:
                        f.write(f'  操作人: {app["operator"]}\n')
            else:
                f.write('暂无审批记录\n')
            
            f.write('\n六、历史变动记录\n')
            f.write('-' * 80 + '\n')
            if data['history']:
                for h in data['history']:
                    f.write(f'[{h["timestamp"]}] {h["part_number"]}: '
                           f'{h["change_type"]} {h["quantity"]:+} '
                           f'({h["previous_stock"]} -> {h["new_stock"]})\n')
                    if h['remarks']:
                        f.write(f'  {h["remarks"]}\n')
            else:
                f.write('暂无历史记录\n')
