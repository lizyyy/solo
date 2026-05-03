"""
专色打样放行员 - 小型印刷厂打样室命令行工具

功能：
- init: 生成示例数据文件
- import: 导入并校验多源数据
- check: 检查风险项（DeltaE、色号混用、批次过期、干燥时间）
- release/rollback: 维护放行状态机
- report: 导出 Markdown/CSV 复核单
"""

__version__ = "0.1.0"
