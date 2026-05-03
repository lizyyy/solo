"""
CLI 入口模块
提供命令行接口
"""

import os
import sys
from pathlib import Path
from typing import Dict, Optional

import click

# 添加 src 目录到 Python 路径
src_dir = Path(__file__).parent.parent
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from src.data_parser import DataParser, CameraConfig, OldMaskConfig
from src.rule_validator import RuleValidator, ValidationResult, Severity
from src.image_overlay import ImageOverlay
from src.report_generator import ReportGenerator


@click.command()
@click.option('--cameras', '-c', 
              type=click.Path(exists=True, dir_okay=False),
              required=True,
              help='相机配置 CSV 文件路径 (cameras.csv)')
@click.option('--rules', '-r', 
              type=click.Path(exists=True, dir_okay=False),
              required=True,
              help='遮罩规则 YAML 文件路径 (mask_rules.yaml)')
@click.option('--frames', '-f', 
              type=click.Path(exists=True, file_okay=False),
              required=True,
              help='样例图片目录路径 (frames/)')
@click.option('--old-config', '-o', 
              type=click.Path(exists=True, dir_okay=False),
              default=None,
              help='旧版配置 JSON 文件路径 (可选)')
@click.option('--output', '-O', 
              type=click.Path(),
              default='./output',
              help='输出目录路径 (默认: ./output)')
@click.option('--verbose', '-v',
              is_flag=True,
              help='显示详细输出')
def main(cameras: str, rules: str, frames: str, 
         old_config: Optional[str], output: str, verbose: bool):
    """
    车间边缘相机隐私遮罩配置离线预检工具
    
    输入:
    - cameras.csv: 相机配置信息
    - mask_rules.yaml: 遮罩规则配置
    - frames/: 样例图片目录
    - old_config.json: 旧版配置 (可选)
    
    输出:
    - 每台相机的遮罩叠加预览图
    - 变更 diff 图片 (如果有旧配置)
    - audit_report.md: 审计报告
    """
    click.echo("=" * 60)
    click.echo("相机隐私遮罩配置离线预检工具")
    click.echo("=" * 60)
    click.echo("")
    
    # 确保输出目录存在
    output_dir = Path(output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    preview_dir = output_dir / "previews"
    diff_dir = output_dir / "diffs"
    preview_dir.mkdir(parents=True, exist_ok=True)
    diff_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. 解析数据
    if verbose:
        click.echo("[1/5] 解析输入数据...")
    
    parser = DataParser()
    
    try:
        cameras_dict = parser.parse_cameras_csv(cameras)
        if verbose:
            click.echo(f"  ✓ 解析相机配置: {len(cameras_dict)} 台相机")
    except Exception as e:
        click.echo(f"  ✗ 解析相机配置失败: {e}", err=True)
        sys.exit(1)
    
    try:
        mask_rules = parser.parse_mask_rules_yaml(rules)
        if verbose:
            click.echo(f"  ✓ 解析遮罩规则: {len(mask_rules)} 条规则")
    except Exception as e:
        click.echo(f"  ✗ 解析遮罩规则失败: {e}", err=True)
        sys.exit(1)
    
    try:
        # 使用已知的 camera_id 列表进行精确匹配
        known_camera_ids = list(cameras_dict.keys())
        frames_dict = parser.parse_frames_directory(frames, known_camera_ids)
        if verbose:
            click.echo(f"  ✓ 解析样例图片: {len(frames_dict)} 张图片")
    except Exception as e:
        click.echo(f"  ✗ 解析样例图片失败: {e}", err=True)
        sys.exit(1)
    
    old_configs = {}
    if old_config:
        try:
            old_configs = parser.parse_old_config_json(old_config)
            if verbose:
                click.echo(f"  ✓ 解析旧版配置: {len(old_configs)} 台相机配置")
        except Exception as e:
            click.echo(f"  ✗ 解析旧版配置失败: {e}", err=True)
            sys.exit(1)
    else:
        if verbose:
            click.echo("  - 未提供旧版配置，跳过回滚检查")
    
    # 2. 规则校验
    if verbose:
        click.echo("")
        click.echo("[2/5] 执行规则校验...")
    
    validator = RuleValidator(cameras_dict, mask_rules, frames_dict, old_configs)
    validation_result = validator.validate_all()
    
    summary = validation_result.summary
    if verbose:
        click.echo(f"  整体状态: {summary.get('overall_status', 'unknown')}")
        click.echo(f"  有效配置: {summary.get('valid_cameras', 0)}/{summary.get('total_cameras', 0)}")
        
        issue_counts = summary.get('issue_counts', {})
        click.echo(f"  问题统计: 严重={issue_counts.get('critical', 0)}, "
                   f"警告={issue_counts.get('warning', 0)}, "
                   f"信息={issue_counts.get('info', 0)}")
    
    # 3. 生成图片预览
    if verbose:
        click.echo("")
        click.echo("[3/5] 生成遮罩预览图...")
    
    overlay = ImageOverlay(alpha=0.5, thickness=2)
    generated_images: Dict[str, Dict[str, str]] = {}
    
    for camera_id, camera in cameras_dict.items():
        cam_images = {}
        
        # 获取图片
        if camera_id in frames_dict:
            frame = frames_dict[camera_id]
            image = frame.image
            
            # 生成遮罩预览
            preview_path = str(preview_dir / f"{camera_id}_preview.jpg")
            try:
                overlay.create_mask_preview(
                    image, camera, mask_rules, preview_path
                )
                cam_images['preview'] = preview_path
                if verbose:
                    click.echo(f"  ✓ 相机 {camera_id}: 生成预览图")
            except Exception as e:
                click.echo(f"  ✗ 相机 {camera_id}: 生成预览图失败: {e}", err=True)
            
            # 生成 diff 图片 (如果有旧配置)
            if camera_id in old_configs:
                cam_result = validation_result.all_results.get(camera_id)
                if cam_result and cam_result.mask_diff:
                    diff_path = str(diff_dir / f"{camera_id}_diff.jpg")
                    try:
                        overlay.create_diff_image(
                            image, camera, mask_rules,
                            old_configs[camera_id], cam_result.mask_diff,
                            diff_path
                        )
                        cam_images['diff'] = diff_path
                        if verbose:
                            click.echo(f"  ✓ 相机 {camera_id}: 生成 diff 图")
                    except Exception as e:
                        click.echo(f"  ✗ 相机 {camera_id}: 生成 diff 图失败: {e}", err=True)
        
        generated_images[camera_id] = cam_images
    
    # 4. 生成报告
    if verbose:
        click.echo("")
        click.echo("[4/5] 生成审计报告...")
    
    report_generator = ReportGenerator(str(output_dir))
    try:
        report_path = report_generator.generate_audit_report(
            validation_result, cameras_dict, generated_images
        )
        if verbose:
            click.echo(f"  ✓ 报告已生成: {report_path}")
    except Exception as e:
        click.echo(f"  ✗ 生成报告失败: {e}", err=True)
        sys.exit(1)
    
    # 5. 输出结果摘要
    if verbose:
        click.echo("")
        click.echo("[5/5] 执行完成！")
        click.echo("")
    
    # 输出结果摘要
    click.echo("-" * 60)
    click.echo("执行结果摘要")
    click.echo("-" * 60)
    
    overall_status = summary.get('overall_status', 'unknown')
    if overall_status == 'pass':
        click.echo(f"✅ 整体状态: 通过 ({summary.get('valid_cameras', 0)}/{summary.get('total_cameras', 0)} 台相机配置有效)")
    else:
        click.echo(f"❌ 整体状态: 失败 ({summary.get('invalid_cameras', 0)} 台相机配置有严重问题)")
    
    # 列出问题
    if validation_result.all_issues:
        click.echo("")
        click.echo("发现的问题:")
        
        # 按严重程度排序输出
        critical = [i for i in validation_result.all_issues if i.severity == Severity.CRITICAL]
        warning = [i for i in validation_result.all_issues if i.severity == Severity.WARNING]
        info = [i for i in validation_result.all_issues if i.severity == Severity.INFO]
        
        for issues_list, icon, label in [
            (critical, "🔴", "严重"),
            (warning, "🟡", "警告"),
            (info, "ℹ️", "信息")
        ]:
            for issue in issues_list:
                click.echo(f"  {icon} [{label}] {issue.camera_id}: {issue.description}")
    
    click.echo("")
    click.echo("生成的文件:")
    click.echo(f"  📄 审计报告: {report_path}")
    click.echo(f"  🖼️  预览图片: {preview_dir}/")
    if old_configs:
        click.echo(f"  🖼️  对比图片: {diff_dir}/")
    
    click.echo("")
    click.echo("=" * 60)
    
    # 根据整体状态设置退出码
    if overall_status != 'pass':
        sys.exit(1)


if __name__ == '__main__':
    main()
