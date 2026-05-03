import sys
sys.path.insert(0, '.')

import pandas as pd
from pond_oxygen_calculator.data_parser import DataParser, DataValidationError
from pond_oxygen_calculator.model_params import ModelParameters
from pond_oxygen_calculator.calculation_engine import CalculationEngine
from pond_oxygen_calculator.scheduling_optimizer import SchedulingOptimizer
from pond_oxygen_calculator.config import DEFAULT_CONFIG

parser = DataParser()
df = parser.parse_csv('examples/high_risk_sample.csv')

print("=== 输入数据 ===")
print(df.groupby('pond_id').agg({
    'dissolved_oxygen': ['min', 'max', 'mean'],
    'fish_density': 'first'
}))
print()

model_params = ModelParameters()
calc_engine = CalculationEngine(model_params=model_params)

print("=== 计算池塘结果 ===")
pond_results = calc_engine.calculate_ponds(df)
for pond_id, result in pond_results.items():
    print(f"池塘 {pond_id}: 整体风险={result.summary['overall_risk']}")
    print(f"  最低溶氧={result.summary['min_do']}, 夜间最低={result.summary['min_night_do']}")
print()

print("=== 检查预测的夜间溶氧 ===")
scheduler = SchedulingOptimizer()
for pond_id in df['pond_id'].unique():
    pond_df = df[df['pond_id'] == pond_id].sort_values('timestamp')
    
    timestamps, predicted_do, risk_levels = calc_engine.predict_night_do(
        pond_df,
        aerator_count=4,
        pond_area=1.0,
        water_depth=1.5,
        fish_species='tilapia'
    )
    
    print(f"\n池塘 {pond_id}:")
    print(f"  最后一条记录时间: {pond_df.iloc[-1]['timestamp']}")
    print(f"  最后一条记录溶氧: {pond_df.iloc[-1]['dissolved_oxygen']}")
    print(f"  预测时段数: {len(timestamps)}")
    print(f"  预测溶氧范围: {min(predicted_do):.2f} - {max(predicted_do):.2f}")
    print(f"  预测风险等级: {set(risk_levels)}")
    print(f"  前5个预测值: {list(zip([t.hour for t in timestamps[:5]], predicted_do[:5], risk_levels[:5]))}")
