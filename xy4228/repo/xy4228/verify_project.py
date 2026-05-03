#!/usr/bin/env python3
"""验证项目核心功能的测试脚本。"""

import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, '.')

print("=" * 60)
print("FITS 成像质检台 - 核心功能验证")
print("=" * 60)
print()

# 1. 验证模块导入
print("1. 验证模块导入...")
try:
    from fits_quality_checker import __version__
    from fits_quality_checker.models.models import (
        ObservationConfig, FITSMetadata, FileType, FileStatus,
        ImageQualityMetrics, QualityResult, AnalysisResult
    )
    from fits_quality_checker.sample_data.generator import SampleDataGenerator
    from fits_quality_checker.rules.engine import RulesEngine
    from fits_quality_checker.rules.rules import CloudRule, StarTrailRule, TemperatureMatchRule
    from fits_quality_checker.quality.metrics import QualityMetricsCalculator
    from fits_quality_checker.quality.temperature import TemperatureMatcher
    from fits_quality_checker.storage.config import ConfigManager
    from fits_quality_checker.storage.persistence import DataStore
    from fits_quality_checker.reports.generator import ReportGenerator
    
    print(f"   ✓ 版本: {__version__}")
    print("   ✓ 所有核心模块导入成功")
except Exception as e:
    print(f"   ✗ 导入失败: {e}")
    sys.exit(1)

print()

# 2. 验证数据模型
print("2. 验证数据模型...")
try:
    config = ObservationConfig(
        config_name='test_config',
        observer='Test Observer',
        telescope='Celestron 8SE',
        camera='ZWO ASI2600MC-Pro',
        focal_length=2000.0,
        aperture=203.0,
        pixel_size=3.76,
        target_name='M42 猎户座大星云',
        expected_exposures={'L': 10, 'R': 5, 'G': 5, 'B': 5},
        expected_temperature=-10.0,
        temperature_tolerance=0.5,
        fwhm_threshold=3.0,
        roundness_threshold=0.8,
        noise_threshold=10.0,
    )
    print(f"   ✓ ObservationConfig: {config.config_name}")
    print(f"     - 望远镜: {config.telescope}")
    print(f"     - 期望温度: {config.expected_temperature}°C")
    
    # 测试枚举
    assert FileType.LIGHT.value == 'light'
    assert FileType.DARK.value == 'dark'
    assert FileStatus.KEEP.value == 'keep'
    assert FileStatus.RETRY.value == 'retry'
    print("   ✓ FileType/FileStatus 枚举正常")
    
except Exception as e:
    print(f"   ✗ 数据模型验证失败: {e}")
    sys.exit(1)

print()

# 3. 验证示例数据生成
print("3. 验证示例数据生成...")
try:
    generator = SampleDataGenerator(config, seed=42)
    metadatas = generator.generate_batch(20, include_problems=True)
    
    print(f"   ✓ 生成了 {len(metadatas)} 个元数据")
    
    # 按类型统计（处理枚举或字符串）
    by_type = {}
    for m in metadatas:
        if isinstance(m.file_type, str):
            type_val = m.file_type
        else:
            type_val = m.file_type.value
        by_type[type_val] = by_type.get(type_val, 0) + 1
    print(f"   ✓ 类型统计: {by_type}")
    
    # 验证有光场、暗场
    assert 'light' in by_type or 'LIGHT' in by_type
    assert 'dark' in by_type or 'DARK' in by_type
    
except Exception as e:
    print(f"   ✗ 示例数据生成失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()

# 4. 验证质量指标计算
print("4. 验证质量指标计算...")
try:
    calculator = QualityMetricsCalculator(config)
    
    # 计算第一个元数据的指标
    if metadatas:
        metrics = calculator.calculate_from_metadata(metadatas[0])
        print(f"   ✓ 质量指标计算:")
        print(f"     - FWHM: {metrics.fwhm:.2f} 像素")
        print(f"     - 圆度: {metrics.roundness:.3f}")
        print(f"     - 背景噪声: {metrics.background_noise:.2f} ADU")
        
        # 验证值在合理范围内
        assert 0 < metrics.fwhm < 10
        assert 0 < metrics.roundness <= 1.0
        assert metrics.background_noise > 0
        
except Exception as e:
    print(f"   ✗ 质量指标计算失败: {e}")
    sys.exit(1)

print()

# 5. 验证规则引擎
print("5. 验证规则引擎...")
try:
    engine = RulesEngine(config)
    print(f"   ✓ 规则引擎创建成功，包含 {len(engine.rules)} 个规则")
    
    # 批量评估
    metrics_dict = {}
    for m in metadatas:
        metrics_dict[m.file_path] = calculator.calculate_from_metadata(m)
    
    results = engine.batch_evaluate(metadatas, metrics_dict)
    print(f"   ✓ 批量评估完成，共 {len(results)} 个结果")
    
    # 获取统计
    stats = engine.get_statistics(results)
    print(f"   ✓ 统计: {stats['by_status']}")
    
    # 验证有结果
    assert len(results) > 0
    assert 'keep' in stats['by_status'] or 'isolate' in stats['by_status'] or 'retry' in stats['by_status']
    
except Exception as e:
    print(f"   ✗ 规则引擎验证失败: {e}")
    sys.exit(1)

print()

# 6. 验证报告生成
print("6. 验证报告生成...")
try:
    # 创建临时目录
    temp_dir = tempfile.mkdtemp(prefix='fitsqc_test_')
    
    try:
        # 构建分析结果
        total = len(results)
        keep_count = stats['by_status'].get('keep', 0)
        isolate_count = stats['by_status'].get('isolate', 0)
        retry_count = stats['by_status'].get('retry', 0)
        
        # 辅助函数：比较 file_type
        def matches_file_type(ft, expected):
            if isinstance(ft, str):
                return ft.lower() == expected.lower()
            return ft == expected
        
        light_count = sum(1 for r in results if matches_file_type(r.file_type, 'light'))
        dark_count = sum(1 for r in results if matches_file_type(r.file_type, 'dark'))
        flat_count = sum(1 for r in results if matches_file_type(r.file_type, 'flat'))
        
        analysis_result = AnalysisResult(
            config_name=config.config_name,
            total_files=total,
            light_files=light_count,
            dark_files=dark_count,
            flat_files=flat_count,
            keep_count=keep_count,
            isolate_count=isolate_count,
            retry_count=retry_count,
            unknown_count=stats['by_status'].get('unknown', 0),
            results=results,
            summary={'avg_score': stats.get('avg_score', 0)},
        )
        
        # 生成报告
        report_gen = ReportGenerator(output_dir=temp_dir)
        paths = report_gen.generate_audit_package(analysis_result, config)
        
        print(f"   ✓ 报告生成成功:")
        for fmt, path in paths.items():
            exists = Path(path).exists()
            print(f"     - {fmt}: {path} {'✓' if exists else '✗'}")
            assert exists
        
    finally:
        # 清理临时目录
        shutil.rmtree(temp_dir, ignore_errors=True)
        
except Exception as e:
    print(f"   ✗ 报告生成失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("=" * 60)
print("🎉 所有核心功能验证通过！")
print("=" * 60)
print()
print("快速开始命令:")
print("  python3 -m fits_quality_checker.cli.main demo --save")
print("  或")
print("  python3 -c \"from fits_quality_checker.cli.main import cli; cli(['demo', '--save'])\"")
print()
