#!/usr/bin/env python3
from slow_query_cli.cli import SlowQueryCLI


def main():
    print("=" * 70)
    print("📦 数据库慢查询分派 CLI - 完整演示")
    print("=" * 70)
    
    cli = SlowQueryCLI('config/owners.yaml')
    
    print("\n[1/5] 加载配置...")
    cli.reload_config()
    
    print("\n[2/5] 导入日志...")
    cli.import_logs('examples/slow_queries.log', 'simple')
    
    print("\n[3/5] 分析查询...")
    cli.analyze()
    
    print("\n[4/5] 展示完整分派清单...")
    cli.show_all_assignments()
    
    print("\n" + "=" * 70)
    print("👤 查看张三的慢查询详情")
    print("=" * 70)
    cli.show_owner_queries('张三')
    
    print("\n" + "=" * 70)
    print("✅ 标记张三的所有慢查询为已确认")
    print("=" * 70)
    cli.mark_confirmed('张三')
    
    print("\n" + "=" * 70)
    print("📊 导出趋势报告 (JSON 格式)")
    print("=" * 70)
    cli.export_report('output/trend_report.json', 'json')
    
    print("\n" + "=" * 70)
    print("📊 导出趋势报告 (CSV 格式)")
    print("=" * 70)
    cli.export_report('output/trend_report.csv', 'csv')
    
    print("\n" + "=" * 70)
    print("🎉 演示完成！")
    print("=" * 70)
    print("生成的文件:")
    print("  - output/trend_report.json")
    print("  - output/trend_report.csv")


if __name__ == '__main__':
    main()
