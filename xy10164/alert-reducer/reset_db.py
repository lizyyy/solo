#!/usr/bin/env python3
"""重置数据库脚本"""

import os
import sys

# 删除旧数据库
db_path = 'alerts.db'
log_path = 'alert_reducer.log'

if os.path.exists(db_path):
    os.remove(db_path)
    print(f"✅ 已删除旧数据库: {db_path}")
else:
    print(f"ℹ️  数据库不存在: {db_path}")

if os.path.exists(log_path):
    os.remove(log_path)
    print(f"✅ 已删除旧日志: {log_path}")

# 重新初始化
from alert_reducer.models import init_db
from alert_reducer.config import ConfigManager

config = ConfigManager()
engine = init_db(config.database_path)
print(f"✅ 数据库已初始化: {config.database_path}")
