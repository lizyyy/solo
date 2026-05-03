"""
CLI模块 - 命令行接口
"""
import click
import os
from datetime import datetime
from typing import List, Optional

from bus_replay_diagnostic.parsers.csv_parser import CANCSVParser
from bus_replay_diagnostic.parsers.json_parser import SensorJSONParser
from bus_replay_diagnostic.parsers.yaml_parser import ControlYAMLParser
from bus_replay_diagnostic.clock_sync.synchronizer import ClockSynchronizer
from bus_replay_diagnostic.state_machine.node_state import StateMachineManager
from bus_replay_diagnostic.rules.rule_engine import RuleEngine, AnomalyType, AnomalySeverity
from bus_replay_diagnostic.player.replay_player import ReplayPlayer, InteractiveReplayController
from bus_replay_diagnostic.exporters.exporters import (
    ExportContext, ExporterManager, MarkdownExporter, CSVExporter, JSONExporter
)


@click.group()
@click.version_option(version='1.0.0')
@click.pass_context
def cli(ctx):
    """
    总线回放诊断台 - 无人车CAN总线日志分析工具
    
    用于导入、分析、回放和导出CAN总线日志数据
    """
    ctx.ensure_object(dict)
    ctx.obj['can_frames'] = []
    ctx.obj['sensor_data'] = []
    ctx.obj['control_commands'] = []
    ctx.obj['anomalies'] = []
    ctx.obj['state_transitions'] = []
    ctx.obj['synchronization_info'] = {}


@cli.command()
@click.option('--can', '-c', type=click.Path(exists=True), multiple=True,
              help='CAN帧日志CSV文件路径（可多次指定）')
@click.option('--sensor', '-s', type=click.Path(exists=True), multiple=True,
              help='传感器时间戳JSON文件路径（可多次指定）')
@click.option('--control', '-k', type=click.Path(exists=True), multiple=True,
              help='控制指令YAML文件路径（可多次指定）')
@click.pass_context
def import_logs(ctx, can, sensor, control):
    """
    导入多段日志文件
    
    支持导入CAN帧CSV、传感器JSON和控制指令YAML文件
    """
    click.echo("=== 导入日志 ===")
    
    # 导入CAN帧日志
    if can:
        can_parser = CANCSVParser()
        total_frames = 0
        
        for can_file in can:
            click.echo(f"导入CAN帧文件: {can_file}")
            try:
                frames = can_parser.parse_file(can_file)
                ctx.obj['can_frames'].extend(frames)
                total_frames += len(frames)
                click.echo(f"  成功导入 {len(frames)} 帧")
            except Exception as e:
                click.echo(f"  导入失败: {e}")
        
        click.echo(f"CAN帧总计: {total_frames} 帧")
    
    # 导入传感器数据
    if sensor:
        sensor_parser = SensorJSONParser()
        total_sensors = 0
        
        for sensor_file in sensor:
            click.echo(f"导入传感器文件: {sensor_file}")
            try:
                data = sensor_parser.parse_file(sensor_file)
                ctx.obj['sensor_data'].extend(data)
                total_sensors += len(data)
                click.echo(f"  成功导入 {len(data)} 条传感器数据")
            except Exception as e:
                click.echo(f"  导入失败: {e}")
        
        click.echo(f"传感器数据总计: {total_sensors} 条")
    
    # 导入控制指令
    if control:
        control_parser = ControlYAMLParser()
        total_commands = 0
        
        for control_file in control:
            click.echo(f"导入控制指令文件: {control_file}")
            try:
                commands = control_parser.parse_file(control_file)
                ctx.obj['control_commands'].extend(commands)
                total_commands += len(commands)
                click.echo(f"  成功导入 {len(commands)} 条控制指令")
            except Exception as e:
                click.echo(f"  导入失败: {e}")
        
        click.echo(f"控制指令总计: {total_commands} 条")
    
    # 显示导入统计
    click.echo("\n=== 导入统计 ===")
    click.echo(f"CAN帧数量: {len(ctx.obj['can_frames'])}")
    click.echo(f"传感器数据数量: {len(ctx.obj['sensor_data'])}")
    click.echo(f"控制指令数量: {len(ctx.obj['control_commands'])}")


@cli.command()
@click.pass_context
def validate(ctx):
    """
    校验帧顺序、时间漂移、丢帧、传感器与控制指令延迟
    
    对导入的数据进行完整性和一致性校验
    """
    click.echo("=== 数据校验 ===")
    
    can_frames = ctx.obj['can_frames']
    sensor_data = ctx.obj['sensor_data']
    control_commands = ctx.obj['control_commands']
    
    if not can_frames and not sensor_data and not control_commands:
        click.echo("没有数据可校验，请先使用 import 命令导入数据")
        return
    
    # 初始化规则引擎
    rule_engine = RuleEngine()
    
    # 校验CAN帧
    if can_frames:
        click.echo("\n--- 校验CAN帧 ---")
        
        # 检查帧顺序和丢帧
        click.echo("检查帧顺序和丢帧...")
        
        # 按时间排序
        sorted_frames = sorted(can_frames, key=lambda x: x.timestamp)
        
        # 使用规则引擎检测异常
        for frame in sorted_frames:
            rule_engine.process_data({
                "current_frame": frame,
                "source_name": "can_bus"
            })
        
        # 检查时间间隔
        if len(sorted_frames) > 1:
            intervals = []
            for i in range(1, len(sorted_frames)):
                interval = sorted_frames[i].timestamp - sorted_frames[i-1].timestamp
                intervals.append(interval)
            
            avg_interval = sum(intervals) / len(intervals)
            max_interval = max(intervals)
            min_interval = min(intervals)
            
            click.echo(f"平均帧间隔: {avg_interval:.6f}秒")
            click.echo(f"最大帧间隔: {max_interval:.6f}秒")
            click.echo(f"最小帧间隔: {min_interval:.6f}秒")
            
            # 检测潜在丢帧（间隔超过3倍平均间隔）
            threshold = avg_interval * 3.0
            potential_lost = sum(1 for i in intervals if i > threshold)
            if potential_lost > 0:
                click.echo(f"潜在丢帧位置: {potential_lost} 处")
    
    # 时钟同步分析
    click.echo("\n--- 时钟同步分析 ---")
    
    synchronizer = ClockSynchronizer()
    
    # 添加时间序列
    if can_frames:
        synchronizer.add_time_series("can_bus", [f.timestamp for f in can_frames])
    
    if sensor_data:
        synchronizer.add_time_series("sensors", [s.timestamp for s in sensor_data])
    
    if control_commands:
        synchronizer.add_time_series("control", [c.timestamp for c in control_commands])
    
    try:
        # 自动检测参考时钟
        ref_source = synchronizer.auto_detect_reference()
        click.echo(f"参考时钟源: {ref_source}")
        
        # 同步所有数据源
        sync_result = synchronizer.synchronize_all()
        ctx.obj['synchronization_info'] = {
            "reference_source": sync_result.reference_source,
            "synchronization_quality": sync_result.synchronization_quality,
            "time_range": sync_result.time_range,
            "drift_info": {}
        }
        
        click.echo(f"同步质量: {sync_result.synchronization_quality:.2%}")
        
        # 显示各数据源的漂移情况
        for source, info in sync_result.drift_info.items():
            ctx.obj['synchronization_info']['drift_info'][source] = {
                "source_name": info.source_name,
                "reference_name": info.reference_name,
                "total_drift": info.total_drift,
                "drift_rate": info.drift_rate,
                "max_drift": info.max_drift,
                "min_drift": info.min_drift,
                "average_drift": info.average_drift,
                "is_synchronized": info.is_synchronized
            }
            
            status = "✓ 已同步" if info.is_synchronized else "✗ 未同步"
            click.echo(f"  {source}: 平均漂移 {info.average_drift:.6f}秒, {status}")
            
    except Exception as e:
        click.echo(f"时钟同步分析失败: {e}")
    
    # 延迟分析（传感器到控制指令）
    if sensor_data and control_commands:
        click.echo("\n--- 延迟分析 ---")
        click.echo("分析传感器与控制指令之间的延迟...")
        
        # 使用规则引擎进行延迟分析
        for sensor in sensor_data:
            rule_engine.process_data({
                "sensor_data": sensor
            })
        
        for command in control_commands:
            rule_engine.process_data({
                "command_data": command
            })
    
    # 收集所有异常
    ctx.obj['anomalies'] = rule_engine.anomalies
    
    # 显示异常统计
    stats = rule_engine.get_statistics()
    click.echo(f"\n--- 异常统计 ---")
    click.echo(f"总异常数: {stats['total_anomalies']}")
    
    if stats['by_severity']:
        click.echo("按严重程度:")
        for severity, count in stats['by_severity'].items():
            click.echo(f"  {severity}: {count}")
    
    if stats['by_type']:
        click.echo("按异常类型:")
        for anomaly_type, count in stats['by_type'].items():
            click.echo(f"  {anomaly_type}: {count}")


@cli.command()
@click.pass_context
def state_machine(ctx):
    """
    按节点还原状态机
    
    分析CAN帧数据，还原各节点的状态机转换
    """
    click.echo("=== 状态机还原 ===")
    
    can_frames = ctx.obj['can_frames']
    
    if not can_frames:
        click.echo("没有CAN帧数据，请先使用 import 命令导入数据")
        return
    
    # 初始化状态机管理器
    state_machine_manager = StateMachineManager()
    
    # 创建所有预定义的状态机
    state_machine_manager.create_machine("powertrain")
    state_machine_manager.create_machine("steering")
    state_machine_manager.create_machine("perception")
    state_machine_manager.create_machine("navigation")
    
    click.echo("处理CAN帧，还原状态机...")
    
    # 按时间排序处理帧
    sorted_frames = sorted(can_frames, key=lambda x: x.timestamp)
    
    for frame in sorted_frames:
        result = state_machine_manager.process_can_frame(
            can_id=frame.can_id,
            data=frame.data,
            timestamp=frame.timestamp
        )
        
        # 记录状态转换
        if result['transitions']:
            for transition in result['transitions']:
                ctx.obj['state_transitions'].append(transition)
    
    # 显示状态机统计
    stats = state_machine_manager.get_statistics()
    click.echo(f"\n--- 状态机统计 ---")
    click.echo(f"总节点数: {stats['total_nodes']}")
    click.echo(f"总状态转换次数: {stats['total_transitions']}")
    
    for node_id, node_stats in stats['nodes'].items():
        click.echo(f"\n节点: {node_id}")
        click.echo(f"  当前状态: {node_stats['current_state']}")
        click.echo(f"  状态转换次数: {node_stats['transition_count']}")
        click.echo(f"  访问过的状态: {', '.join(node_stats['states_visited'])}")
        
        # 显示详细的状态转换历史
        history = state_machine_manager.get_state_history(node_id)
        if history:
            click.echo(f"  状态转换历史:")
            for i, transition in enumerate(history[-5:], 1):  # 只显示最近5次
                click.echo(f"    {i}. t={transition.timestamp:.6f}s: {transition.from_state} -> {transition.to_state} (触发: {transition.trigger})")


@cli.command()
@click.option('--start', '-s', type=float, help='回放开始时间（秒）')
@click.option('--end', '-e', type=float, help='回放结束时间（秒）')
@click.option('--interactive', '-i', is_flag=True, help='启动交互式回放模式')
@click.pass_context
def replay(ctx, start, end, interactive):
    """
    指定时间窗口回放
    
    支持按时间窗口回放数据，或启动交互式回放模式
    """
    click.echo("=== 数据回放 ===")
    
    can_frames = ctx.obj['can_frames']
    sensor_data = ctx.obj['sensor_data']
    control_commands = ctx.obj['control_commands']
    
    if not can_frames and not sensor_data and not control_commands:
        click.echo("没有数据可回放，请先使用 import 命令导入数据")
        return
    
    # 初始化回放器
    player = ReplayPlayer()
    player.load_data(
        can_frames=can_frames,
        sensor_data=sensor_data,
        control_commands=control_commands
    )
    
    # 显示数据时间范围
    time_range = player.get_time_range()
    click.echo(f"数据时间范围: {time_range[0]:.6f} - {time_range[1]:.6f} 秒")
    click.echo(f"数据持续时间: {time_range[1] - time_range[0]:.6f} 秒")
    
    # 设置回放窗口
    if start is not None or end is not None:
        if start is None:
            start = time_range[0]
        if end is None:
            end = time_range[1]
        
        try:
            player.set_playback_window(start, end)
            click.echo(f"设置回放窗口: {start:.6f} - {end:.6f} 秒")
        except ValueError as e:
            click.echo(f"设置回放窗口失败: {e}")
            return
    
    # 交互式回放模式
    if interactive:
        click.echo("\n启动交互式回放模式...")
        controller = InteractiveReplayController(player)
        controller.start_interactive_mode()
    else:
        # 简单回放模式
        click.echo("\n开始回放...")
        
        # 设置回调
        events_count = {'can': 0, 'sensor': 0, 'command': 0}
        
        def on_can_frame(frame):
            events_count['can'] += 1
            click.echo(f"[CAN] t={frame.timestamp:.6f}s, ID=0x{frame.can_id:X}")
        
        def on_sensor_data(sensor):
            events_count['sensor'] += 1
            click.echo(f"[SENSOR] t={sensor.timestamp:.6f}s, ID={sensor.sensor_id}")
        
        def on_control_command(command):
            events_count['command'] += 1
            click.echo(f"[COMMAND] t={command.timestamp:.6f}s, ID={command.command_id}")
        
        player.on_can_frame = on_can_frame
        player.on_sensor_data = on_sensor_data
        player.on_control_command = on_control_command
        
        # 开始回放
        player.play()
        while player.state.value == 'playing' and player.event_heap:
            player.step_forward(1)
        
        # 显示回放统计
        click.echo(f"\n回放完成:")
        click.echo(f"  CAN帧: {events_count['can']} 个")
        click.echo(f"  传感器数据: {events_count['sensor']} 个")
        click.echo(f"  控制指令: {events_count['command']} 个")


@cli.command()
@click.option('--output', '-o', type=click.Path(), default='./diagnostic_output',
              help='输出目录路径')
@click.option('--project', '-p', default='未命名项目', help='项目名称')
@click.option('--format', '-f', type=click.Choice(['all', 'markdown', 'csv', 'json']),
              default='all', help='导出格式')
@click.pass_context
def export(ctx, output, project, format):
    """
    导出Markdown故障报告、CSV异常片段和JSON审计包
    
    支持多种导出格式，可选择导出全部或指定格式
    """
    click.echo("=== 导出分析结果 ===")
    
    # 准备导出上下文
    context = ExportContext(
        project_name=project,
        analysis_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        total_frames=len(ctx.obj['can_frames']),
        total_sensors=len(ctx.obj['sensor_data']),
        total_commands=len(ctx.obj['control_commands']),
        anomalies=ctx.obj['anomalies'],
        state_transitions=ctx.obj['state_transitions'],
        synchronization_info=ctx.obj['synchronization_info']
    )
    
    # 计算时间范围
    all_times = []
    if ctx.obj['can_frames']:
        all_times.extend([f.timestamp for f in ctx.obj['can_frames']])
    if ctx.obj['sensor_data']:
        all_times.extend([s.timestamp for s in ctx.obj['sensor_data']])
    if ctx.obj['control_commands']:
        all_times.extend([c.timestamp for c in ctx.obj['control_commands']])
    
    if all_times:
        context.time_range = {
            'start': min(all_times),
            'end': max(all_times),
            'duration': max(all_times) - min(all_times)
        }
    
    # 确保输出目录存在
    os.makedirs(output, exist_ok=True)
    
    # 根据格式导出
    if format in ['all', 'markdown']:
        markdown_path = os.path.join(output, 'diagnostic_report.md')
        markdown_exporter = MarkdownExporter()
        markdown_exporter.export(context, markdown_path)
    
    if format in ['all', 'csv']:
        csv_path = os.path.join(output, 'anomalies.csv')
        csv_exporter = CSVExporter()
        csv_exporter.export(ctx.obj['anomalies'], csv_path)
    
    if format in ['all', 'json']:
        json_path = os.path.join(output, 'audit_package.json')
        json_exporter = JSONExporter()
        json_exporter.export(context, json_path, include_raw_data=True)
    
    click.echo(f"\n导出完成! 输出目录: {output}")


@cli.command()
@click.option('--can', '-c', type=click.Path(exists=True), multiple=True,
              help='CAN帧日志CSV文件路径')
@click.option('--sensor', '-s', type=click.Path(exists=True), multiple=True,
              help='传感器时间戳JSON文件路径')
@click.option('--control', '-k', type=click.Path(exists=True), multiple=True,
              help='控制指令YAML文件路径')
@click.option('--output', '-o', type=click.Path(), default='./diagnostic_output',
              help='输出目录路径')
@click.option('--project', '-p', default='未命名项目', help='项目名称')
@click.option('--interactive', '-i', is_flag=True, help='启动交互式回放模式')
@click.pass_context
def analyze(ctx, can, sensor, control, output, project, interactive):
    """
    一键分析：导入->校验->状态机->导出
    
    执行完整的分析流程，包括导入数据、校验、状态机还原和导出结果
    """
    click.echo("=" * 50)
    click.echo("  总线回放诊断台 - 一键分析模式")
    click.echo("=" * 50)
    
    # 1. 导入数据
    click.echo("\n[1/5] 导入数据...")
    ctx.invoke(import_logs, can=can, sensor=sensor, control=control)
    
    # 检查是否有数据
    if not ctx.obj['can_frames'] and not ctx.obj['sensor_data'] and not ctx.obj['control_commands']:
        click.echo("\n错误: 没有导入任何数据")
        return
    
    # 2. 校验数据
    click.echo("\n[2/5] 校验数据...")
    ctx.invoke(validate)
    
    # 3. 状态机还原
    click.echo("\n[3/5] 状态机还原...")
    if ctx.obj['can_frames']:
        ctx.invoke(state_machine)
    else:
        click.echo("跳过状态机还原（没有CAN帧数据）")
    
    # 4. 回放（可选交互式）
    click.echo("\n[4/5] 数据回放...")
    if interactive:
        ctx.invoke(replay, start=None, end=None, interactive=True)
    else:
        click.echo("跳过交互式回放（使用 --interactive 选项启用）")
    
    # 5. 导出结果
    click.echo("\n[5/5] 导出结果...")
    ctx.invoke(export, output=output, project=project, format='all')
    
    click.echo("\n" + "=" * 50)
    click.echo("  分析完成!")
    click.echo("=" * 50)


if __name__ == '__main__':
    cli(obj={})
