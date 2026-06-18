样例数据存放目录 - data/samples/
========================================

本目录存放标准样例数据，用于测试和演示系统功能。
实际运行时，请将数据放入 data/raw/ 目录。

文件命名规范（与config.yaml中pattern对应）:
- 传感器数据: sensor_YYYYMMDD.csv
- 船上记录: ship_YYYYMMDD.csv
- 遥感截图: remote_*_vN.png  (vN为版本号，v3及以上为新版)
- 边界样本: boundary_*.csv
- 口头备注: notes_YYYYMMDD.txt

样例包含的测试场景:
1. sensor_20260615.csv - 含传感器漂移和阈值异常
2. ship_20260615.csv - 含船上记录滞后
3. boundary_sample_001.csv - 含边界样本
4. notes_20260615.txt - 含口头备注
5. remote_seagrass_v1.png - 旧版遥感截图
6. remote_seagrass_v3.png - 新版遥感截图
