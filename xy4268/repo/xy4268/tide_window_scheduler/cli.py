"""
潮窗靠泊推演器 - CLI主程序入口
"""
import click
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from .models import Ship, Berth, Tug, TidalRecord
from .data import TideReader, ShipReader, BerthReader, TugReader
from .core import TideInterpolator, ScheduleGenerator, ConflictDetector
from .output import JsonExporter, MarkdownExporter


@click.group()
@click.version_option(version='0.1.0', prog_name='tide-scheduler')
def main():
    """
    潮窗靠泊推演器 - 小港口调度员专用本地工具
    
    功能：
    - 读取潮汐表CSV、船舶吃水/货重JSON、泊位限制YAML和拖轮可用时段
    - 插值计算安全进出港潮窗
    - 排出候选靠离泊计划
    - 标明吃水、潮高、泊位冲突和拖轮冲突原因
    - 导出Markdown调度单和JSON机器可读结果
    """
    pass


@main.command()
@click.option('--tide-csv', '-t', required=True, type=click.Path(exists=True),
              help='潮汐表CSV文件路径')
@click.option('--ships-json', '-s', required=True, type=click.Path(exists=True),
              help='船舶吃水/货重JSON文件路径')
@click.option('--berths-yaml', '-b', required=True, type=click.Path(exists=True),
              help='泊位限制YAML文件路径')
@click.option('--tugs-json', '-g', required=True, type=click.Path(exists=True),
              help='拖轮可用时段JSON文件路径')
@click.option('--start-date', '-sd', type=str, default=None,
              help='计划开始日期 (格式: YYYY-MM-DD)，默认为今天')
@click.option('--end-date', '-ed', type=str, default=None,
              help='计划结束日期 (格式: YYYY-MM-DD)，默认为开始日期后7天')
@click.option('--safety-margin', '-m', type=float, default=0.3,
              help='安全余量 (米)，默认0.3米')
@click.option('--output-dir', '-o', type=click.Path(), default='.',
              help='输出目录路径，默认为当前目录')
@click.option('--output-name', '-n', type=str, default=None,
              help='输出文件名前缀，默认为 "schedule_YYYYMMDD_HHMMSS"')
@click.option('--verbose', '-v', is_flag=True, default=False,
              help='显示详细输出信息')
def generate(
    tide_csv: str,
    ships_json: str,
    berths_yaml: str,
    tugs_json: str,
    start_date: Optional[str],
    end_date: Optional[str],
    safety_margin: float,
    output_dir: str,
    output_name: Optional[str],
    verbose: bool
):
    """
    生成靠离泊计划
    
    读取输入数据，计算潮窗，生成候选计划，检测冲突，并导出结果。
    """
    click.echo('🚢 潮窗靠泊推演器 - 开始生成靠离泊计划...')
    click.echo('')
    
    # 解析日期
    try:
        if start_date:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        else:
            start_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        if end_date:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        else:
            end_dt = start_dt + timedelta(days=7)
        
        # 设置时间为整天
        start_dt = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
    except ValueError as e:
        click.echo(f'❌ 日期格式错误: {e}', err=True)
        click.echo('   请使用格式: YYYY-MM-DD (例如: 2026-05-03)', err=True)
        return
    
    if verbose:
        click.echo(f'📅 计划日期范围: {start_dt.strftime("%Y-%m-%d")} 至 {end_dt.strftime("%Y-%m-%d")}')
        click.echo(f'🔒 安全余量: {safety_margin}米')
        click.echo('')
    
    # 读取输入数据
    click.echo('📂 读取输入数据...')
    
    try:
        # 读取潮汐表
        if verbose:
            click.echo(f'   读取潮汐表: {tide_csv}')
        tidal_records = TideReader.read_csv(tide_csv)
        if verbose:
            click.echo(f'   ✓ 成功读取 {len(tidal_records)} 条潮汐记录')
        
        # 读取船舶数据
        if verbose:
            click.echo(f'   读取船舶数据: {ships_json}')
        ships = ShipReader.read_json(ships_json)
        if verbose:
            click.echo(f'   ✓ 成功读取 {len(ships)} 艘船舶信息')
        
        # 读取泊位数据
        if verbose:
            click.echo(f'   读取泊位数据: {berths_yaml}')
        berths = BerthReader.read_yaml(berths_yaml)
        if verbose:
            click.echo(f'   ✓ 成功读取 {len(berths)} 个泊位信息')
        
        # 读取拖轮数据
        if verbose:
            click.echo(f'   读取拖轮数据: {tugs_json}')
        tugs = TugReader.read_json(tugs_json)
        if verbose:
            click.echo(f'   ✓ 成功读取 {len(tugs)} 艘拖轮信息')
        
    except Exception as e:
        click.echo(f'❌ 读取输入数据失败: {e}', err=True)
        return
    
    click.echo('✓ 输入数据读取完成')
    click.echo('')
    
    # 创建潮汐插值器
    click.echo('🌊 计算潮汐插值和安全潮窗...')
    
    try:
        tide_interpolator = TideInterpolator(tidal_records)
        if verbose:
            click.echo('   ✓ 潮汐插值器创建成功')
        
    except Exception as e:
        click.echo(f'❌ 创建潮汐插值器失败: {e}', err=True)
        return
    
    # 生成候选计划
    click.echo('📋 生成候选靠离泊计划...')
    
    try:
        schedule_generator = ScheduleGenerator(
            ships=ships,
            berths=berths,
            tugs=tugs,
            tide_interpolator=tide_interpolator,
            safety_margin=safety_margin
        )
        
        schedules = schedule_generator.generate_candidate_schedules(
            start_date=start_dt,
            end_date=end_dt
        )
        
        if verbose:
            click.echo(f'   ✓ 成功生成 {len(schedules)} 个候选计划')
        
    except Exception as e:
        click.echo(f'❌ 生成候选计划失败: {e}', err=True)
        return
    
    click.echo('✓ 候选计划生成完成')
    click.echo('')
    
    # 检测冲突
    click.echo('⚠️  检测泊位和拖轮冲突...')
    
    try:
        conflict_detector = ConflictDetector()
        conflicts = conflict_detector.detect_all_conflicts(schedules)
        
        if verbose:
            click.echo(f'   ✓ 检测到 {len(conflicts)} 个冲突')
        
    except Exception as e:
        click.echo(f'❌ 检测冲突失败: {e}', err=True)
        return
    
    click.echo('✓ 冲突检测完成')
    click.echo('')
    
    # 生成输出文件名
    if output_name:
        base_name = output_name
    else:
        base_name = f'schedule_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
    
    # 确保输出目录存在
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # 导出JSON结果
    click.echo('💾 导出结果...')
    
    try:
        json_file = output_path / f'{base_name}.json'
        JsonExporter.export(
            schedules=schedules,
            conflicts=conflicts,
            ships=ships,
            berths=berths,
            tugs=tugs,
            tidal_records=tidal_records,
            output_path=str(json_file),
            metadata={
                'start_date': start_dt.strftime('%Y-%m-%d'),
                'end_date': end_dt.strftime('%Y-%m-%d'),
                'safety_margin': safety_margin
            }
        )
        
        if verbose:
            click.echo(f'   ✓ JSON结果已导出: {json_file}')
        
    except Exception as e:
        click.echo(f'❌ 导出JSON结果失败: {e}', err=True)
        return
    
    # 导出Markdown调度单
    try:
        md_file = output_path / f'{base_name}.md'
        MarkdownExporter.export(
            schedules=schedules,
            conflicts=conflicts,
            ships=ships,
            berths=berths,
            tugs=tugs,
            tidal_records=tidal_records,
            output_path=str(md_file),
            metadata={
                'start_date': start_dt.strftime('%Y-%m-%d'),
                'end_date': end_dt.strftime('%Y-%m-%d'),
                'safety_margin': safety_margin
            }
        )
        
        if verbose:
            click.echo(f'   ✓ Markdown调度单已导出: {md_file}')
        
    except Exception as e:
        click.echo(f'❌ 导出Markdown调度单失败: {e}', err=True)
        return
    
    click.echo('✓ 结果导出完成')
    click.echo('')
    
    # 显示摘要
    click.echo('📊 执行摘要:')
    click.echo('-' * 40)
    
    total_schedules = len(schedules)
    feasible = sum(1 for s in schedules if s.is_feasible)
    infeasible = total_schedules - feasible
    
    click.echo(f'总计划数: {total_schedules}')
    click.echo(f'可行计划: {feasible}')
    click.echo(f'不可行计划: {infeasible}')
    click.echo(f'冲突数量: {len(conflicts)}')
    
    if conflicts:
        # 按严重程度统计
        critical = sum(1 for c in conflicts if c.severity == 'critical')
        high = sum(1 for c in conflicts if c.severity == 'high')
        click.echo(f'  - 关键冲突 (CRITICAL): {critical}')
        click.echo(f'  - 高优先级冲突 (HIGH): {high}')
        click.echo(f'  - 其他冲突: {len(conflicts) - critical - high}')
    
    click.echo('-' * 40)
    click.echo('')
    click.echo(f'✅ 靠离泊计划生成完成！')
    click.echo(f'   输出文件:')
    click.echo(f'   - JSON结果: {json_file}')
    click.echo(f'   - Markdown调度单: {md_file}')


if __name__ == '__main__':
    main()
