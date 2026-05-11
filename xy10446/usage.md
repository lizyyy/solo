#!/usr/bin/env python3
"""货代舱位取消CLI工具使用说明

快速开始:
    python3 freight_cancel_cli.py --help

命令列表:
    import-data    导入数据（订舱/船期/取消记录）
    calculate      执行费用核算
    list-records   查看记录列表
    detail         查看单票详情
    waive          登记人工减免
    export         导出报告

数据导入格式:

【订舱清单】bookings.csv
    订舱号,客户编号,客户名称,客户等级,船名,航次,起运港,目的港,柜量,柜型,海运费单价,订舱日期
    客户等级: VIP, GOLD, SILVER, NORMAL

【船期规则】schedules.csv
    船名,航次,ETD,截关时间,免费取消小时数,取消费比例,赔付比例
    日期格式: YYYY-MM-DD HH:MM:SS

【取消记录】cancellations.csv
    记录ID,订舱号,客户编号,取消类型,取消/改船时间,新船名,新航次,原舱释放
    取消类型: 直接取消, 改船
    原舱释放: 是/否

使用示例:

# 1. 导入数据
python3 freight_cancel_cli.py import-data sample_data/bookings.csv --type bookings
python3 freight_cancel_cli.py import-data sample_data/schedules.csv --type schedules
python3 freight_cancel_cli.py import-data sample_data/cancellations.csv --type cancellations

# 2. 查看待核算记录
python3 freight_cancel_cli.py list-records

# 3. 执行费用核算
python3 freight_cancel_cli.py calculate

# 4. 查看某单详情
python3 freight_cancel_cli.py detail REC002

# 5. 登记人工减免
python3 freight_cancel_cli.py waive REC002 --waive-amount 1000 --reason "客户特殊申请" --operator "张经理"

# 6. 导出报告
python3 freight_cancel_cli.py export report.csv --format csv
python3 freight_cancel_cli.py export report.txt --format txt

# 指定数据库
python3 freight_cancel_cli.py --db my_data.db ...

计算规则说明:

1. 免费取消
   - 直接取消：截关前(免费取消小时数 + 客户等级额外时间)以上
   - 改船：截关前72小时以上（VIP/GOLD为96小时）
   - VIP额外+24h, GOLD额外+12h, SILVER额外+6h, NORMAL+0h

2. 收取消费
   - 直接取消：取消费 = 柜数 × 海运费单价 × 取消费比例
   - 改船：改船费 = 柜数 × 海运费单价 × 取消费比例 × 50%

3. 赔付
   - 截关后取消：加付赔付 = 柜数 × 海运费单价 × 赔付比例

异常检测:
   - 重复导入：同一订舱号同一类型已存在已处理记录 → 跳过
   - 客户编号不一致：取消记录与订舱的客户编号不同
   - 截关时间缺失：缺少船期规则
   - 改船原舱未释放：改船记录中原舱释放标记为"否"
"""

import sys
from freight_cancel_cli.cli import main

if __name__ == "__main__":
    main()
