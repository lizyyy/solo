import os
import csv
import json
from datetime import datetime
from typing import Dict, Any


class ReportGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
    
    def generate(self, result: Dict[str, Any], inspection_date) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        date_str = inspection_date.strftime("%Y%m%d")
        
        report_files = {}
        
        report_files['summary_txt'] = self._generate_summary_txt(result, date_str, timestamp)
        report_files['detail_csv'] = self._generate_detail_csv(result, date_str, timestamp)
        report_files['special_csv'] = self._generate_special_csv(result, date_str, timestamp)
        report_files['json'] = self._generate_json(result, date_str, timestamp)
        
        return report_files
    
    def _generate_summary_txt(self, result: Dict[str, Any], date_str: str, timestamp: str) -> str:
        filename = f"gateway_whitelist_inspection_summary_{date_str}_{timestamp}.txt"
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("          网关配置快照白名单过期巡检 - 汇总报告\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"巡检日期: {result['inspection_date']}\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("-" * 80 + "\n")
            f.write("统计摘要:\n")
            f.write("-" * 80 + "\n")
            f.write(f"  总配置文件数:      {result['total_files']}\n")
            f.write(f"  总白名单规则数:    {result['total_whitelists']}\n")
            f.write(f"  过期仍生效的白名单: {result['expired_active_count']}\n")
            f.write(f"    - 缓存配置相关:   {result['cache_config_count']}\n")
            f.write(f"    - 租户改名相关:   {result['tenant_rename_count']}\n")
            f.write(f"    - 接口组合相关:   {result['api_combination_count']}\n")
            f.write(f"    - 普通过期项:     {result['expired_active_count'] - result['cache_config_count'] - result['tenant_rename_count'] - result['api_combination_count']}\n\n")
            
            f.write("-" * 80 + "\n")
            f.write("重点关注项详情:\n")
            f.write("-" * 80 + "\n\n")
            
            if result['cache_config_items']:
                f.write("【缓存配置相关 - 需要特别关注】\n")
                f.write("-" * 50 + "\n")
                for item in result['cache_config_items']:
                    f.write(f"  规则ID: {item['id']}\n")
                    f.write(f"  规则名称: {item['name']}\n")
                    f.write(f"  租户: {item['tenant']}\n")
                    f.write(f"  接口: {item['api']}\n")
                    f.write(f"  过期日期: {item['expire_date']}\n")
                    f.write(f"  来源文件: {item['_source_file']}\n")
                    f.write(f"  描述: {item['description']}\n\n")
            
            if result['tenant_rename_items']:
                f.write("【租户改名相关 - 需要特别关注】\n")
                f.write("-" * 50 + "\n")
                for item in result['tenant_rename_items']:
                    f.write(f"  规则ID: {item['id']}\n")
                    f.write(f"  规则名称: {item['name']}\n")
                    f.write(f"  租户: {item['tenant']}\n")
                    f.write(f"  接口: {item['api']}\n")
                    f.write(f"  过期日期: {item['expire_date']}\n")
                    f.write(f"  来源文件: {item['_source_file']}\n")
                    f.write(f"  描述: {item['description']}\n\n")
            
            if result['api_combination_items']:
                f.write("【接口组合相关 - 需要特别关注】\n")
                f.write("-" * 50 + "\n")
                for item in result['api_combination_items']:
                    f.write(f"  规则ID: {item['id']}\n")
                    f.write(f"  规则名称: {item['name']}\n")
                    f.write(f"  租户: {item['tenant']}\n")
                    f.write(f"  接口: {item['api']}\n")
                    f.write(f"  过期日期: {item['expire_date']}\n")
                    f.write(f"  来源文件: {item['_source_file']}\n")
                    f.write(f"  描述: {item['description']}\n\n")
            
            normal_items = [x for x in result['expired_whitelists'] 
                          if x not in result['cache_config_items'] and 
                             x not in result['tenant_rename_items'] and 
                             x not in result['api_combination_items']]
            if normal_items:
                f.write("【普通过期项】\n")
                f.write("-" * 50 + "\n")
                for item in normal_items[:5]:
                    f.write(f"  {item['id']} - {item['name']} - {item['tenant']} - {item['api']} (过期: {item['expire_date']})\n")
                if len(normal_items) > 5:
                    f.write(f"  ... 还有 {len(normal_items) - 5} 项\n")
                f.write("\n")
            
            f.write("=" * 80 + "\n")
            f.write("报告结束\n")
            f.write("=" * 80 + "\n")
        
        return filepath
    
    def _generate_detail_csv(self, result: Dict[str, Any], date_str: str, timestamp: str) -> str:
        filename = f"gateway_whitelist_inspection_detail_{date_str}_{timestamp}.csv"
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '巡检编号', '规则ID', '规则名称', '租户', '接口', '状态',
                '过期日期', '是否过期仍生效', '分类', '来源文件', '描述', '标签'
            ])
            
            for idx, item in enumerate(result['all_whitelists'], 1):
                is_expired = item in result['expired_whitelists']
                
                item_type = 'normal'
                if item in result['cache_config_items']:
                    item_type = 'cache_config'
                elif item in result['tenant_rename_items']:
                    item_type = 'tenant_rename'
                elif item in result['api_combination_items']:
                    item_type = 'api_combination'
                
                writer.writerow([
                    f"GW-WL-{date_str}-{idx:04d}",
                    item['id'],
                    item['name'],
                    item['tenant'],
                    item['api'],
                    '启用' if item['status'] else '禁用',
                    item['expire_date'],
                    '是' if is_expired else '否',
                    self._type_to_chinese(item_type),
                    item['_source_file'],
                    item['description'],
                    ','.join(item['tags'])
                ])
        
        return filepath
    
    def _generate_special_csv(self, result: Dict[str, Any], date_str: str, timestamp: str) -> str:
        filename = f"gateway_whitelist_inspection_special_{date_str}_{timestamp}.csv"
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '分类编号', '分类名称', '规则ID', '规则名称', '租户', '接口',
                '过期日期', '来源文件', '描述', '风险说明'
            ])
            
            for idx, item in enumerate(result['cache_config_items'], 1):
                writer.writerow([
                    f"CACHE-{date_str}-{idx:04d}",
                    "缓存配置",
                    item['id'], item['name'], item['tenant'], item['api'],
                    item['expire_date'], item['_source_file'], item['description'],
                    "缓存相关白名单过期可能导致缓存穿透或数据不一致"
                ])
            
            for idx, item in enumerate(result['tenant_rename_items'], 1):
                writer.writerow([
                    f"RENAME-{date_str}-{idx:04d}",
                    "租户改名",
                    item['id'], item['name'], item['tenant'], item['api'],
                    item['expire_date'], item['_source_file'], item['description'],
                    "租户改名相关白名单过期可能导致新租户名无法正常访问"
                ])
            
            for idx, item in enumerate(result['api_combination_items'], 1):
                writer.writerow([
                    f"COMBO-{date_str}-{idx:04d}",
                    "接口组合",
                    item['id'], item['name'], item['tenant'], item['api'],
                    item['expire_date'], item['_source_file'], item['description'],
                    "接口组合白名单过期可能导致批量接口访问失败"
                ])
        
        return filepath
    
    def _generate_json(self, result: Dict[str, Any], date_str: str, timestamp: str) -> str:
        filename = f"gateway_whitelist_inspection_result_{date_str}_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        
        json_data = {
            "inspection_type": "网关配置快照白名单过期巡检",
            "inspection_date": str(result['inspection_date']),
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_files": result['total_files'],
                "total_whitelists": result['total_whitelists'],
                "expired_active_count": result['expired_active_count'],
                "cache_config_count": result['cache_config_count'],
                "tenant_rename_count": result['tenant_rename_count'],
                "api_combination_count": result['api_combination_count']
            },
            "expired_whitelists": [
                {k: str(v) if k == 'expire_date' else v for k, v in item.items() if k != 'original_data'}
                for item in result['expired_whitelists']
            ],
            "special_items": {
                "cache_config": [
                    {k: str(v) if k == 'expire_date' else v for k, v in item.items() if k != 'original_data'}
                    for item in result['cache_config_items']
                ],
                "tenant_rename": [
                    {k: str(v) if k == 'expire_date' else v for k, v in item.items() if k != 'original_data'}
                    for item in result['tenant_rename_items']
                ],
                "api_combination": [
                    {k: str(v) if k == 'expire_date' else v for k, v in item.items() if k != 'original_data'}
                    for item in result['api_combination_items']
                ]
            }
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        return filepath
    
    def _type_to_chinese(self, item_type: str) -> str:
        type_map = {
            'cache_config': '缓存配置',
            'tenant_rename': '租户改名',
            'api_combination': '接口组合',
            'normal': '普通'
        }
        return type_map.get(item_type, '未知')
