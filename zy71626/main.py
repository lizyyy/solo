"""
火星温室能量局 - 主入口文件
演示如何使用整个系统
"""

import sys
import os

from mars_greenhouse.data_import import DataImporter
from mars_greenhouse.engine import GreenhouseEngine
from mars_greenhouse.failure_analysis import FailureAnalyzer, FailureFeedbackGenerator
from mars_greenhouse.report_export import ReportExporter
from mars_greenhouse.error_tracking import get_global_error_tracker
from mars_greenhouse.models import GameStatus


def demo_basic_gameplay():
    """演示基本游戏流程"""
    print("=" * 60)
    print("火星温室能量局 - 游戏演示")
    print("=" * 60)
    
    # 1. 导入数据
    print("\n【步骤1】导入关卡数据...")
    importer = DataImporter()
    game_state, sources = importer.import_file("examples/level_01_basic.json")
    
    if not game_state:
        print("导入失败！")
        print(get_global_error_tracker().generate_error_report())
        return
    
    print(f"  成功导入: {game_state.name}")
    print(f"  数据源数量: {len(sources)}")
    print(f"  温室舱: {len(game_state.greenhouse_modules)} 个")
    print(f"  作物: {len(game_state.crops)} 株")
    print(f"  目标产量: {game_state.target_yield}")
    
    # 2. 导入补充数据
    print("\n【步骤2】导入补充数据（额外作物）...")
    supplement_state, _ = importer.import_file("examples/supplement_extra_crops.json", is_supplement=True)
    if supplement_state:
        game_state = importer.merge_data(game_state, supplement_state)
        print(f"  合并后作物数量: {len(game_state.crops)} 株")
    
    # 3. 初始化游戏引擎
    print("\n【步骤3】初始化游戏引擎...")
    engine = GreenhouseEngine(game_state)
    engine.start_game()
    print(f"  游戏开始！共 {game_state.max_rounds} 回合")
    
    # 4. 模拟游戏过程
    print("\n【步骤4】模拟游戏进行...")
    max_rounds_to_simulate = 15
    
    for i in range(max_rounds_to_simulate):
        # 玩家操作示例
        if i == 0:
            engine.toggle_light("gh_01")
            engine.set_target_temperature("gh_01", 23.0)
        
        # 每3回合关闭灯一次（模拟昼夜）
        if i % 3 == 2:
            engine.toggle_light("gh_01")
        elif i % 3 == 0:
            engine.toggle_light("gh_01")
        
        # 处理回合
        continue_game, messages = engine.process_round()
        
        print(f"\n--- 第 {game_state.round - 1} 回合 ---")
        for msg in messages[:3]:
            print(f"  {msg}")
        
        if not continue_game:
            break
    
    # 5. 游戏结束，生成报告
    print("\n【步骤5】游戏结束，生成报告...")
    
    # 失败分析（如果游戏失败）
    analysis = None
    if game_state.status == GameStatus.FAILED:
        analyzer = FailureAnalyzer(engine)
        analysis = analyzer.analyze_failure()
        
        feedback_gen = FailureFeedbackGenerator()
        print("\n" + feedback_gen.generate_student_feedback(analysis))
        print("\n" + feedback_gen.generate_teacher_feedback(analysis))
    
    # 导出报告
    exporter = ReportExporter()
    report_path = exporter.export_game_report(
        game_state, engine, analysis, get_global_error_tracker(), format="txt"
    )
    print(f"\n  报告已导出: {report_path}")
    
    json_report_path = exporter.export_game_report(
        game_state, engine, analysis, get_global_error_tracker(), format="json"
    )
    print(f"  JSON报告: {json_report_path}")
    
    # 导出错误报告
    error_report_path = exporter.export_error_report(get_global_error_tracker())
    print(f"  错误报告: {error_report_path}")
    
    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)


def demo_data_import_directory():
    """演示整个目录导入"""
    print("\n" + "=" * 60)
    print("演示：批量导入目录下的所有数据文件")
    print("=" * 60)
    
    importer = DataImporter()
    game_state, sources = importer.import_directory("examples")
    
    if game_state:
        print(f"\n成功合并所有数据！")
        print(f"  数据源总数: {len(sources)}")
        print(f"  温室舱: {len(game_state.greenhouse_modules)}")
        print(f"  作物: {len(game_state.crops)}")
        print(f"  水箱: {len(game_state.water_tanks)}")
        print(f"  电池: {len(game_state.batteries)}")
        print(f"  事件: {len(game_state.upcoming_events)}")
        
        summary = importer.get_import_summary()
        print(f"\n导入摘要:")
        print(f"  补充数据数量: {summary['supplement_count']}")
        print(f"  涉及版本: {', '.join(summary['versions'])}")


def demo_intentional_failure():
    """演示故意触发失败条件，测试失败分析"""
    print("\n" + "=" * 60)
    print("演示：测试能量耗尽失败场景")
    print("=" * 60)
    
    importer = DataImporter()
    game_state, _ = importer.import_file("examples/level_01_basic.json")
    
    if not game_state:
        return
    
    # 故意设置低电量
    for battery in game_state.batteries:
        battery.current_charge = 10.0
    
    # 关闭所有灯（减少能量产出）
    for module in game_state.greenhouse_modules:
        module.light_on = False
        module.light_intensity = 0.0
    
    engine = GreenhouseEngine(game_state)
    engine.start_game()
    
    print("\n快速消耗能量中...")
    for i in range(10):
        continue_game, messages = engine.process_round()
        if not continue_game:
            break
    
    if game_state.status == GameStatus.FAILED:
        analyzer = FailureAnalyzer(engine)
        analysis = analyzer.analyze_failure()
        
        feedback_gen = FailureFeedbackGenerator()
        print("\n" + feedback_gen.generate_student_feedback(analysis))
    
    print("\n演示完成！")


if __name__ == "__main__":
    # 设置日志
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("\n选择演示模式:")
    print("1. 基本游戏流程演示")
    print("2. 批量目录导入演示")
    print("3. 失败分析场景演示")
    print("4. 运行全部演示")
    
    choice = input("\n请输入选项 (1-4): ").strip()
    
    if choice == "1":
        demo_basic_gameplay()
    elif choice == "2":
        demo_data_import_directory()
    elif choice == "3":
        demo_intentional_failure()
    elif choice == "4":
        demo_basic_gameplay()
        demo_data_import_directory()
        demo_intentional_failure()
    else:
        print("无效选项，运行基本演示")
        demo_basic_gameplay()
