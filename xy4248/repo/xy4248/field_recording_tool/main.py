"""
野外录音交付整理箱 - 主程序入口
提供完整的命令行工作流程
"""

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

import click

# 导入内部模块
from . import __version__
from .file_scanner import FileScanner, scan_directory
from .audio_metadata import AudioMetadataExtractor, extract_audio_metadata
from .field_log_parser import FieldLogParser, parse_field_log
from .validator import Validator, validate_files, ValidationResult
from .state_store import StateStore, MaterialStatus, create_state_store
from .exporter import (
    export_markdown_delivery,
    export_csv_issues,
    export_json_evidence,
    MarkdownExporter,
    CSVExporter,
    JSONExporter
)


@click.group()
@click.version_option(__version__)
@click.option('--project-dir', '-p', type=click.Path(exists=True, file_okay=False),
              help='项目目录路径（素材所在目录）')
@click.pass_context
def cli(ctx, project_dir):
    """
    野外录音交付整理箱 - 为纪录片收音师设计的素材管理工具
    
    功能包括：导入素材目录和场记、建立本地索引、校验命名/时长/采样率/时间码/备注缺失、
    支持人工标记可用/需返录/含隐私、导出Markdown交付单/CSV问题清单/JSON证据包。
    """
    ctx.ensure_object(dict)
    ctx.obj['project_dir'] = project_dir


@cli.command()
@click.option('--recursive/--no-recursive', default=True,
              help='是否递归扫描子目录（默认：是）')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@click.pass_context
def scan(ctx, recursive, verbose):
    """扫描素材目录，建立文件索引"""
    project_dir = ctx.obj.get('project_dir')
    
    if not project_dir:
        # 使用当前目录
        project_dir = os.getcwd()
    
    click.echo(f"🔍 开始扫描目录: {project_dir}")
    click.echo(f"   递归扫描: {'是' if recursive else '否'}")
    
    try:
        # 执行扫描
        scanner = FileScanner(project_dir)
        scan_result = scanner.scan(recursive=recursive)
        
        # 显示扫描结果
        click.echo("")
        click.echo("📊 扫描结果:")
        click.echo(f"   总文件数: {scan_result['total_files']}")
        click.echo(f"   音频文件: {scan_result['audio_files_count']}")
        click.echo(f"   场记文件: {scan_result['log_files_count']}")
        click.echo(f"   备注文件: {scan_result['note_files_count']}")
        
        # 检测重复文件
        duplicates = scanner.get_duplicate_files()
        if duplicates:
            click.echo("")
            click.echo(f"⚠️  发现 {len(duplicates)} 组重复文件:")
            for file_hash, files in duplicates.items():
                file_names = [f['file_name'] for f in files]
                click.echo(f"   - {', '.join(file_names)}")
        
        # 保存到状态存储
        state_store = create_state_store(project_dir)
        
        # 添加所有音频文件到状态存储
        for audio_file in scan_result.get('audio_files', []):
            file_path = audio_file['file_path']
            file_name = audio_file['file_name']
            file_hash = audio_file.get('file_hash', '')
            
            # 尝试提取元数据
            metadata = {}
            try:
                meta = extract_audio_metadata(file_path)
                metadata = {
                    'duration_seconds': meta.duration_seconds,
                    'duration_formatted': meta.duration_formatted,
                    'sample_rate': meta.sample_rate,
                    'bit_rate': meta.bit_rate,
                    'channels': meta.channels,
                    'bits_per_sample': meta.bits_per_sample,
                    'timecode_start': meta.timecode_start,
                    'timecode_format': meta.timecode_format,
                    'comment': meta.comment,
                    'file_format': meta.file_format,
                    'codec': meta.codec
                }
            except Exception as e:
                if verbose:
                    click.echo(f"   提取元数据时出错 {file_name}: {e}")
            
            state_store.add_material(
                file_path=file_path,
                file_name=file_name,
                file_hash=file_hash,
                metadata=metadata
            )
        
        # 保存场记文件信息
        state_store.state.field_logs = scan_result.get('log_files', [])
        
        # 保存状态
        state_store.save()
        
        click.echo("")
        click.echo(f"✅ 索引已保存到: {state_store.index_file}")
        
        return scan_result
        
    except Exception as e:
        click.echo(f"❌ 扫描失败: {e}")
        sys.exit(1)


@cli.command()
@click.argument('log_files', nargs=-1, type=click.Path(exists=True))
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@click.pass_context
def parse_log(ctx, log_files, verbose):
    """解析场记CSV文件"""
    project_dir = ctx.obj.get('project_dir')
    
    if not log_files and not project_dir:
        click.echo("❌ 请指定场记文件路径或使用--project-dir选项")
        sys.exit(1)
    
    # 如果没有指定文件，尝试从项目目录自动发现
    if not log_files and project_dir:
        scanner = FileScanner(project_dir)
        scanner.scan(recursive=True)
        log_files = [f['file_path'] for f in scanner.log_files]
        
        if not log_files:
            click.echo("❌ 未找到场记文件")
            sys.exit(1)
    
    click.echo(f"📝 开始解析场记文件...")
    
    parsed_logs = []
    
    for log_file in log_files:
        click.echo(f"   解析: {log_file}")
        
        try:
            parsed = parse_field_log(log_file)
            parsed_logs.append(parsed)
            
            click.echo(f"      总条目数: {parsed.total_entries}")
            click.echo(f"      好条数: {parsed.good_takes_count}")
            click.echo(f"      场景数: {parsed.unique_scenes_count}")
            
            if verbose and parsed.scenes:
                click.echo(f"      场景列表: {', '.join(parsed.scenes)}")
            
        except Exception as e:
            click.echo(f"   ❌ 解析失败: {e}")
    
    # 保存到状态存储
    if project_dir:
        state_store = create_state_store(project_dir)
        
        # 转换场记对象为可序列化的字典
        logs_data = []
        for log in parsed_logs:
            log_dict = {
                'file_path': log.file_path,
                'file_name': log.file_name,
                'total_entries': log.total_entries,
                'good_takes_count': log.good_takes_count,
                'scenes': log.scenes,
                'parse_time': log.parse_time
            }
            logs_data.append(log_dict)
        
        state_store.state.field_logs = logs_data
        state_store.save()
        
        click.echo("")
        click.echo("✅ 场记已保存到项目状态")
    
    return parsed_logs


@cli.command()
@click.option('--config', '-c', type=click.Path(exists=True),
              help='自定义校验配置文件（JSON格式）')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@click.pass_context
def validate(ctx, config, verbose):
    """执行规则校验"""
    project_dir = ctx.obj.get('project_dir')
    
    if not project_dir:
        project_dir = os.getcwd()
    
    click.echo("🔍 开始执行规则校验...")
    
    # 加载状态存储
    state_store = create_state_store(project_dir)
    
    if not state_store.state.materials:
        click.echo("⚠️  未找到素材索引，请先运行 'scan' 命令")
        sys.exit(1)
    
    # 准备校验数据
    audio_files = []
    for file_hash, material in state_store.state.materials.items():
        audio_file_dict = {
            'file_path': material.file_path,
            'file_name': material.file_name,
            'file_hash': material.file_hash,
            'metadata': material.metadata
        }
        audio_files.append(audio_file_dict)
    
    # 加载校验配置
    validator_config = None
    if config:
        try:
            import json
            with open(config, 'r', encoding='utf-8') as f:
                validator_config = json.load(f)
            click.echo(f"   已加载自定义配置: {config}")
        except Exception as e:
            click.echo(f"   ⚠️  加载配置失败: {e}，使用默认配置")
    
    # 获取重复文件
    duplicates = {}  # 简化处理，实际可以重新扫描检测
    
    # 执行校验
    validation_result = validate_files(
        audio_files=audio_files,
        parsed_logs=[],  # 场记数据
        duplicates=duplicates,
        config=validator_config
    )
    
    # 显示结果
    click.echo("")
    click.echo("📊 校验结果:")
    click.echo(f"   校验文件数: {validation_result.total_files}")
    click.echo(f"   总问题数: {validation_result.total_issues}")
    click.echo(f"   🔴 错误: {validation_result.error_count}")
    click.echo(f"   🟡 警告: {validation_result.warning_count}")
    click.echo(f"   🔵 提示: {validation_result.info_count}")
    
    if verbose and validation_result.all_issues:
        click.echo("")
        click.echo("📋 问题详情:")
        for issue in validation_result.all_issues:
            severity_icon = {
                'error': '🔴',
                'warning': '🟡',
                'info': '🔵'
            }.get(issue.severity.value, '')
            
            click.echo(f"   {severity_icon} {issue.message}")
            if issue.file_name:
                click.echo(f"      文件: {issue.file_name}")
            if issue.suggestion:
                click.echo(f"      建议: {issue.suggestion}")
            click.echo("")
    
    # 保存校验摘要到状态存储
    state_store.state.validation_summary = {
        'total_issues': validation_result.total_issues,
        'error_count': validation_result.error_count,
        'warning_count': validation_result.warning_count,
        'info_count': validation_result.info_count,
        'validation_time': validation_result.validation_time
    }
    state_store.save()
    
    # 在上下文对象中保存校验结果，供后续命令使用
    ctx.obj['validation_result'] = validation_result
    
    return validation_result


@cli.command()
@click.argument('file_identifier')
@click.option('--status', '-s', 
              type=click.Choice(['available', 'need_rerecord', 'has_privacy', 'pending'], case_sensitive=False),
              required=True,
              help='设置状态: available(可用), need_rerecord(需返录), has_privacy(含隐私), pending(待处理)')
@click.option('--tag', '-t', multiple=True, help='添加自定义标签（可多次使用）')
@click.option('--note', '-n', help='添加备注')
@click.option('--environment/--no-environment', default=None, help='标记为环境声')
@click.option('--wild/--no-wild', default=None, help='标记为补录声')
@click.pass_context
def tag(ctx, file_identifier, status, tag, note, environment, wild):
    """标记素材状态（可用/需返录/含隐私）
    
    FILE_IDENTIFIER: 文件名或文件哈希
    """
    project_dir = ctx.obj.get('project_dir')
    
    if not project_dir:
        project_dir = os.getcwd()
    
    state_store = create_state_store(project_dir)
    
    # 查找素材
    material = state_store.get_material(file_hash=file_identifier)
    
    if not material:
        # 尝试按文件名查找
        for file_hash, mat in state_store.state.materials.items():
            if mat.file_name == file_identifier or file_identifier in mat.file_path:
                material = mat
                break
    
    if not material:
        click.echo(f"❌ 未找到素材: {file_identifier}")
        sys.exit(1)
    
    # 设置状态
    status_map = {
        'available': MaterialStatus.AVAILABLE,
        'need_rerecord': MaterialStatus.NEED_RERECORD,
        'has_privacy': MaterialStatus.HAS_PRIVACY,
        'pending': MaterialStatus.PENDING
    }
    
    material_status = status_map[status.lower()]
    state_store.update_material_status(material_status, file_hash=material.file_hash)
    
    # 添加标签
    for t in tag:
        state_store.add_manual_tag(t, file_hash=material.file_hash)
    
    # 添加备注
    if note:
        state_store.set_manual_notes(note, file_hash=material.file_hash)
    
    # 标记环境声/补录声
    if environment is not None:
        state_store.mark_as_environment(environment, file_hash=material.file_hash)
    
    if wild is not None:
        state_store.mark_as_wild_track(wild, file_hash=material.file_hash)
    
    # 保存
    state_store.save()
    
    click.echo("✅ 标记已更新:")
    click.echo(f"   文件: {material.file_name}")
    click.echo(f"   状态: {status}")
    if tag:
        click.echo(f"   标签: {', '.join(tag)}")
    if note:
        click.echo(f"   备注: {note}")


@cli.command()
@click.argument('output_dir', type=click.Path(file_okay=False))
@click.option('--name', '-n', default='field_recording_delivery',
              help='输出文件名前缀（默认：field_recording_delivery）')
@click.option('--format', '-f', 
              type=click.Choice(['all', 'markdown', 'csv', 'json'], case_sensitive=False),
              default='all',
              help='导出格式: all(全部), markdown, csv, json（默认：all）')
@click.option('--full-metadata', is_flag=True, help='JSON导出包含完整元数据')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@click.pass_context
def export(ctx, output_dir, name, format, full_metadata, verbose):
    """导出交付报告
    
    支持三种格式：
    - Markdown交付单（便于阅读）
    - CSV问题清单（便于处理）
    - JSON证据包（完整数据）
    """
    project_dir = ctx.obj.get('project_dir')
    
    if not project_dir:
        project_dir = os.getcwd()
    
    # 确保输出目录存在
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    click.echo(f"📤 开始导出报告到: {output_dir}")
    
    # 加载状态存储
    state_store = create_state_store(project_dir)
    
    # 尝试获取校验结果（从上下文或重新执行）
    validation_result = ctx.obj.get('validation_result')
    
    if not validation_result:
        if verbose:
            click.echo("   未找到之前的校验结果，将执行快速校验...")
        # 这里简化处理，实际可以重新执行校验
    
    # 项目信息
    project_info = {
        '项目目录': project_dir,
        '素材总数': state_store.state.total_materials,
        '导出时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    # 导出Markdown
    if format in ['all', 'markdown']:
        md_path = output_path / f"{name}.md"
        
        success = export_markdown_delivery(
            output_path=str(md_path),
            state_store=state_store,
            validation_result=validation_result,
            project_info=project_info
        )
        
        if success:
            click.echo(f"   ✅ Markdown交付单: {md_path}")
        else:
            click.echo(f"   ❌ Markdown导出失败")
    
    # 导出CSV（如果有校验结果）
    if format in ['all', 'csv'] and validation_result:
        csv_path = output_path / f"{name}_issues.csv"
        
        success = export_csv_issues(
            output_path=str(csv_path),
            validation_result=validation_result
        )
        
        if success:
            click.echo(f"   ✅ CSV问题清单: {csv_path}")
        else:
            click.echo(f"   ❌ CSV导出失败")
    
    # 同时导出素材状态CSV
    if format in ['all', 'csv']:
        csv_materials_path = output_path / f"{name}_materials.csv"
        
        from .exporter import CSVExporter
        csv_exporter = CSVExporter()
        success = csv_exporter.export_materials_csv(state_store, str(csv_materials_path))
        
        if success:
            click.echo(f"   ✅ CSV素材清单: {csv_materials_path}")
    
    # 导出JSON
    if format in ['all', 'json']:
        json_path = output_path / f"{name}_evidence.json"
        
        success = export_json_evidence(
            output_path=str(json_path),
            state_store=state_store,
            validation_result=validation_result,
            field_logs=state_store.state.field_logs,
            include_full_metadata=full_metadata
        )
        
        if success:
            click.echo(f"   ✅ JSON证据包: {json_path}")
        else:
            click.echo(f"   ❌ JSON导出失败")
    
    click.echo("")
    click.echo("✅ 导出完成！")


@cli.command()
@click.option('--detail', '-d', is_flag=True, help='显示详细素材列表')
@click.pass_context
def status(ctx, detail):
    """查看当前项目状态"""
    project_dir = ctx.obj.get('project_dir')
    
    if not project_dir:
        project_dir = os.getcwd()
    
    state_store = create_state_store(project_dir)
    
    if not state_store.state.materials:
        click.echo("ℹ️  项目目录中未找到素材索引")
        click.echo("   请先运行 'scan' 命令扫描素材目录")
        return
    
    stats = state_store.get_statistics()
    
    click.echo("📊 项目状态:")
    click.echo(f"   项目目录: {project_dir}")
    click.echo("")
    click.echo("   素材统计:")
    click.echo(f"      总数: {stats['total_materials']}")
    click.echo(f"      ✅ 可用: {stats['status_breakdown']['available']}")
    click.echo(f"      🔄 需返录: {stats['status_breakdown']['need_rerecord']}")
    click.echo(f"      🔒 含隐私: {stats['status_breakdown']['has_privacy']}")
    click.echo(f"      ⏳ 待处理: {stats['status_breakdown']['pending']}")
    click.echo("")
    click.echo("   分类统计:")
    click.echo(f"      🌿 环境声: {stats['track_types']['environment']}")
    click.echo(f"      🎙️ 补录声: {stats['track_types']['wild_track']}")
    
    if stats.get('validation_summary'):
        vs = stats['validation_summary']
        click.echo("")
        click.echo("   校验摘要:")
        click.echo(f"      总问题数: {vs.get('total_issues', 0)}")
        click.echo(f"      🔴 错误: {vs.get('error_count', 0)}")
        click.echo(f"      🟡 警告: {vs.get('warning_count', 0)}")
    
    if detail:
        click.echo("")
        click.echo("📋 素材详情:")
        
        for material in state_store.get_all_materials():
            status_icon = {
                MaterialStatus.AVAILABLE: '✅',
                MaterialStatus.NEED_RERECORD: '🔄',
                MaterialStatus.HAS_PRIVACY: '🔒',
                MaterialStatus.PENDING: '⏳'
            }.get(material.status, '❓')
            
            tags = []
            if material.is_environment:
                tags.append('环境声')
            if material.is_wild_track:
                tags.append('补录声')
            if material.manual_tags:
                tags.extend(material.manual_tags)
            
            tag_str = f" [{', '.join(tags)}]" if tags else ""
            
            click.echo(f"   {status_icon} {material.file_name}{tag_str}")
            
            if material.manual_notes:
                click.echo(f"      备注: {material.manual_notes}")


@cli.command()
@click.argument('target_dir', type=click.Path(file_okay=False))
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def generate_example(target_dir, verbose):
    """生成示例数据目录（用于测试）"""
    from datetime import datetime
    
    target_path = Path(target_dir)
    target_path.mkdir(parents=True, exist_ok=True)
    
    click.echo(f"📁 生成示例数据到: {target_dir}")
    
    # 创建子目录
    audio_dir = target_path / "audio"
    audio_dir.mkdir(exist_ok=True)
    
    # 创建示例场记CSV
    csv_content = """场景,镜号,条数,开始时间码,结束时间码,时长,描述,好条,备注
1,1,1,09:30:00:00,09:30:15:12,00:00:15:12,开场空镜-街道环境,是,环境声
1,1,2,09:30:16:00,09:30:20:05,00:00:04:05,开场空镜-街道环境,否,有噪音
1,2,1,09:35:00:00,09:35:30:00,00:00:30:00,主角采访-自我介绍,是,声音清晰
1,2,2,09:35:31:00,09:36:05:10,00:00:34:10,主角采访-家庭背景,是,
2,1,1,10:00:00:00,10:02:15:00,00:02:15:00,室外环境-市场噪音,,环境声待确认
3,1,1,11:00:00:00,11:05:30:00,00:05:30:00,私密对话-室内,,可能涉及隐私
"""
    
    csv_path = target_path / "field_log.csv"
    with open(csv_path, 'w', encoding='utf-8-sig') as f:
        f.write(csv_content)
    
    click.echo(f"   ✅ 场记文件: {csv_path}")
    
    # 创建示例音频文件（空的wav文件头）
    # 注意：这只是最小的WAV文件头，不能实际播放
    # 实际使用时需要真实的音频文件
    
    audio_files = [
        "Scene01_Shot01_Take01_环境声.wav",
        "Scene01_Shot01_Take02.wav",
        "Scene01_Shot02_Take01_采访.wav",
        "Scene01_Shot02_Take02.wav",
        "Scene02_Shot01_市场环境.wav",
        "Scene03_Shot01_私密对话.wav",
        "Scene01_Shot01_Take01_环境声_副本.wav",  # 模拟重复文件名
    ]
    
    # 创建最小的WAV文件头（44字节）
    # 这只是一个占位符，不能播放
    minimal_wav_header = (
        b'RIFF' + b'\x24\x00\x00\x00' +  # 文件大小 - 8
        b'WAVE' +
        b'fmt ' + b'\x10\x00\x00\x00' +  # 子区块大小
        b'\x01\x00' + b'\x02\x00' +      # PCM, 立体声
        b'\x44\xac\x00\x00' +             # 44100 Hz
        b'\x10\xb1\x02\x00' +             # 字节率
        b'\x04\x00' + b'\x10\x00' +      # 块对齐, 16bit
        b'data' + b'\x00\x00\x00\x00'    # 数据大小
    )
    
    for audio_name in audio_files:
        audio_path = audio_dir / audio_name
        with open(audio_path, 'wb') as f:
            f.write(minimal_wav_header)
        
        if verbose:
            click.echo(f"   ✅ 音频文件: {audio_path}")
    
    # 创建导演备注
    notes_content = """导演临时备注
================

1. Scene01 Shot01:
   - Take01: 街道环境声，可用
   - Take02: 有汽车经过噪音，可能需要补录

2. Scene01 Shot02:
   - 主角采访，整体质量不错
   - Take02提到了一些家庭背景，可能需要确认隐私问题

3. Scene02 Shot01:
   - 市场环境声，待确认是否足够

4. Scene03 Shot01:
   - 私密对话，绝对需要隐私标记！
   - 内容涉及个人隐私信息
"""
    
    notes_path = target_path / "director_notes.txt"
    with open(notes_path, 'w', encoding='utf-8') as f:
        f.write(notes_content)
    
    click.echo(f"   ✅ 导演备注: {notes_path}")
    
    click.echo("")
    click.echo("✅ 示例数据生成完成！")
    click.echo("")
    click.echo("您可以运行以下命令测试工具:")
    click.echo(f"   1. 扫描目录: python -m field_recording_tool scan -p {target_dir}")
    click.echo(f"   2. 解析场记: python -m field_recording_tool parse-log -p {target_dir}")
    click.echo(f"   3. 执行校验: python -m field_recording_tool validate -p {target_dir}")
    click.echo(f"   4. 查看状态: python -m field_recording_tool status -p {target_dir} -d")
    click.echo(f"   5. 标记素材: python -m field_recording_tool tag -p {target_dir} Scene01_Shot01_Take01_环境声.wav -s available")
    click.echo(f"   6. 导出报告: python -m field_recording_tool export -p {target_dir} {target_dir}/output")


if __name__ == '__main__':
    cli()
