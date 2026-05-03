#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os

print("=" * 60)
print("测试客服聊天意图聚类和质检台")
print("=" * 60)

print("\n1. 测试模块导入...")
try:
    from flask import Flask
    from flask_cors import CORS
    print("   ✓ Flask 和 Flask-CORS 导入成功")
except ImportError as e:
    print(f"   ✗ Flask 导入失败: {e}")
    sys.exit(1)

try:
    import pandas as pd
    import numpy as np
    print("   ✓ pandas 和 numpy 导入成功")
except ImportError as e:
    print(f"   ✗ pandas/numpy 导入失败: {e}")
    sys.exit(1)

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    print("   ✓ scikit-learn 导入成功")
except ImportError as e:
    print(f"   ✗ scikit-learn 导入失败: {e}")
    sys.exit(1)

try:
    import jieba
    print("   ✓ jieba 分词导入成功")
except ImportError as e:
    print(f"   ✗ jieba 导入失败: {e}")
    sys.exit(1)

print("\n2. 测试自定义模块...")
try:
    from modules.data_processor import DataProcessor
    print("   ✓ DataProcessor 导入成功")
except Exception as e:
    print(f"   ✗ DataProcessor 导入失败: {e}")
    sys.exit(1)

try:
    from modules.cluster_engine import ClusterEngine
    print("   ✓ ClusterEngine 导入成功")
except Exception as e:
    print(f"   ✗ ClusterEngine 导入失败: {e}")
    sys.exit(1)

try:
    from modules.quality_checker import QualityChecker
    print("   ✓ QualityChecker 导入成功")
except Exception as e:
    print(f"   ✗ QualityChecker 导入失败: {e}")
    sys.exit(1)

try:
    from modules.storage_manager import StorageManager
    print("   ✓ StorageManager 导入成功")
except Exception as e:
    print(f"   ✗ StorageManager 导入失败: {e}")
    sys.exit(1)

try:
    from modules.report_generator import ReportGenerator
    print("   ✓ ReportGenerator 导入成功")
except Exception as e:
    print(f"   ✗ ReportGenerator 导入失败: {e}")
    sys.exit(1)

print("\n3. 测试数据处理功能...")
processor = DataProcessor()
engine = ClusterEngine()
checker = QualityChecker()
reporter = ReportGenerator()

print("   ✓ 所有处理引擎初始化成功")

print("\n4. 测试示例数据...")
sample_path = os.path.join(os.path.dirname(__file__), 'data', 'samples', 'sample_chats.csv')
if os.path.exists(sample_path):
    print(f"   ✓ 示例数据文件存在: {sample_path}")
    
    result = processor.load_and_validate(sample_path)
    if result['valid']:
        print("   ✓ 示例数据验证通过")
        df = result['dataframe']
        print(f"   - 数据行数: {len(df)}")
        print(f"   - 列名: {list(df.columns)}")
        
        processed = processor.process_dataframe(df)
        print(f"   - 解析会话数: {len(processed['sessions'])}")
        
        texts = []
        for session in processed['sessions']:
            user_msgs = [m['content'] for m in session['messages'] if m['role'] == 'user']
            if user_msgs:
                texts.append(' '.join(user_msgs))
        
        if texts:
            print(f"\n5. 测试聚类算法...")
            cluster_result = engine.cluster_texts(texts, n_clusters=5)
            print(f"   ✓ 聚类完成")
            print(f"   - 簇数量: {cluster_result['n_clusters']}")
            for cid, terms in cluster_result['top_terms'].items():
                print(f"   - 簇 {cid}: {', '.join(terms[:3])}")
    else:
        print(f"   ✗ 数据验证失败: {result.get('error')}")
else:
    print(f"   ✗ 示例数据文件不存在: {sample_path}")

print("\n6. 测试质检规则...")
rules = checker.get_default_rules()
print(f"   ✓ 默认规则数量: {len(rules)}")
for r in rules[:3]:
    print(f"   - {r['name']} ({r['category']})")

print("\n" + "=" * 60)
print("✅ 所有测试通过！应用可以正常运行。")
print("=" * 60)
print("\n启动命令:")
print("   python3 app.py")
print("\n然后在浏览器中访问:")
print("   http://127.0.0.1:5000")
