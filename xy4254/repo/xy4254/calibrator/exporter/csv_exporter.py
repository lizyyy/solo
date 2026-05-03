"""
CSV导出器 - 导出分析结果为CSV格式
"""

import csv
from datetime import datetime
from typing import Dict, List, Any, Optional
import os


class CSVExporter:
    """
    CSV格式导出器
    
    导出风险评估结果、行动计划等为CSV格式，便于在Excel中查看和处理
    """
    
    def __init__(self):
        self.generated_at = datetime.now()
    
    def export_risk_summary(self, output_path: str,
                             risk_results: Dict,
                             action_plans: Dict) -> str:
        """
        导出风险汇总CSV
        
        Args:
            output_path: 输出文件路径
            risk_results: 风险评估结果
            action_plans: 行动计划
            
        Returns:
            输出文件路径
        """
        rows = []
        
        headers = [
            '苗盘ID',
            '总体风险',
            '综合评分',
            '光照状态',
            '当前DLI',
            '水分状态',
            '当前湿度(%)',
            '湿度趋势',
            '今日蒸散(mm)',
            '优先级',
            '是否需要补光',
            '是否需要浇水',
            '警告信息'
        ]
        
        for tray_id, result in risk_results.items():
            plan = action_plans.get(tray_id)
            
            overall_risk = result.overall_risk if hasattr(result, 'overall_risk') else 'normal'
            overall_score = result.overall_score if hasattr(result, 'overall_score') else 5
            
            light_risk = result.light_risk if hasattr(result, 'light_risk') else {}
            light_details = light_risk.get('details', {})
            light_status = light_risk.get('status', '正常')
            current_dli = light_details.get('latest_dli', '')
            
            moisture_risk = result.moisture_risk if hasattr(result, 'moisture_risk') else {}
            moisture_details = moisture_risk.get('details', {})
            moisture_status = moisture_risk.get('status', '正常')
            current_moisture = moisture_details.get('current_moisture', '')
            moisture_trend = moisture_details.get('trend', '稳定')
            et0 = moisture_details.get('et0', '')
            
            priority = plan.priority if hasattr(plan, 'priority') else 'P3 - 正常'
            
            needs_light = False
            needs_water = False
            if plan:
                if hasattr(plan, 'light_actions'):
                    for action in plan.light_actions:
                        if action.get('type') == 'supplemental_light':
                            needs_light = True
                            break
                if hasattr(plan, 'irrigation_actions'):
                    for action in plan.irrigation_actions:
                        if action.get('type') == 'irrigation':
                            needs_water = True
                            break
            
            warnings = result.warnings if hasattr(result, 'warnings') else []
            warnings_str = '; '.join(warnings) if warnings else ''
            
            rows.append({
                '苗盘ID': tray_id,
                '总体风险': self._risk_display(overall_risk),
                '综合评分': overall_score,
                '光照状态': light_status,
                '当前DLI': current_dli,
                '水分状态': moisture_status,
                '当前湿度(%)': current_moisture,
                '湿度趋势': moisture_trend,
                '今日蒸散(mm)': et0,
                '优先级': priority,
                '是否需要补光': '是' if needs_light else '否',
                '是否需要浇水': '是' if needs_water else '否',
                '警告信息': warnings_str
            })
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        
        return output_path
    
    def export_action_plan(self, output_path: str,
                           consolidated_actions: Dict) -> str:
        """
        导出行动计划CSV
        
        Args:
            output_path: 输出文件路径
            consolidated_actions: 整合的操作汇总
            
        Returns:
            输出文件路径
        """
        rows = []
        
        headers = [
            '优先级',
            '操作类型',
            '苗盘ID',
            '操作内容',
            '详细说明',
            '紧急程度',
            '预计成本(元)'
        ]
        
        urgent_actions = consolidated_actions.get('urgent_actions', [])
        for action in urgent_actions:
            tray_id = action.get('tray_id', '未知')
            action_detail = action.get('action', {})
            action_type = action_detail.get('type', 'unknown')
            urgency = action_detail.get('urgency', '')
            
            details = action_detail.get('details', {})
            detail_str = self._format_details(details)
            
            rows.append({
                '优先级': '紧急',
                '操作类型': self._action_type_display(action_type),
                '苗盘ID': tray_id,
                '操作内容': action_detail.get('action', ''),
                '详细说明': detail_str,
                '紧急程度': urgency,
                '预计成本(元)': ''
            })
        
        light_actions = consolidated_actions.get('light_actions', [])
        for action in light_actions:
            tray_id = action.get('tray_id', '未知')
            action_detail = action.get('action', {})
            action_type = action_detail.get('type', 'unknown')
            urgency = action_detail.get('urgency', '')
            
            details = action_detail.get('details', {})
            detail_str = self._format_details(details)
            cost = details.get('estimated_cost_yuan', '')
            
            rows.append({
                '优先级': '高' if urgency == '立即执行' else '中',
                '操作类型': '补光',
                '苗盘ID': tray_id,
                '操作内容': action_detail.get('action', ''),
                '详细说明': detail_str,
                '紧急程度': urgency,
                '预计成本(元)': cost
            })
        
        irrigation_actions = consolidated_actions.get('irrigation_actions', [])
        for action in irrigation_actions:
            tray_id = action.get('tray_id', '未知')
            action_detail = action.get('action', {})
            action_type = action_detail.get('type', 'unknown')
            urgency = action_detail.get('urgency', '')
            
            details = action_detail.get('details', {})
            detail_str = self._format_details(details)
            
            rows.append({
                '优先级': '高' if urgency == '立即执行' else '中',
                '操作类型': '灌溉' if action_type == 'irrigation' else '减少浇水',
                '苗盘ID': tray_id,
                '操作内容': action_detail.get('action', ''),
                '详细说明': detail_str,
                '紧急程度': urgency,
                '预计成本(元)': '0.5' if action_type == 'irrigation' else ''
            })
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        
        return output_path
    
    def export_daily_metrics(self, output_path: str,
                              sensor_data: Dict,
                              analysis_results: Dict) -> str:
        """
        导出每日指标CSV
        
        Args:
            output_path: 输出文件路径
            sensor_data: 传感器数据摘要
            analysis_results: 分析结果
            
        Returns:
            输出文件路径
        """
        rows = []
        
        headers = [
            '日期',
            '苗盘ID',
            '平均光照(μmol/m²/s)',
            'DLI(mol/m²/day)',
            '平均湿度(%)',
            '湿度变化(%)',
            '平均温度(℃)',
            '平均湿度(%)',
            'ET0(mm/day)',
            '风险等级'
        ]
        
        daily_stats = analysis_results.get('daily_stats', {})
        
        for date, trays_data in daily_stats.items():
            for tray_id, metrics in trays_data.items():
                rows.append({
                    '日期': date,
                    '苗盘ID': tray_id,
                    '平均光照(μmol/m²/s)': metrics.get('avg_light', ''),
                    'DLI(mol/m²/day)': metrics.get('dli', ''),
                    '平均湿度(%)': metrics.get('avg_moisture', ''),
                    '湿度变化(%)': metrics.get('moisture_change', ''),
                    '平均温度(℃)': metrics.get('avg_temp', ''),
                    '平均湿度(%)': metrics.get('avg_humidity', ''),
                    'ET0(mm/day)': metrics.get('et0', ''),
                    '风险等级': metrics.get('risk_level', '')
                })
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        
        return output_path
    
    def _risk_display(self, risk_level: str) -> str:
        """返回风险等级的中文显示"""
        displays = {
            'critical': '严重风险',
            'high': '高风险',
            'medium': '中等风险',
            'normal': '正常',
            'low': '正常'
        }
        return displays.get(risk_level, '未知')
    
    def _action_type_display(self, action_type: str) -> str:
        """返回操作类型的中文显示"""
        displays = {
            'supplemental_light': '补光',
            'shade': '遮阴',
            'irrigation': '浇水',
            'reduce_irrigation': '减少浇水',
            'enhanced_monitoring': '加强监测',
            'regular_monitoring': '常规监测',
            'light_forecast_alert': '光照预报提醒',
            'moisture_trend_alert': '水分趋势提醒',
            'rain_alert': '降雨提醒',
            'variation_alert': '变化提醒',
            'irrigation_frequency': '调整灌溉频率'
        }
        return displays.get(action_type, action_type)
    
    def _format_details(self, details: Dict) -> str:
        """格式化详细信息为字符串"""
        if not details:
            return ''
        
        parts = []
        
        if 'current_dli' in details:
            parts.append(f"当前DLI: {details['current_dli']} mol/m²/day")
        if 'target_dli' in details:
            parts.append(f"目标DLI: {details['target_dli']}")
        if 'recommended_hours' in details:
            parts.append(f"建议补光: {details['recommended_hours']} 小时")
        if 'estimated_energy_kwh' in details:
            parts.append(f"预计能耗: {details['estimated_energy_kwh']} kWh")
        
        if 'current_moisture' in details:
            parts.append(f"当前湿度: {details['current_moisture']}%")
        if 'target_moisture' in details:
            parts.append(f"目标湿度: {details['target_moisture']}%")
        if 'recommended_amount_liters' in details:
            parts.append(f"建议水量: {details['recommended_amount_liters']} 升")
        if 'daily_et0_mm' in details:
            parts.append(f"今日蒸散: {details['daily_et0_mm']} mm")
        
        if 'suggested_time' in details:
            parts.append(f"建议时间: {details['suggested_time']}")
        if 'method' in details:
            parts.append(f"方法: {details['method']}")
        if 'best_time' in details:
            parts.append(f"最佳时间: {details['best_time']}")
        
        if 'action_items' in details:
            for item in details['action_items']:
                parts.append(f"- {item}")
        
        return '; '.join(parts)
