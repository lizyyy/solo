#!/usr/bin/env python3
"""验证安装和基本功能"""

import sys
from pathlib import Path

print("=" * 60)
print("采样音色标签器 - 安装验证")
print("=" * 60)

try:
    from sample_tagger import __version__
    print(f"✓ 版本: {__version__}")
except Exception as e:
    print(f"✗ 导入失败: {e}")
    sys.exit(1)

modules = [
    ("models", ["SampleFile", "Tag", "SpectrumFeatures", "ConflictRecord", "DuplicateRecord"]),
    ("feature_extractor", ["FeatureExtractor"]),
    ("auto_tagger", ["RuleBasedTagger"]),
    ("conflict_detector", ["ConflictDetector"]),
    ("duplicate_detector", ["DuplicateDetector"]),
    ("exporter", ["ReportExporter"]),
    ("pipeline", ["TaggingPipeline"]),
    ("cli", ["cli"]),
]

all_good = True
for module_name, expected_classes in modules:
    try:
        module = __import__(f"sample_tagger.{module_name}", fromlist=expected_classes)
        for cls_name in expected_classes:
            if hasattr(module, cls_name):
                print(f"✓ {module_name}.{cls_name}")
            else:
                print(f"✗ {module_name}.{cls_name} 不存在")
                all_good = False
    except Exception as e:
        print(f"✗ {module_name} 导入失败: {e}")
        all_good = False

print("-" * 60)

if all_good:
    print("✓ 所有模块导入成功")
    print()
    print("项目结构:")
    print("  sample_tagger/")
    print("  ├── __init__.py          # 版本信息")
    print("  ├── models.py            # 核心数据模型")
    print("  ├── feature_extractor.py # 特征提取 + 静音/噪声检测")
    print("  ├── auto_tagger.py       # 规则标注引擎")
    print("  ├── conflict_detector.py # 冲突检测队列")
    print("  ├── duplicate_detector.py# 重复检测(含编号重复)")
    print("  ├── exporter.py          # JSON导出(摘要+明细)")
    print("  ├── pipeline.py          # 处理流水线")
    print("  └── cli.py               # CLI入口")
    print()
    print("使用方法:")
    print("  sample-tagger tag ./samples -o ./reports")
    print("  sample-tagger inspect ./reports/tag_xxx_summary.json")
    print("  sample-tagger lookup ./reports/tag_xxx_detailed.json --sample-id xxx")
    print()
    print("核心功能:")
    print("  • 自动标注: 鼓/贝斯/环境声/可疑噪声/静音")
    print("  • 静音检测: 基于RMS阈值")
    print("  • 噪声检测: 基于ZCR和平坦度")
    print("  • 冲突检测: 多标签/自动人工不匹配/低置信度")
    print("  • 重复检测: 文件哈希/音频指纹/文件名/重复编号")
    print("  • 导出: 详细JSON + 摘要JSON, 可反查来源")
else:
    print("✗ 部分模块导入失败")
    sys.exit(1)

print("=" * 60)
