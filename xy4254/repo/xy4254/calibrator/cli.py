"""
命令行接口 - 苗盘补光灌溉校准器CLI
"""

import click
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from .parser import SensorParser, TrayParser, WeatherParser, InspectionParser
from .calculator import DLICalculator, EvapotranspirationCalculator, MoistureAnalyzer
from .rules import RiskEvaluator, ActionPlanner
from .exporter import MarkdownExporter, CSVExporter, JSONExporter


@click.group()
@click.version_option(version='0.1.0')
def main():
    """
    苗盘补光灌溉校准器
    
    一个为小型温室育苗员设计的本地Python工具，用于：
    - init: 生成示例数据
    - analyze: 计算每盘DLI、蒸散估计和缺水风险
    - plan: 生成补光/灌溉建议
    - report: 导出Markdown、CSV和JSON报告
    """
    pass


@main.command()
@click.option('--output-dir', '-o', default='./sample_data', 
              help='示例数据输出目录，默认: ./sample_data')
@click.option('--tray-count', '-t', default=5, type=int,
              help='生成的苗盘数量，默认: 5')
@click.option('--days', '-d', default=3, type=int,
              help='生成的天数数据，默认: 3')
def init(output_dir: str, tray_count: int, days: int):
    """
    生成示例数据
    
    创建示例传感器CSV、苗盘品种JSON、天气预报和人工巡检备注文件。
    """
    click.echo(f"正在生成示例数据到: {output_dir}")
    
    os.makedirs(output_dir, exist_ok=True)
    
    _generate_sensor_csv(output_dir, tray_count, days)
    
    _generate_tray_json(output_dir, tray_count)
    
    _generate_weather_json(output_dir, days)
    
    _generate_inspection_json(output_dir, tray_count)
    
    click.echo("✅ 示例数据生成完成！")
    click.echo(f"   输出目录: {output_dir}")
    click.echo("")
    click.echo("生成的文件:")
    click.echo("  - sensor_data.csv    - 传感器数据")
    click.echo("  - tray_config.json   - 苗盘品种配置")
    click.echo("  - weather_forecast.json - 天气预报")
    click.echo("  - inspection_notes.json - 人工巡检备注")
    click.echo("")
    click.echo("下一步操作:")
    click.echo(f"  calibrator analyze --sensor {output_dir}/sensor_data.csv --trays {output_dir}/tray_config.json")
    click.echo(f"  calibrator plan --sensor {output_dir}/sensor_data.csv --trays {output_dir}/tray_config.json --weather {output_dir}/weather_forecast.json")


@main.command()
@click.option('--sensor', '-s', required=True, type=click.Path(exists=True),
              help='传感器CSV数据文件路径')
@click.option('--trays', '-t', required=True, type=click.Path(exists=True),
              help='苗盘品种JSON配置文件路径')
@click.option('--weather', '-w', type=click.Path(exists=True),
              help='天气预报文件路径（可选）')
@click.option('--inspection', '-i', type=click.Path(exists=True),
              help='人工巡检备注文件路径（可选）')
@click.option('--output', '-o', default='./analysis_results.json',
              help='分析结果输出路径，默认: ./analysis_results.json')
def analyze(sensor: str, trays: str, weather: Optional[str], 
            inspection: Optional[str], output: str):
    """
    分析传感器数据
    
    计算每盘DLI（日积累光量）、蒸散估计和缺水风险。
    """
    click.echo("正在分析数据...")
    
    sensor_parser = SensorParser()
    tray_parser = TrayParser()
    weather_parser = WeatherParser()
    inspection_parser = InspectionParser()
    
    dli_calculator = DLICalculator()
    et_calculator = EvapotranspirationCalculator()
    moisture_analyzer = MoistureAnalyzer()
    
    try:
        sensor_data = sensor_parser.parse(sensor)
        click.echo(f"  ✅ 传感器数据: {len(sensor_data)} 条记录")
    except Exception as e:
        click.echo(f"  ❌ 传感器数据解析失败: {e}", err=True)
        raise click.Abort()
    
    try:
        tray_data = tray_parser.parse(trays)
        click.echo(f"  ✅ 苗盘配置: {len(tray_data)} 个苗盘")
    except Exception as e:
        click.echo(f"  ❌ 苗盘配置解析失败: {e}", err=True)
        raise click.Abort()
    
    weather_data = None
    if weather:
        try:
            weather_data = weather_parser.parse(weather)
            click.echo(f"  ✅ 天气预报: {len(weather_data)} 天")
        except Exception as e:
            click.echo(f"  ⚠️  天气预报解析失败: {e}")
    
    inspection_data = None
    if inspection:
        try:
            inspection_data = inspection_parser.parse(inspection)
            click.echo(f"  ✅ 巡检记录: {len(inspection_data)} 条")
        except Exception as e:
            click.echo(f"  ⚠️  巡检记录解析失败: {e}")
    
    click.echo("")
    click.echo("正在计算DLI、蒸散量和水分分析...")
    
    results = {
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'sensor_file': sensor,
            'tray_file': trays,
            'weather_file': weather,
            'inspection_file': inspection
        },
        'sensor_summary': sensor_parser.get_summary(),
        'tray_summary': tray_parser.get_summary(),
        'weather_summary': weather_parser.get_summary() if weather_data else {},
        'inspection_summary': inspection_parser.get_summary() if inspection_data else {},
        'trays': {}
    }
    
    tray_ids = sensor_parser.tray_ids
    
    for tray_id in tray_ids:
        click.echo(f"  分析苗盘: {tray_id}")
        
        tray_data_ind = sensor_parser.get_tray_data(tray_id)
        tray_requirements = tray_parser.get_variety_requirements(tray_id)
        
        daily_dli = dli_calculator.calculate_daily_dli(
            tray_data_ind['light_intensity'],
            tray_data_ind['timestamp']
        )
        
        moisture_analysis = moisture_analyzer.analyze_moisture_timeseries(
            tray_data_ind['moisture'],
            tray_data_ind['timestamp']
        )
        
        avg_temp = float(tray_data_ind['temperature'].mean())
        avg_humidity = float(tray_data_ind['humidity'].mean())
        
        et0 = None
        if weather_data:
            latest_date = max(item['date'] for item in weather_data) if weather_data else None
            if latest_date:
                et0 = weather_parser.estimate_potential_evapotranspiration(latest_date)
        
        if et0 is None:
            solar_radiation = 15.0
            et0 = et_calculator.calculate_et0(
                temperature=avg_temp,
                relative_humidity=avg_humidity,
                wind_speed=2.0,
                solar_radiation=solar_radiation
            )
        
        latest_dli = list(daily_dli.values())[-1] if daily_dli else 0
        current_moisture = moisture_analysis.get('basic_stats', {}).get('mean', 50)
        
        tray_info = tray_parser.get_tray_info(tray_id)
        stage = tray_info.get('stage', '幼苗期') if tray_info else '幼苗期'
        kc = et_calculator.get_crop_coefficient(stage)
        
        results['trays'][tray_id] = {
            'info': tray_info,
            'requirements': tray_requirements,
            'dli_data': {
                'daily_dli': daily_dli,
                'latest_dli': round(latest_dli, 2),
                'weekly_stats': dli_calculator.calculate_weekly_stats(daily_dli)
            },
            'moisture_analysis': moisture_analysis,
            'et0_data': {
                'et0': round(et0, 2),
                'kc': kc,
                'avg_temperature': round(avg_temp, 1),
                'avg_humidity': round(avg_humidity, 1)
            },
            'inspection': {
                'latest': inspection_parser.get_latest_inspection(tray_id) if inspection_data else None,
                'has_watering_issue': inspection_parser.has_watering_issue_flag(tray_id) if inspection_data else False
            }
        }
    
    output_dir = os.path.dirname(output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)
    
    click.echo("")
    click.echo(f"✅ 分析完成！结果已保存到: {output}")
    
    critical_count = 0
    warning_count = 0
    for tray_id, data in results['trays'].items():
        moisture_risk = data['moisture_analysis'].get('risk', {})
        if moisture_risk.get('current_risk') == 'critical':
            critical_count += 1
        elif moisture_risk.get('current_risk') == 'high':
            warning_count += 1
    
    if critical_count > 0 or warning_count > 0:
        click.echo("")
        click.echo("⚠️  风险警告:")
        if critical_count > 0:
            click.echo(f"   - {critical_count} 个苗盘存在严重风险")
        if warning_count > 0:
            click.echo(f"   - {warning_count} 个苗盘存在高风险")
        click.echo("   建议运行 'plan' 命令查看详细建议")


@main.command()
@click.option('--sensor', '-s', required=True, type=click.Path(exists=True),
              help='传感器CSV数据文件路径')
@click.option('--trays', '-t', required=True, type=click.Path(exists=True),
              help='苗盘品种JSON配置文件路径')
@click.option('--weather', '-w', type=click.Path(exists=True),
              help='天气预报文件路径')
@click.option('--inspection', '-i', type=click.Path(exists=True),
              help='人工巡检备注文件路径')
@click.option('--input', '-f', type=click.Path(exists=True),
              help='使用已有的分析结果JSON文件（跳过重新分析）')
@click.option('--output', '-o', default='./action_plan.json',
              help='行动计划输出路径，默认: ./action_plan.json')
def plan(sensor: str, trays: str, weather: Optional[str], 
         inspection: Optional[str], input: Optional[str], output: str):
    """
    生成补光/灌溉建议
    
    根据分析结果评估风险并生成具体的补光和灌溉行动计划。
    """
    click.echo("正在生成行动计划...")
    
    analysis_results = None
    
    if input:
        click.echo(f"  从文件加载分析结果: {input}")
        with open(input, 'r', encoding='utf-8') as f:
            analysis_results = json.load(f)
    else:
        from .cli import _run_analysis
        click.echo("  运行分析...")
        analysis_results = _run_analysis(sensor, trays, weather, inspection)
    
    risk_evaluator = RiskEvaluator()
    action_planner = ActionPlanner()
    
    weather_forecast = None
    if weather:
        weather_parser = WeatherParser()
        try:
            weather_forecast = weather_parser.parse(weather)
        except Exception as e:
            click.echo(f"  ⚠️  天气预报解析失败: {e}")
    
    trays_data = analysis_results.get('trays', {})
    
    click.echo("  评估风险...")
    risk_results = risk_evaluator.batch_evaluate(trays_data)
    
    click.echo("  生成行动计划...")
    action_plans = action_planner.generate_batch_plans(trays_data, risk_results)
    
    consolidated = action_planner.consolidate_actions(action_plans)
    
    plan_output = {
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'total_trays': len(risk_results)
        },
        'risk_summary': _summarize_risks(risk_results),
        'action_summary': consolidated.get('summary', {}),
        'risk_results': {},
        'action_plans': {},
        'consolidated_actions': consolidated
    }
    
    for tray_id, result in risk_results.items():
        plan_output['risk_results'][tray_id] = {
            'overall_risk': result.overall_risk,
            'overall_score': result.overall_score,
            'light_risk': result.light_risk,
            'moisture_risk': result.moisture_risk,
            'warnings': result.warnings,
            'recommendations': result.recommendations
        }
    
    for tray_id, plan in action_plans.items():
        plan_output['action_plans'][tray_id] = {
            'priority': plan.priority,
            'estimated_cost': plan.estimated_cost,
            'light_actions': plan.light_actions,
            'irrigation_actions': plan.irrigation_actions,
            'monitoring_actions': plan.monitoring_actions
        }
    
    output_dir = os.path.dirname(output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(plan_output, f, ensure_ascii=False, indent=2, default=str)
    
    click.echo("")
    click.echo(f"✅ 行动计划生成完成！已保存到: {output}")
    
    click.echo("")
    click.echo("📋 今日操作汇总:")
    summary = consolidated.get('summary', {})
    if summary.get('urgent_count', 0) > 0:
        click.echo(f"   🔴 紧急操作: {summary['urgent_count']} 项")
    if summary.get('needs_light', 0) > 0:
        click.echo(f"   💡 需要补光: {summary['needs_light']} 盘")
    if summary.get('needs_water', 0) > 0:
        click.echo(f"   💧 需要浇水: {summary['needs_water']} 盘")
    click.echo(f"   💰 预计成本: ¥{summary.get('total_estimated_cost', 0):.2f}")
    
    urgent = consolidated.get('urgent_actions', [])
    if urgent:
        click.echo("")
        click.echo("⚠️  紧急操作列表:")
        for action in urgent[:5]:
            tray_id = action.get('tray_id', '未知')
            action_detail = action.get('action', {})
            click.echo(f"   - {tray_id}: {action_detail.get('action', '')}")
        if len(urgent) > 5:
            click.echo(f"   ... 还有 {len(urgent) - 5} 项")


@main.command()
@click.option('--input', '-i', required=True, type=click.Path(exists=True),
              help='分析结果或行动计划JSON文件路径')
@click.option('--action-plan', '-a', type=click.Path(exists=True),
              help='行动计划JSON文件路径（可选）')
@click.option('--output-dir', '-o', default='./reports',
              help='报告输出目录，默认: ./reports')
@click.option('--format', '-f', type=click.Choice(['all', 'markdown', 'csv', 'json']),
              default='all', help='输出格式，默认: all')
@click.option('--prefix', '-p', default='report',
              help='输出文件前缀，默认: report')
def report(input: str, action_plan: Optional[str], output_dir: str, 
           format: str, prefix: str):
    """
    导出报告
    
    将分析结果和行动计划导出为Markdown、CSV和JSON格式报告。
    """
    click.echo(f"正在生成报告到: {output_dir}")
    
    os.makedirs(output_dir, exist_ok=True)
    
    with open(input, 'r', encoding='utf-8') as f:
        analysis_data = json.load(f)
    
    plan_data = None
    if action_plan:
        with open(action_plan, 'r', encoding='utf-8') as f:
            plan_data = json.load(f)
    
    from .cli import _reconstruct_risk_results, _reconstruct_action_plans
    
    risk_results = _reconstruct_risk_results(analysis_data, plan_data)
    action_plans = _reconstruct_action_plans(plan_data) if plan_data else {}
    
    consolidated_actions = plan_data.get('consolidated_actions', {}) if plan_data else None
    
    generated_files = []
    
    if format in ['all', 'markdown']:
        markdown_exporter = MarkdownExporter()
        md_path = os.path.join(output_dir, f'{prefix}.md')
        markdown_exporter.export(
            md_path,
            analysis_data,
            risk_results,
            action_plans,
            consolidated_actions
        )
        generated_files.append(md_path)
        click.echo(f"  ✅ Markdown报告: {md_path}")
    
    if format in ['all', 'csv']:
        csv_exporter = CSVExporter()
        
        risk_csv = os.path.join(output_dir, f'{prefix}_risk.csv')
        csv_exporter.export_risk_summary(risk_csv, risk_results, action_plans)
        generated_files.append(risk_csv)
        click.echo(f"  ✅ 风险汇总CSV: {risk_csv}")
        
        if consolidated_actions:
            action_csv = os.path.join(output_dir, f'{prefix}_actions.csv')
            csv_exporter.export_action_plan(action_csv, consolidated_actions)
            generated_files.append(action_csv)
            click.echo(f"  ✅ 行动计划CSV: {action_csv}")
    
    if format in ['all', 'json']:
        json_exporter = JSONExporter()
        json_path = os.path.join(output_dir, f'{prefix}_full.json')
        json_exporter.export_full(
            json_path,
            analysis_data,
            risk_results,
            action_plans,
            consolidated_actions
        )
        generated_files.append(json_path)
        click.echo(f"  ✅ 完整JSON: {json_path}")
    
    click.echo("")
    click.echo(f"✅ 报告生成完成！共生成 {len(generated_files)} 个文件")
    click.echo("")
    click.echo("生成的文件:")
    for f in generated_files:
        click.echo(f"  - {f}")


def _generate_sensor_csv(output_dir: str, tray_count: int, days: int):
    """生成示例传感器CSV数据"""
    import csv
    import random
    
    filepath = os.path.join(output_dir, 'sensor_data.csv')
    
    base_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    tray_ids = [f'TRAY-{i:02d}' for i in range(1, tray_count + 1)]
    
    rows = []
    
    for day in range(days):
        current_date = base_date - timedelta(days=days - 1 - day)
        
        for hour in range(6, 20):
            for minute in [0, 30]:
                timestamp = current_date.replace(hour=hour, minute=minute)
                
                for tray_id in tray_ids:
                    tray_idx = int(tray_id.split('-')[1])
                    
                    if 8 <= hour < 17:
                        cloud_factor = 0.3 if tray_idx % 3 == 0 else 0.7
                        hour_factor = 1.0 - abs(hour - 12) / 6.0
                        base_light = 800 * cloud_factor * hour_factor
                        light = base_light + random.uniform(-100, 100)
                    else:
                        light = random.uniform(0, 50)
                    
                    if day == 0 and tray_idx in [1, 3]:
                        light = light * 0.3
                    
                    if tray_idx == 2:
                        base_moisture = 30 + random.uniform(-5, 5)
                    elif tray_idx == 4:
                        base_moisture = 85 + random.uniform(-3, 3)
                    else:
                        base_moisture = 60 + (hour - 12) * 2 + random.uniform(-5, 5)
                    
                    base_temp = 22 + (hour - 12) * 3 + random.uniform(-2, 2)
                    base_humidity = 60 - (hour - 12) * 3 + random.uniform(-5, 5)
                    
                    rows.append({
                        'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                        'tray_id': tray_id,
                        'light_intensity': round(max(0, light), 1),
                        'moisture': round(max(20, min(95, base_moisture)), 1),
                        'temperature': round(base_temp, 1),
                        'humidity': round(max(30, min(90, base_humidity)), 1)
                    })
    
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'timestamp', 'tray_id', 'light_intensity', 
            'moisture', 'temperature', 'humidity'
        ])
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    
    click.echo(f"  ✅ 传感器数据: {filepath}")


def _generate_tray_json(output_dir: str, tray_count: int):
    """生成示例苗盘配置JSON"""
    import random
    
    filepath = os.path.join(output_dir, 'tray_config.json')
    
    varieties = ['樱桃番茄', '黄瓜', '辣椒', '生菜', '草莓']
    stages = ['催芽期', '幼苗期', '成苗期', '炼苗期']
    
    trays = []
    
    for i in range(1, tray_count + 1):
        tray_id = f'TRAY-{i:02d}'
        
        if i == 1:
            stage = '幼苗期'
            variety = '樱桃番茄'
        elif i == 2:
            stage = '成苗期'
            variety = '黄瓜'
        elif i == 3:
            stage = '催芽期'
            variety = '辣椒'
        elif i == 4:
            stage = '炼苗期'
            variety = '生菜'
        else:
            stage = random.choice(stages)
            variety = random.choice(varieties)
        
        tray = {
            'tray_id': tray_id,
            'variety_name': variety,
            'stage': stage,
            'planting_date': (datetime.now() - timedelta(days=random.randint(5, 30))).strftime('%Y-%m-%d'),
            'notes': f'{variety}育苗盘，{stage}'
        }
        
        trays.append(tray)
    
    output = {
        'generated_at': datetime.now().isoformat(),
        'description': '苗盘品种配置示例数据',
        'trays': trays
    }
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    click.echo(f"  ✅ 苗盘配置: {filepath}")


def _generate_weather_json(output_dir: str, days: int):
    """生成示例天气预报JSON"""
    import random
    
    filepath = os.path.join(output_dir, 'weather_forecast.json')
    
    forecast = []
    base_date = datetime.now().date()
    
    for i in range(days + 2):
        forecast_date = base_date + timedelta(days=i)
        
        is_cloudy = random.random() < 0.3
        cloud_cover = random.randint(60, 90) if is_cloudy else random.randint(10, 40)
        
        temp_avg = random.randint(18, 28)
        humidity = random.randint(50, 80)
        wind_speed = random.randint(1, 8)
        precipitation = random.randint(0, 80) if is_cloudy else 0
        
        forecast.append({
            'date': forecast_date.strftime('%Y-%m-%d'),
            'weather': '多云' if is_cloudy else '晴',
            'temp_avg': temp_avg,
            'temp_min': temp_avg - random.randint(3, 6),
            'temp_max': temp_avg + random.randint(3, 8),
            'humidity_avg': humidity,
            'cloud_cover': cloud_cover,
            'wind_speed': wind_speed,
            'precipitation': precipitation
        })
    
    output = {
        'generated_at': datetime.now().isoformat(),
        'description': '天气预报示例数据',
        'location': '温室所在地',
        'forecast': forecast
    }
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    click.echo(f"  ✅ 天气预报: {filepath}")


def _generate_inspection_json(output_dir: str, tray_count: int):
    """生成示例人工巡检JSON"""
    import random
    
    filepath = os.path.join(output_dir, 'inspection_notes.json')
    
    inspections = []
    
    base_time = datetime.now().replace(hour=9, minute=0, second=0)
    
    inspectors = ['张三', '李四', '王五']
    
    for i in range(1, tray_count + 1):
        tray_id = f'TRAY-{i:02d}'
        
        inspection_time = base_time - timedelta(hours=random.randint(0, 48))
        
        if i == 2:
            moisture = '干'
            appearance = '叶片轻微萎蔫'
            notes = '基质明显干燥，需要浇水'
            rating = 2
        elif i == 4:
            moisture = '过湿'
            appearance = '基质积水'
            notes = '基质过湿，建议减少浇水'
            rating = 2
        else:
            moisture = random.choice(['正常', '正常', '正常', '偏干'])
            appearance = random.choice(['生长正常', '叶色健康', '长势良好'])
            notes = ''
            rating = random.randint(4, 5)
        
        inspections.append({
            'timestamp': inspection_time.strftime('%Y-%m-%d %H:%M:%S'),
            'tray_id': tray_id,
            'inspector': random.choice(inspectors),
            'moisture': moisture,
            'appearance': appearance,
            'pest_disease': '否',
            'notes': notes,
            'rating': rating,
            'action_taken': '浇水' if i == 2 else ''
        })
    
    output = {
        'generated_at': datetime.now().isoformat(),
        'description': '人工巡检备注示例数据',
        'inspections': inspections
    }
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    click.echo(f"  ✅ 巡检记录: {filepath}")


def _run_analysis(sensor: str, trays: str, weather: Optional[str], 
                  inspection: Optional[str]) -> Dict:
    """内部函数：运行分析并返回结果"""
    sensor_parser = SensorParser()
    tray_parser = TrayParser()
    weather_parser = WeatherParser()
    inspection_parser = InspectionParser()
    
    dli_calculator = DLICalculator()
    et_calculator = EvapotranspirationCalculator()
    moisture_analyzer = MoistureAnalyzer()
    
    sensor_data = sensor_parser.parse(sensor)
    tray_data = tray_parser.parse(trays)
    
    weather_data = None
    if weather:
        try:
            weather_data = weather_parser.parse(weather)
        except Exception:
            pass
    
    inspection_data = None
    if inspection:
        try:
            inspection_data = inspection_parser.parse(inspection)
        except Exception:
            pass
    
    results = {
        'metadata': {
            'generated_at': datetime.now().isoformat()
        },
        'sensor_summary': sensor_parser.get_summary(),
        'tray_summary': tray_parser.get_summary(),
        'weather_summary': weather_parser.get_summary() if weather_data else {},
        'inspection_summary': inspection_parser.get_summary() if inspection_data else {},
        'trays': {}
    }
    
    tray_ids = sensor_parser.tray_ids
    
    for tray_id in tray_ids:
        tray_data_ind = sensor_parser.get_tray_data(tray_id)
        tray_requirements = tray_parser.get_variety_requirements(tray_id)
        
        daily_dli = dli_calculator.calculate_daily_dli(
            tray_data_ind['light_intensity'],
            tray_data_ind['timestamp']
        )
        
        moisture_analysis = moisture_analyzer.analyze_moisture_timeseries(
            tray_data_ind['moisture'],
            tray_data_ind['timestamp']
        )
        
        avg_temp = float(tray_data_ind['temperature'].mean())
        avg_humidity = float(tray_data_ind['humidity'].mean())
        
        et0 = None
        if weather_data:
            latest_date = max(item['date'] for item in weather_data) if weather_data else None
            if latest_date:
                et0 = weather_parser.estimate_potential_evapotranspiration(latest_date)
        
        if et0 is None:
            solar_radiation = 15.0
            et0 = et_calculator.calculate_et0(
                temperature=avg_temp,
                relative_humidity=avg_humidity,
                wind_speed=2.0,
                solar_radiation=solar_radiation
            )
        
        latest_dli = list(daily_dli.values())[-1] if daily_dli else 0
        
        tray_info = tray_parser.get_tray_info(tray_id)
        stage = tray_info.get('stage', '幼苗期') if tray_info else '幼苗期'
        kc = et_calculator.get_crop_coefficient(stage)
        
        results['trays'][tray_id] = {
            'info': tray_info,
            'requirements': tray_requirements,
            'dli_data': {
                'daily_dli': daily_dli,
                'latest_dli': round(latest_dli, 2),
                'weekly_stats': dli_calculator.calculate_weekly_stats(daily_dli)
            },
            'moisture_analysis': moisture_analysis,
            'et0_data': {
                'et0': round(et0, 2),
                'kc': kc,
                'avg_temperature': round(avg_temp, 1),
                'avg_humidity': round(avg_humidity, 1)
            },
            'inspection': {
                'latest': inspection_parser.get_latest_inspection(tray_id) if inspection_data else None,
                'has_watering_issue': inspection_parser.has_watering_issue_flag(tray_id) if inspection_data else False
            }
        }
    
    return results


def _reconstruct_risk_results(analysis_data: Dict, plan_data: Optional[Dict]) -> Dict:
    """从JSON数据重建风险评估结果"""
    from dataclasses import dataclass
    from typing import Dict, List
    
    @dataclass
    class SimpleRiskResult:
        tray_id: str
        overall_risk: str
        overall_score: int
        light_risk: Dict
        moisture_risk: Dict
        combined_risk: Dict
        warnings: List[str]
        recommendations: List[str]
    
    results = {}
    
    if plan_data and 'risk_results' in plan_data:
        for tray_id, data in plan_data['risk_results'].items():
            results[tray_id] = SimpleRiskResult(
                tray_id=tray_id,
                overall_risk=data.get('overall_risk', 'normal'),
                overall_score=data.get('overall_score', 5),
                light_risk=data.get('light_risk', {}),
                moisture_risk=data.get('moisture_risk', {}),
                combined_risk=data.get('combined_risk', {}),
                warnings=data.get('warnings', []),
                recommendations=data.get('recommendations', [])
            )
    else:
        risk_evaluator = RiskEvaluator()
        trays_data = analysis_data.get('trays', {})
        raw_results = risk_evaluator.batch_evaluate(trays_data)
        results = raw_results
    
    return results


def _reconstruct_action_plans(plan_data: Optional[Dict]) -> Dict:
    """从JSON数据重建行动计划"""
    from dataclasses import dataclass
    from typing import Dict, List
    
    @dataclass
    class SimpleActionPlan:
        tray_id: str
        light_actions: List[Dict]
        irrigation_actions: List[Dict]
        monitoring_actions: List[Dict]
        priority: str
        estimated_cost: float
    
    results = {}
    
    if plan_data and 'action_plans' in plan_data:
        for tray_id, data in plan_data['action_plans'].items():
            results[tray_id] = SimpleActionPlan(
                tray_id=tray_id,
                light_actions=data.get('light_actions', []),
                irrigation_actions=data.get('irrigation_actions', []),
                monitoring_actions=data.get('monitoring_actions', []),
                priority=data.get('priority', 'P3 - 正常'),
                estimated_cost=data.get('estimated_cost', 0.0)
            )
    
    return results


def _summarize_risks(risk_results: Dict) -> Dict:
    """汇总风险统计"""
    counts = {
        'critical': 0,
        'high': 0,
        'medium': 0,
        'normal': 0,
        'trays': []
    }
    
    for tray_id, result in risk_results.items():
        risk = result.overall_risk if hasattr(result, 'overall_risk') else 'normal'
        if risk in counts:
            counts[risk] += 1
        counts['trays'].append({
            'tray_id': tray_id,
            'overall_risk': risk,
            'overall_score': result.overall_score if hasattr(result, 'overall_score') else 5
        })
    
    return counts


if __name__ == '__main__':
    main()
