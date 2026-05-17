#!/usr/bin/env python3
from datetime import datetime, timedelta

expired_time = datetime.now() - timedelta(hours=25)
created_time = datetime.now() - timedelta(days=2)

reservations = [
    # reader_id, copy_id, status, created_at, locked_until, picked_up_at, expired_at
    # 逾期未取的锁定预约（李同学，25小时前锁定，已逾期）
    f"R-001,BOOK-A,locked,{created_time.isoformat()},{expired_time.isoformat()},,",
    # 正常待处理的预约（王老师，优先）
    f"R-002,BOOK-B,pending,{created_time.isoformat()},,,",
    # 已取书的预约（张职员）
    f"R-003,BOOK-C,pending,{created_time.isoformat()},,,",
]

with open("reservations.txt", "w", encoding="utf-8") as f:
    f.write("# 预约逾期释放样例 - 预约数据(动态生成，加载时BOOK-A已逾期)\n")
    f.write("# 格式: reader_id,copy_id,status,created_at,locked_until,picked_up_at,expired_at\n")
    for r in reservations:
        f.write(r + "\n")

print("✅ 已生成 reservations.txt，包含1个已逾期锁定的预约")
print("   运行: python library_cli.py --sample expired --list --process-expired --report")
