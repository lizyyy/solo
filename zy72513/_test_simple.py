#!/usr/bin/env python3
import os, sys
sys.path.insert(0, '.')

from learning_path_recommender.storage import JSONStorage

def main():
    DATA_DIR = "data"
    if os.path.exists(DATA_DIR):
        import shutil
        shutil.rmtree(DATA_DIR)
    storage = JSONStorage(DATA_DIR)
    print("✅ 存储初始化成功")
    
    from learning_path_recommender.core import Importer, VersionManager, MaskingEngine
    from learning_path_recommender.audit import AuditLogger
    from learning_path_recommender.workflow import ThreeStepWorkflow
    from learning_path_recommender.cli.main import build_unified_report
    print("✅ 所有模块导入成功")
    print("✅ 基础测试通过！")

if __name__ == "__main__":
    main()
