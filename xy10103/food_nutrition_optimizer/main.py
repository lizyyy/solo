import os
import sys
import pandas as pd
from typing import Dict, Any
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.utils import setup_logging, load_config, ensure_dir
from src.data_preprocessor import DataPreprocessor
from src.constraint_solver import ConstraintSolver
from src.quality_control import QualityControlEngine
from src.report_generator import ReportGenerator


class NutritionOptimizerPipeline:
    def __init__(self, config_path: str = None):
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        
        if config_path is None:
            config_path = os.path.join(self.base_dir, 'config', 'config.yaml')
        
        self.config = load_config(config_path)
        self.logger = setup_logging(os.path.join(self.base_dir, 'logs'))
        
        ensure_dir(os.path.join(self.base_dir, 'data', 'processed'))
        ensure_dir(os.path.join(self.base_dir, 'reports'))
        
        self.preprocessor = DataPreprocessor(self.config, self.logger)
        self.solver = ConstraintSolver(self.config, self.logger)
        self.quality_engine = QualityControlEngine(self.config, self.logger)
        self.report_generator = ReportGenerator(
            self.config, 
            self.logger, 
            os.path.join(self.base_dir, 'reports')
        )
    
    def run(self, input_file: str = None) -> Dict[str, Any]:
        self.logger.info("=" * 60)
        self.logger.info("开始执行食品营养配方优化流程")
        self.logger.info(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.logger.info("=" * 60)
        
        if input_file is None:
            input_file = os.path.join(self.base_dir, self.config['data']['input_file'])
        
        self.logger.info(f"读取数据文件: {input_file}")
        original_df = self._load_data(input_file)
        
        if original_df is None or len(original_df) == 0:
            self.logger.error("无法加载数据或数据为空")
            return {'success': False, 'error': '数据加载失败'}
        
        self.logger.info(f"原始数据: {len(original_df)} 条记录")
        
        qc_issues = self.quality_engine.validate_dataframe(original_df)
        self.logger.info(f"质控检查完成，发现 {len(qc_issues)} 个质量问题")
        
        self.logger.info("\n" + "-" * 60)
        self.logger.info("步骤 1: 数据预处理")
        self.logger.info("-" * 60)
        processed_df, processing_report = self.preprocessor.process(original_df)
        
        self.logger.info("\n" + "-" * 60)
        self.logger.info("步骤 2: 配方优化求解")
        self.logger.info("-" * 60)
        
        if len(processed_df) < 2:
            self.logger.warning("有效数据不足，无法进行配方优化")
            recipe_result = self._create_failure_result("有效食材不足，至少需要2种食材")
        else:
            ingredients = self.preprocessor.dataframe_to_ingredients(processed_df)
            self.logger.info(f"可用于优化的食材: {len(ingredients)} 种")
            
            recipe_result = self.solver.solve(ingredients)
            
            if recipe_result.is_feasible:
                self.logger.info(f"优化成功！找到最优配方")
                self._display_recipe_summary(recipe_result)
            else:
                self.logger.warning(f"优化失败: {recipe_result.notes}")
        
        self.logger.info("\n" + "-" * 60)
        self.logger.info("步骤 3: 生成报告")
        self.logger.info("-" * 60)
        
        output_files = self.report_generator.generate_complete_report(
            original_df=original_df,
            processed_df=processed_df,
            processing_report=processing_report,
            recipe_result=recipe_result,
            qc_issues=qc_issues
        )
        
        self._save_processed_data(processed_df)
        
        results = {
            'success': True,
            'original_record_count': len(original_df),
            'processed_record_count': len(processed_df),
            'recipe_found': recipe_result.is_feasible,
            'quality_issues_count': len(qc_issues),
            'reports': output_files,
            'recipe_result': recipe_result,
            'processing_report': processing_report,
            'qc_issues': qc_issues
        }
        
        self._display_final_summary(results)
        
        self.logger.info("=" * 60)
        self.logger.info("流程执行完成")
        self.logger.info(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.logger.info("=" * 60)
        
        return results
    
    def _load_data(self, file_path: str) -> pd.DataFrame:
        try:
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path, encoding='utf-8')
            elif file_path.endswith('.xlsx') or file_path.endswith('.xls'):
                df = pd.read_excel(file_path)
            else:
                raise ValueError(f"不支持的文件格式: {file_path}")
            
            self.logger.info(f"成功加载数据，共 {len(df)} 行 {len(df.columns)} 列")
            return df
        except Exception as e:
            self.logger.error(f"加载数据失败: {e}")
            return None
    
    def _save_processed_data(self, df: pd.DataFrame):
        output_dir = os.path.join(self.base_dir, self.config['data']['output_dir'])
        ensure_dir(output_dir)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = os.path.join(output_dir, f"processed_ingredients_{timestamp}.csv")
        
        df.to_csv(output_file, index=False, encoding='utf-8')
        self.logger.info(f"处理后的数据已保存到: {output_file}")
    
    def _create_failure_result(self, reason: str):
        from src.models import RecipeResult
        return RecipeResult(
            ingredients=[],
            proportions={},
            total_protein=0,
            total_sodium=0,
            total_cost=0,
            total_weight=0,
            constraints=[],
            is_feasible=False,
            optimization_time=0,
            notes=reason
        )
    
    def _display_recipe_summary(self, recipe_result):
        print("\n" + "=" * 60)
        print("✅ 找到最优配方！")
        print("=" * 60)
        print("\n配方组成:")
        for ing, prop in recipe_result.proportions.items():
            percentage = (prop / recipe_result.total_weight) * 100
            print(f"  - {ing}: {prop:.2f}g ({percentage:.1f}%)")
        
        print("\n营养指标:")
        print(f"  - 蛋白质: {recipe_result.total_protein:.2f} g")
        print(f"  - 钠含量: {recipe_result.total_sodium:.2f} mg")
        print(f"  - 总成本: ${recipe_result.total_cost:.2f}")
        print(f"  - 总重量: {recipe_result.total_weight:.2f} g")
        print(f"  - 优化耗时: {recipe_result.optimization_time:.2f} 秒")
        
        print("\n约束满足情况:")
        for c in recipe_result.constraints:
            status = "✅ 满足" if c.is_satisfied else "❌ 不满足"
            print(f"  {status} {c.name}: {c.current_value:.2f} {c.unit} (范围: {c.min_value}-{c.max_value})")
    
    def _display_final_summary(self, results):
        print("\n" + "=" * 60)
        print("📊 流程执行总结")
        print("=" * 60)
        print(f"\n数据处理:")
        print(f"  - 原始记录数: {results['original_record_count']}")
        print(f"  - 有效记录数: {results['processed_record_count']}")
        print(f"  - 质量问题数: {results['quality_issues_count']}")
        
        print(f"\n优化结果:")
        if results['recipe_found']:
            print(f"  - 状态: ✅ 成功找到配方")
        else:
            print(f"  - 状态: ❌ 未找到可行配方")
        
        print(f"\n生成的报告:")
        for report_type, path in results['reports'].items():
            print(f"  - {report_type}: {path}")


def main():
    print("\n🥗 食品营养配方优化系统")
    print("=" * 60)
    
    pipeline = NutritionOptimizerPipeline()
    
    input_file = None
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    
    try:
        results = pipeline.run(input_file)
        return 0 if results.get('success', False) else 1
    except Exception as e:
        pipeline.logger.error(f"执行过程中出错: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
