import pandas as pd
import numpy as np
import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional

# 入侵种列表（示例，可以根据实际情况修改）
INVASIVE_SPECIES = [
    'Spartina alterniflora', '互花米草',
    'Rapana venosa', '脉红螺',
    'Crepidula fornicata', '履螺',
    'Mnemiopsis leidyi', '淡海栉水母',
    'Styela clava', '柄海鞘'
]

# 正常环境参数范围（示例值，可根据实际情况调整）
NORMAL_ENV_RANGES = {
    'water_temp': {'min': 5, 'max': 35},  # 水温范围 (°C)
    'salinity': {'min': 10, 'max': 35},   # 盐度范围 (ppt)
    'ph': {'min': 7.5, 'max': 8.5},       # pH值范围
    'dissolved_oxygen': {'min': 5, 'max': 10}  # 溶解氧 (mg/L)
}


class DataProcessor:
    """数据处理类，负责解析和分析潮间带样方数据"""
    
    def __init__(self, data_folder: str):
        self.data_folder = data_folder
        self.session_data = {}
        self.analysis_results = {}
    
    def load_csv(self, file_path: str, file_type: str) -> pd.DataFrame:
        """加载CSV文件"""
        try:
            df = pd.read_csv(file_path, encoding='utf-8')
            return df
        except UnicodeDecodeError:
            # 尝试其他编码
            df = pd.read_csv(file_path, encoding='gbk')
            return df
    
    def parse_species_csv(self, file_path: str) -> Dict[str, Any]:
        """解析物种CSV文件"""
        df = self.load_csv(file_path, 'species')
        
        # 标准化列名
        column_mapping = {
            '样方编号': 'quadrat_id',
            'Quadrant ID': 'quadrat_id',
            '物种名称': 'species_name',
            'Species': 'species_name',
            '数量': 'count',
            'Count': 'count',
            '盖度': 'coverage',
            'Coverage': 'coverage',
            '生境类型': 'habitat',
            'Habitat': 'habitat',
            '备注': 'notes',
            'Notes': 'notes'
        }
        
        # 重命名列
        df = df.rename(columns={col: column_mapping.get(col, col) for col in df.columns})
        
        # 确保必要列存在
        required_columns = ['quadrat_id', 'species_name']
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"物种CSV缺少必要列: {col}")
        
        # 按样方分组
        quadrats = {}
        for quadrat_id, group in df.groupby('quadrat_id'):
            quadrats[str(quadrat_id)] = {
                'species': group.to_dict('records'),
                'species_count': len(group),
                'total_individuals': group['count'].sum() if 'count' in group.columns else 0
            }
        
        return {
            'raw_data': df.to_dict('records'),
            'quadrats': quadrats,
            'total_quadrats': len(quadrats),
            'total_species': df['species_name'].nunique()
        }
    
    def parse_env_csv(self, file_path: str) -> Dict[str, Any]:
        """解析环境参数CSV文件"""
        df = self.load_csv(file_path, 'environment')
        
        # 标准化列名
        column_mapping = {
            '样方编号': 'quadrat_id',
            'Quadrant ID': 'quadrat_id',
            '测量时间': 'measurement_time',
            'Time': 'measurement_time',
            '水温': 'water_temp',
            'Water Temp': 'water_temp',
            'Temperature': 'water_temp',
            '盐度': 'salinity',
            'Salinity': 'salinity',
            'pH值': 'ph',
            'pH': 'ph',
            '溶解氧': 'dissolved_oxygen',
            'DO': 'dissolved_oxygen',
            '备注': 'notes',
            'Notes': 'notes'
        }
        
        # 重命名列
        df = df.rename(columns={col: column_mapping.get(col, col) for col in df.columns})
        
        # 按样方分组
        env_data = {}
        for quadrat_id, group in df.groupby('quadrat_id'):
            # 取最新的测量值
            latest = group.iloc[-1] if len(group) > 0 else {}
            env_data[str(quadrat_id)] = latest.to_dict()
        
        return {
            'raw_data': df.to_dict('records'),
            'quadrat_env': env_data,
            'total_measurements': len(df)
        }
    
    def detect_invasive_species(self, species_data: Dict[str, Any]) -> Dict[str, Any]:
        """检测入侵种"""
        invasive_detected = {}
        
        for quadrat_id, quadrat_data in species_data.get('quadrats', {}).items():
            invasive_species = []
            for species in quadrat_data.get('species', []):
                species_name = species.get('species_name', '')
                # 检查是否为入侵种（不区分大小写）
                if any(inv.lower() in species_name.lower() for inv in INVASIVE_SPECIES):
                    invasive_species.append({
                        'species_name': species_name,
                        'count': species.get('count', 0),
                        'coverage': species.get('coverage', 0)
                    })
            
            if invasive_species:
                invasive_detected[quadrat_id] = {
                    'invasive_species': invasive_species,
                    'count': len(invasive_species)
                }
        
        return {
            'invasive_quadrats': invasive_detected,
            'total_invasive_quadrats': len(invasive_detected),
            'invasive_species_list': list(set(
                sp['species_name']
                for quadrat in invasive_detected.values()
                for sp in quadrat['invasive_species']
            ))
        }
    
    def detect_missing_data(self, species_data: Dict[str, Any], 
                           env_data: Dict[str, Any]) -> Dict[str, Any]:
        """检测缺测数据"""
        missing_quadrats = {}
        
        # 获取所有样方ID
        species_quadrats = set(species_data.get('quadrats', {}).keys())
        env_quadrats = set(env_data.get('quadrat_env', {}).keys())
        
        all_quadrats = species_quadrats.union(env_quadrats)
        
        for quadrat_id in all_quadrats:
            issues = []
            
            # 检查物种数据
            if quadrat_id not in species_quadrats:
                issues.append({
                    'type': 'missing_species',
                    'description': '缺少物种调查数据'
                })
            else:
                quadrat_species = species_data['quadrats'][quadrat_id]
                if len(quadrat_species.get('species', [])) == 0:
                    issues.append({
                        'type': 'empty_species',
                        'description': '物种数据为空'
                    })
            
            # 检查环境数据
            if quadrat_id not in env_quadrats:
                issues.append({
                    'type': 'missing_env',
                    'description': '缺少环境参数数据'
                })
            else:
                quadrat_env = env_data['quadrat_env'][quadrat_id]
                # 检查关键环境参数是否存在
                critical_params = ['water_temp', 'salinity']
                for param in critical_params:
                    if param not in quadrat_env or pd.isna(quadrat_env.get(param)):
                        issues.append({
                            'type': 'missing_env_param',
                            'description': f'缺少{param}参数',
                            'param': param
                        })
            
            if issues:
                missing_quadrats[quadrat_id] = {
                    'issues': issues,
                    'issue_count': len(issues)
                }
        
        return {
            'missing_quadrats': missing_quadrats,
            'total_missing_quadrats': len(missing_quadrats)
        }
    
    def detect_abnormal_mortality(self, species_data: Dict[str, Any]) -> Dict[str, Any]:
        """检测异常死亡情况"""
        abnormal_quadrats = {}
        
        for quadrat_id, quadrat_data in species_data.get('quadrats', {}).items():
            abnormal_species = []
            
            for species in quadrat_data.get('species', []):
                # 检查是否有死亡个体的标记或异常低的数量
                species_name = species.get('species_name', '')
                count = species.get('count', 0)
                coverage = species.get('coverage', 0)
                
                # 检测异常情况
                issues = []
                
                # 检查备注中是否有死亡相关的描述
                notes = species.get('notes', '')
                if notes:
                    death_keywords = ['死亡', '死', 'dead', 'die', 'mortality', '异常']
                    if any(kw.lower() in notes.lower() for kw in death_keywords):
                        issues.append({
                            'type': 'noted_mortality',
                            'description': '备注中提到死亡或异常情况'
                        })
                
                # 检查数量为0但有记录的情况
                if count == 0 and coverage == 0:
                    issues.append({
                        'type': 'zero_count',
                        'description': '物种记录但数量为0'
                    })
                
                if issues:
                    abnormal_species.append({
                        'species_name': species_name,
                        'count': count,
                        'coverage': coverage,
                        'issues': issues
                    })
            
            if abnormal_species:
                abnormal_quadrats[quadrat_id] = {
                    'abnormal_species': abnormal_species,
                    'count': len(abnormal_species)
                }
        
        return {
            'abnormal_quadrats': abnormal_quadrats,
            'total_abnormal_quadrats': len(abnormal_quadrats)
        }
    
    def calculate_species_diversity(self, species_data: Dict[str, Any]) -> Dict[str, Any]:
        """计算物种丰富度和优势度"""
        diversity_results = {}
        
        for quadrat_id, quadrat_data in species_data.get('quadrats', {}).items():
            species_list = quadrat_data.get('species', [])
            
            # 计算丰富度
            richness = len(species_list)
            
            # 计算优势度（Simpson指数）
            total_individuals = sum(s.get('count', 0) for s in species_list)
            simpson_index = 0.0
            shannon_index = 0.0
            
            if total_individuals > 0:
                # Simpson指数: 1 - Σ(pi²)
                sum_pi_squared = sum(
                    (s.get('count', 0) / total_individuals) ** 2 
                    for s in species_list
                )
                simpson_index = 1 - sum_pi_squared
                
                # Shannon指数: -Σ(pi * ln(pi))
                shannon_index = -sum(
                    (s.get('count', 0) / total_individuals) * 
                    np.log(s.get('count', 0) / total_individuals)
                    for s in species_list if s.get('count', 0) > 0
                )
            
            # 确定优势种
            dominant_species = []
            if species_list:
                # 按数量排序
                sorted_species = sorted(
                    species_list, 
                    key=lambda x: x.get('count', 0), 
                    reverse=True
                )
                # 取前3种作为优势种
                dominant_species = [
                    {
                        'species_name': s.get('species_name', ''),
                        'count': s.get('count', 0),
                        'coverage': s.get('coverage', 0)
                    }
                    for s in sorted_species[:3]
                ]
            
            diversity_results[quadrat_id] = {
                'richness': richness,
                'simpson_index': round(simpson_index, 4),
                'shannon_index': round(shannon_index, 4),
                'total_individuals': total_individuals,
                'dominant_species': dominant_species
            }
        
        # 计算整体统计
        all_richness = [d['richness'] for d in diversity_results.values()]
        all_simpson = [d['simpson_index'] for d in diversity_results.values()]
        all_shannon = [d['shannon_index'] for d in diversity_results.values()]
        
        overall_stats = {
            'avg_richness': round(np.mean(all_richness), 2) if all_richness else 0,
            'min_richness': min(all_richness) if all_richness else 0,
            'max_richness': max(all_richness) if all_richness else 0,
            'avg_simpson': round(np.mean(all_simpson), 4) if all_simpson else 0,
            'avg_shannon': round(np.mean(all_shannon), 4) if all_shannon else 0
        }
        
        return {
            'quadrat_diversity': diversity_results,
            'overall_stats': overall_stats
        }
    
    def detect_env_anomalies(self, env_data: Dict[str, Any]) -> Dict[str, Any]:
        """检测环境异常"""
        env_anomalies = {}
        
        for quadrat_id, quadrat_env in env_data.get('quadrat_env', {}).items():
            anomalies = []
            
            # 检查水温
            water_temp = quadrat_env.get('water_temp')
            if water_temp is not None and not pd.isna(water_temp):
                temp_range = NORMAL_ENV_RANGES['water_temp']
                if water_temp < temp_range['min'] or water_temp > temp_range['max']:
                    anomalies.append({
                        'type': 'temperature',
                        'value': water_temp,
                        'normal_range': temp_range,
                        'description': f'水温异常: {water_temp}°C (正常范围: {temp_range["min"]}-{temp_range["max"]}°C)'
                    })
            
            # 检查盐度
            salinity = quadrat_env.get('salinity')
            if salinity is not None and not pd.isna(salinity):
                salinity_range = NORMAL_ENV_RANGES['salinity']
                if salinity < salinity_range['min'] or salinity > salinity_range['max']:
                    anomalies.append({
                        'type': 'salinity',
                        'value': salinity,
                        'normal_range': salinity_range,
                        'description': f'盐度异常: {salinity} ppt (正常范围: {salinity_range["min"]}-{salinity_range["max"]} ppt)'
                    })
            
            # 检查pH
            ph = quadrat_env.get('ph')
            if ph is not None and not pd.isna(ph):
                ph_range = NORMAL_ENV_RANGES['ph']
                if ph < ph_range['min'] or ph > ph_range['max']:
                    anomalies.append({
                        'type': 'ph',
                        'value': ph,
                        'normal_range': ph_range,
                        'description': f'pH异常: {ph} (正常范围: {ph_range["min"]}-{ph_range["max"]})'
                    })
            
            # 检查溶解氧
            do = quadrat_env.get('dissolved_oxygen')
            if do is not None and not pd.isna(do):
                do_range = NORMAL_ENV_RANGES['dissolved_oxygen']
                if do < do_range['min'] or do > do_range['max']:
                    anomalies.append({
                        'type': 'dissolved_oxygen',
                        'value': do,
                        'normal_range': do_range,
                        'description': f'溶解氧异常: {do} mg/L (正常范围: {do_range["min"]}-{do_range["max"]} mg/L)'
                    })
            
            if anomalies:
                env_anomalies[quadrat_id] = {
                    'anomalies': anomalies,
                    'count': len(anomalies)
                }
        
        return {
            'env_anomalies': env_anomalies,
            'total_anomalous_quadrats': len(env_anomalies)
        }
    
    def run_full_analysis(self, species_file: str, env_file: str, 
                         notes: str = '') -> Dict[str, Any]:
        """执行完整的数据分析流程"""
        # 解析数据
        species_data = self.parse_species_csv(species_file)
        env_data = self.parse_env_csv(env_file)
        
        # 执行各种分析
        invasive_result = self.detect_invasive_species(species_data)
        missing_result = self.detect_missing_data(species_data, env_data)
        mortality_result = self.detect_abnormal_mortality(species_data)
        diversity_result = self.calculate_species_diversity(species_data)
        env_anomaly_result = self.detect_env_anomalies(env_data)
        
        # 综合结果
        analysis_result = {
            'analysis_time': datetime.now().isoformat(),
            'species_data': species_data,
            'env_data': env_data,
            'invasive_species': invasive_result,
            'missing_data': missing_result,
            'abnormal_mortality': mortality_result,
            'species_diversity': diversity_result,
            'env_anomalies': env_anomaly_result,
            'manual_notes': notes,
            'review_status': {}  # 人工复核状态
        }
        
        # 统计总结
        summary = {
            'total_quadrats': species_data.get('total_quadrats', 0),
            'total_species': species_data.get('total_species', 0),
            'invasive_quadrats': invasive_result.get('total_invasive_quadrats', 0),
            'missing_quadrats': missing_result.get('total_missing_quadrats', 0),
            'abnormal_mortality_quadrats': mortality_result.get('total_abnormal_quadrats', 0),
            'env_anomaly_quadrats': env_anomaly_result.get('total_anomalous_quadrats', 0)
        }
        
        # 标记需要关注的样方
        flagged_quadrats = set()
        flagged_quadrats.update(invasive_result.get('invasive_quadrats', {}).keys())
        flagged_quadrats.update(missing_result.get('missing_quadrats', {}).keys())
        flagged_quadrats.update(mortality_result.get('abnormal_quadrats', {}).keys())
        flagged_quadrats.update(env_anomaly_result.get('env_anomalies', {}).keys())
        
        analysis_result['flagged_quadrats'] = list(flagged_quadrats)
        analysis_result['flagged_count'] = len(flagged_quadrats)
        analysis_result['summary'] = summary
        
        return analysis_result
    
    def save_session(self, session_id: str, data: Dict[str, Any]) -> str:
        """保存会话数据"""
        session_file = os.path.join(self.data_folder, f'{session_id}.json')
        with open(session_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return session_file
    
    def load_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """加载会话数据"""
        session_file = os.path.join(self.data_folder, f'{session_id}.json')
        if os.path.exists(session_file):
            with open(session_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def update_review_status(self, session_id: str, quadrat_id: str, 
                            status: str, notes: str = '') -> bool:
        """更新样方复核状态"""
        session_data = self.load_session(session_id)
        if not session_data:
            return False
        
        if 'review_status' not in session_data:
            session_data['review_status'] = {}
        
        session_data['review_status'][quadrat_id] = {
            'status': status,
            'notes': notes,
            'updated_at': datetime.now().isoformat()
        }
        
        self.save_session(session_id, session_data)
        return True
    
    def export_markdown_report(self, session_id: str) -> str:
        """导出Markdown格式的巡护报告"""
        session_data = self.load_session(session_id)
        if not session_data:
            return ""
        
        analysis_time = session_data.get('analysis_time', '未知')
        summary = session_data.get('summary', {})
        flagged_quadrats = session_data.get('flagged_quadrats', [])
        
        # 生成Markdown报告
        report = f"""# 潮间带样方巡护复盘报告

## 基本信息
- **分析时间**: {analysis_time}
- **总样方数**: {summary.get('total_quadrats', 0)}
- **总物种数**: {summary.get('total_species', 0)}

## 异常检测摘要
| 异常类型 | 涉及样方数 |
|---------|-----------|
| 入侵种检测 | {summary.get('invasive_quadrats', 0)} |
| 数据缺测 | {summary.get('missing_quadrats', 0)} |
| 异常死亡 | {summary.get('abnormal_mortality_quadrats', 0)} |
| 环境异常 | {summary.get('env_anomaly_quadrats', 0)} |

## 需要关注的样方 ({len(flagged_quadrats)} 个)

"""
        
        # 详细信息
        review_status = session_data.get('review_status', {})
        
        for quadrat_id in flagged_quadrats:
            status_info = review_status.get(quadrat_id, {})
            status = status_info.get('status', '未复核')
            notes = status_info.get('notes', '')
            
            report += f"### 样方 {quadrat_id}\n"
            report += f"- **复核状态**: {status}\n"
            
            # 入侵种信息
            invasive = session_data.get('invasive_species', {}).get('invasive_quadrats', {}).get(quadrat_id)
            if invasive:
                report += f"- **入侵种**: {', '.join([s['species_name'] for s in invasive.get('invasive_species', [])])}\n"
            
            # 缺测信息
            missing = session_data.get('missing_data', {}).get('missing_quadrats', {}).get(quadrat_id)
            if missing:
                report += f"- **数据缺测**: {', '.join([i['description'] for i in missing.get('issues', [])])}\n"
            
            # 异常死亡
            mortality = session_data.get('abnormal_mortality', {}).get('abnormal_quadrats', {}).get(quadrat_id)
            if mortality:
                report += f"- **异常死亡**: {', '.join([s['species_name'] for s in mortality.get('abnormal_species', [])])}\n"
            
            # 环境异常
            env_anomaly = session_data.get('env_anomalies', {}).get('env_anomalies', {}).get(quadrat_id)
            if env_anomaly:
                report += f"- **环境异常**: {', '.join([a['description'] for a in env_anomaly.get('anomalies', [])])}\n"
            
            # 多样性信息
            diversity = session_data.get('species_diversity', {}).get('quadrat_diversity', {}).get(quadrat_id)
            if diversity:
                report += f"- **物种丰富度**: {diversity.get('richness', 0)}\n"
                report += f"- **Simpson指数**: {diversity.get('simpson_index', 0)}\n"
                report += f"- **优势种**: {', '.join([s['species_name'] for s in diversity.get('dominant_species', [])])}\n"
            
            if notes:
                report += f"- **复核备注**: {notes}\n"
            
            report += "\n"
        
        # 人工备注
        manual_notes = session_data.get('manual_notes', '')
        if manual_notes:
            report += f"""## 人工备注

{manual_notes}

"""
        
        return report
    
    def export_json_detail(self, session_id: str) -> Dict[str, Any]:
        """导出JSON格式的详细数据"""
        session_data = self.load_session(session_id)
        if not session_data:
            return {}
        
        # 返回完整数据
        return session_data
