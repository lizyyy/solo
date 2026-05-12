#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
便利店鲜食报废预测器 - 核心预测类
"""
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict
import warnings
warnings.filterwarnings('ignore')

class FreshFoodWastePredictor:
    def __init__(self, sales_file=None, inventory_file=None, 
                 weather_file=None, holiday_file=None):
        self.sales_file = sales_file
        self.inventory_file = inventory_file
        self.weather_file = weather_file
        self.holiday_file = holiday_file
        
        self.sales_data = None
        self.inventory_data = None
        self.weather_data = None
        self.holiday_data = None
        
        self.cleaned_sales = None
        self.cleaned_inventory = None
        self.cleaned_weather = None
        self.cleaned_holiday = None
        
        self.issues = []  # 数据问题记录
        self.predictions = []
        self.reports = []
        
        self.REQUIRED_SALES_FIELDS = ['日期', '商品编码', '商品名称', '分类', '销量', '单价']
        self.REQUIRED_INVENTORY_FIELDS = ['日期', '商品编码', '商品名称', '分类', 
                                          '库存数量', '生产日期', '保质期天数']
        self.REQUIRED_WEATHER_FIELDS = ['日期', '天气', '最高温度', '最低温度']
        self.REQUIRED_HOLIDAY_FIELDS = ['日期', '是否节假日', '节假日名称']
        
        self.FRESH_CATEGORIES = ['关东煮', '便当', '寿司', '饭团', '三明治', 
                                '沙拉', '熟食', '面包', '包子馒头', '烤肠']
        
        self.CATEGORY_SHELF_LIFE = {
            '关东煮': 1,
            '便当': 1,
            '寿司': 1,
            '饭团': 2,
            '三明治': 2,
            '沙拉': 1,
            '熟食': 1,
            '面包': 3,
            '包子馒头': 1,
            '烤肠': 1
        }
        
        self.WEATHER_EFFECT = {
            '晴': 1.0,
            '多云': 0.95,
            '阴': 0.9,
            '小雨': 0.8,
            '中雨': 0.7,
            '大雨': 0.6,
            '暴雨': 0.5,
            '雪': 0.6,
            '雾': 0.85,
            '雷阵雨': 0.65
        }
        
        self.HOLIDAY_EFFECT = {
            '工作日': 1.0,
            '周末': 1.2,
            '法定节假日': 1.3,
            '春节': 1.5,
            '国庆节': 1.4,
            '劳动节': 1.3,
            '元旦': 1.25,
            '中秋节': 1.35,
            '端午节': 1.3,
            '清明节': 1.2,
            '情人节': 1.4,
            '圣诞节': 1.45
        }
    
    def load_all_data(self):
        print("\n[1/5] 加载数据...")
        
        if self.sales_file and os.path.exists(self.sales_file):
            self.sales_data = pd.read_csv(self.sales_file, encoding='utf-8')
            print(f"  ✓ 销量数据: {len(self.sales_data)} 条记录")
        
        if self.inventory_file and os.path.exists(self.inventory_file):
            self.inventory_data = pd.read_csv(self.inventory_file, encoding='utf-8')
            print(f"  ✓ 库存数据: {len(self.inventory_data)} 条记录")
        
        if self.weather_file and os.path.exists(self.weather_file):
            self.weather_data = pd.read_csv(self.weather_file, encoding='utf-8')
            print(f"  ✓ 天气数据: {len(self.weather_data)} 条记录")
        
        if self.holiday_file and os.path.exists(self.holiday_file):
            self.holiday_data = pd.read_csv(self.holiday_file, encoding='utf-8')
            print(f"  ✓ 节假日数据: {len(self.holiday_data)} 条记录")
        
        return True
    
    def validate_data_structure(self, data, required_fields, data_type="数据"):
        issues = []
        if data is None:
            issues.append(f"⚠️ {data_type}未加载")
            return issues
        
        missing_fields = []
        for field in required_fields:
            if field not in data.columns:
                missing_fields.append(field)
        
        if missing_fields:
            issues.append(f"❌ {data_type}缺少必要字段: {', '.join(missing_fields)}")
        else:
            issues.append(f"✓ {data_type}字段完整")
        
        return issues
    
    def check_missing_values(self, data, data_type="数据"):
        issues = []
        if data is None:
            return issues
        
        missing_count = data.isnull().sum().sum()
        if missing_count > 0:
            issues.append(f"⚠️ {data_type}存在 {missing_count} 个缺失值")
            for col in data.columns:
                col_missing = data[col].isnull().sum()
                if col_missing > 0:
                    issues.append(f"  - 字段 '{col}' 缺失 {col_missing} 条")
        else:
            issues.append(f"✓ {data_type}无缺失值")
        
        return issues
    
    def check_duplicates(self, data, key_fields, data_type="数据"):
        issues = []
        if data is None:
            return issues
        
        duplicate_mask = data.duplicated(subset=key_fields, keep=False)
        duplicate_count = duplicate_mask.sum()
        
        if duplicate_count > 0:
            issues.append(f"❌ {data_type}存在 {duplicate_count} 条重复记录")
            duplicate_rows = data[duplicate_mask].head(5)
            for idx, row in duplicate_rows.iterrows():
                key_info = ", ".join([f"{k}: {row[k]}" for k in key_fields])
                issues.append(f"  - 第{idx+2}行: {key_info}")
        else:
            issues.append(f"✓ {data_type}无重复记录")
        
        return issues
    
    def check_anomalous_values(self, data, data_type="数据"):
        issues = []
        if data is None:
            return issues
        
        if '销量' in data.columns:
            invalid_sales = data[(data['销量'] < 0) | (data['销量'] > 1000)]
            if len(invalid_sales) > 0:
                issues.append(f"⚠️ {data_type}存在异常销量值 ({len(invalid_sales)} 条)")
                for idx, row in invalid_sales.head(3).iterrows():
                    issues.append(f"  - 第{idx+2}行: {row['商品名称']} 销量={row['销量']}")
        
        if '库存数量' in data.columns:
            invalid_inventory = data[data['库存数量'] < 0]
            if len(invalid_inventory) > 0:
                issues.append(f"⚠️ {data_type}存在异常库存值 ({len(invalid_inventory)} 条)")
        
        if '单价' in data.columns:
            invalid_price = data[(data['单价'] <= 0) | (data['单价'] > 100)]
            if len(invalid_price) > 0:
                issues.append(f"⚠️ {data_type}存在异常价格 ({len(invalid_price)} 条)")
        
        if '保质期天数' in data.columns:
            invalid_shelf = data[(data['保质期天数'] <= 0) | (data['保质期天数'] > 30)]
            if len(invalid_shelf) > 0:
                issues.append(f"⚠️ {data_type}存在异常保质期 ({len(invalid_shelf)} 条)")
        
        return issues
    
    def check_date_consistency(self):
        issues = []
        
        all_dates = set()
        data_sources = []
        
        if self.sales_data is not None and '日期' in self.sales_data.columns:
            sales_dates = set(self.sales_data['日期'])
            data_sources.append(('销量', sales_dates))
        
        if self.inventory_data is not None and '日期' in self.inventory_data.columns:
            inv_dates = set(self.inventory_data['日期'])
            data_sources.append(('库存', inv_dates))
        
        if self.weather_data is not None and '日期' in self.weather_data.columns:
            weather_dates = set(self.weather_data['日期'])
            data_sources.append(('天气', weather_dates))
        
        if self.holiday_data is not None and '日期' in self.holiday_data.columns:
            holiday_dates = set(self.holiday_data['日期'])
            data_sources.append(('节假日', holiday_dates))
        
        if len(data_sources) >= 2:
            for name, dates in data_sources[1:]:
                base_dates = data_sources[0][1]
                missing = base_dates - dates
                extra = dates - base_dates
                if missing:
                    issues.append(f"⚠️ {name}数据缺少 {len(missing)} 天的数据")
                if extra:
                    issues.append(f"⚠️ {name}数据多出 {len(extra)} 天的数据")
        
        return issues
    
    def validate_all_data(self):
        print("\n[2/5] 数据验证...")
        self.issues = []
        
        self.issues.append("\n" + "="*50)
        self.issues.append("数据结构验证")
        self.issues.append("="*50)
        
        self.issues.extend(self.validate_data_structure(
            self.sales_data, self.REQUIRED_SALES_FIELDS, "销量数据"))
        self.issues.extend(self.validate_data_structure(
            self.inventory_data, self.REQUIRED_INVENTORY_FIELDS, "库存数据"))
        self.issues.extend(self.validate_data_structure(
            self.weather_data, self.REQUIRED_WEATHER_FIELDS, "天气数据"))
        self.issues.extend(self.validate_data_structure(
            self.holiday_data, self.REQUIRED_HOLIDAY_FIELDS, "节假日数据"))
        
        self.issues.append("\n" + "="*50)
        self.issues.append("缺失值检查")
        self.issues.append("="*50)
        self.issues.extend(self.check_missing_values(self.sales_data, "销量数据"))
        self.issues.extend(self.check_missing_values(self.inventory_data, "库存数据"))
        self.issues.extend(self.check_missing_values(self.weather_data, "天气数据"))
        self.issues.extend(self.check_missing_values(self.holiday_data, "节假日数据"))
        
        self.issues.append("\n" + "="*50)
        self.issues.append("重复数据检查")
        self.issues.append("="*50)
        self.issues.extend(self.check_duplicates(
            self.sales_data, ['日期', '商品编码'], "销量数据"))
        self.issues.extend(self.check_duplicates(
            self.inventory_data, ['日期', '商品编码', '生产日期'], "库存数据"))
        
        self.issues.append("\n" + "="*50)
        self.issues.append("异常值检查")
        self.issues.append("="*50)
        self.issues.extend(self.check_anomalous_values(self.sales_data, "销量数据"))
        self.issues.extend(self.check_anomalous_values(self.inventory_data, "库存数据"))
        
        self.issues.append("\n" + "="*50)
        self.issues.append("日期一致性检查")
        self.issues.append("="*50)
        self.issues.extend(self.check_date_consistency())
        
        for issue in self.issues:
            print(issue)
        
        return self.issues
    
    def clean_sales_data(self):
        if self.sales_data is None:
            return None
        
        cleaned = self.sales_data.copy()
        
        print("\n  清洗销量数据:")
        
        dup_count = cleaned.duplicated(subset=['日期', '商品编码']).sum()
        if dup_count > 0:
            cleaned = cleaned.drop_duplicates(subset=['日期', '商品编码'], keep='last')
            print(f"  - 删除重复记录: {dup_count} 条")
        
        cleaned['日期'] = pd.to_datetime(cleaned['日期'], errors='coerce')
        invalid_dates = cleaned['日期'].isnull().sum()
        if invalid_dates > 0:
            cleaned = cleaned.dropna(subset=['日期'])
            print(f"  - 删除无效日期记录: {invalid_dates} 条")
        
        if '分类' in cleaned.columns:
            cleaned['分类'] = cleaned['分类'].fillna('未知分类')
        
        if '销量' in cleaned.columns:
            median_sales = cleaned['销量'].median()
            cleaned.loc[cleaned['销量'] < 0, '销量'] = 0
            cleaned.loc[cleaned['销量'] > 1000, '销量'] = median_sales
            fixed_count = ((self.sales_data['销量'] < 0) | (self.sales_data['销量'] > 1000)).sum()
            if fixed_count > 0:
                print(f"  - 修正异常销量: {fixed_count} 条")
        
        if '单价' in cleaned.columns:
            median_price = cleaned['单价'].median()
            cleaned.loc[(cleaned['单价'] <= 0) | (cleaned['单价'] > 100), '单价'] = median_price
        
        print(f"  ✓ 清洗后销量数据: {len(cleaned)} 条记录")
        return cleaned
    
    def clean_inventory_data(self):
        if self.inventory_data is None:
            return None
        
        cleaned = self.inventory_data.copy()
        
        print("\n  清洗库存数据:")
        
        dup_count = cleaned.duplicated(subset=['日期', '商品编码', '生产日期']).sum()
        if dup_count > 0:
            cleaned = cleaned.drop_duplicates(subset=['日期', '商品编码', '生产日期'], keep='last')
            print(f"  - 删除重复记录: {dup_count} 条")
        
        cleaned['日期'] = pd.to_datetime(cleaned['日期'], errors='coerce')
        cleaned['生产日期'] = pd.to_datetime(cleaned['生产日期'], errors='coerce')
        
        for col in ['日期', '生产日期']:
            invalid = cleaned[col].isnull().sum()
            if invalid > 0:
                cleaned = cleaned.dropna(subset=[col])
                print(f"  - 删除无效{col}记录: {invalid} 条")
        
        if '保质期天数' in cleaned.columns and '分类' in cleaned.columns:
            for idx, row in cleaned.iterrows():
                if pd.isnull(row['保质期天数']) or row['保质期天数'] <= 0 or row['保质期天数'] > 30:
                    category = row['分类']
                    if category in self.CATEGORY_SHELF_LIFE:
                        cleaned.at[idx, '保质期天数'] = self.CATEGORY_SHELF_LIFE[category]
        
        if '库存数量' in cleaned.columns:
            cleaned.loc[cleaned['库存数量'] < 0, '库存数量'] = 0
        
        print(f"  ✓ 清洗后库存数据: {len(cleaned)} 条记录")
        return cleaned
    
    def clean_weather_data(self):
        if self.weather_data is None:
            return None
        
        cleaned = self.weather_data.copy()
        
        print("\n  清洗天气数据:")
        
        cleaned['日期'] = pd.to_datetime(cleaned['日期'], errors='coerce')
        invalid_dates = cleaned['日期'].isnull().sum()
        if invalid_dates > 0:
            cleaned = cleaned.dropna(subset=['日期'])
            print(f"  - 删除无效日期记录: {invalid_dates} 条")
        
        if '天气' in cleaned.columns:
            valid_weathers = list(self.WEATHER_EFFECT.keys())
            cleaned['天气'] = cleaned['天气'].fillna('晴')
            cleaned['天气'] = cleaned['天气'].apply(
                lambda x: x if x in valid_weathers else '晴')
        
        if '最高温度' in cleaned.columns:
            cleaned['最高温度'] = pd.to_numeric(cleaned['最高温度'], errors='coerce')
            median_high = cleaned['最高温度'].median()
            cleaned['最高温度'] = cleaned['最高温度'].fillna(median_high)
        
        if '最低温度' in cleaned.columns:
            cleaned['最低温度'] = pd.to_numeric(cleaned['最低温度'], errors='coerce')
            median_low = cleaned['最低温度'].median()
            cleaned['最低温度'] = cleaned['最低温度'].fillna(median_low)
        
        print(f"  ✓ 清洗后天气数据: {len(cleaned)} 条记录")
        return cleaned
    
    def clean_holiday_data(self):
        if self.holiday_data is None:
            return None
        
        cleaned = self.holiday_data.copy()
        
        print("\n  清洗节假日数据:")
        
        cleaned['日期'] = pd.to_datetime(cleaned['日期'], errors='coerce')
        invalid_dates = cleaned['日期'].isnull().sum()
        if invalid_dates > 0:
            cleaned = cleaned.dropna(subset=['日期'])
            print(f"  - 删除无效日期记录: {invalid_dates} 条")
        
        if '是否节假日' in cleaned.columns:
            cleaned['是否节假日'] = cleaned['是否节假日'].fillna('否')
        
        if '节假日名称' in cleaned.columns:
            cleaned['节假日名称'] = cleaned['节假日名称'].fillna('工作日')
        
        print(f"  ✓ 清洗后节假日数据: {len(cleaned)} 条记录")
        return cleaned
    
    def clean_all_data(self):
        print("\n[3/5] 数据清洗...")
        
        self.cleaned_sales = self.clean_sales_data()
        self.cleaned_inventory = self.clean_inventory_data()
        self.cleaned_weather = self.clean_weather_data()
        self.cleaned_holiday = self.clean_holiday_data()
        
        return True
    
    def calculate_expiry_risk(self, row, check_date):
        if '生产日期' not in row.index or '保质期天数' not in row.index:
            return 0, "无法计算临期风险"
        
        production_date = row['生产日期']
        if pd.isnull(production_date):
            return 0, "生产日期缺失"
        
        shelf_life = row['保质期天数']
        if pd.isnull(shelf_life) or shelf_life <= 0:
            return 0, "保质期无效"
        
        expiry_date = production_date + timedelta(days=int(shelf_life))
        days_to_expiry = (expiry_date - check_date).days
        
        if days_to_expiry <= 0:
            return 1.0, f"已过期 (过期{-days_to_expiry}天)"
        elif days_to_expiry == 1:
            return 0.8, f"临期警告 (仅剩1天保质期)"
        elif days_to_expiry == 2:
            return 0.5, f"临近过期 (剩余2天保质期)"
        elif days_to_expiry <= 3:
            return 0.3, f"即将临期 (剩余{days_to_expiry}天保质期)"
        else:
            return 0.0, f"正常 (剩余{days_to_expiry}天保质期)"
    
    def calculate_weather_impact(self, date):
        if self.cleaned_weather is None:
            return 1.0, "无天气数据"
        
        weather_row = self.cleaned_weather[self.cleaned_weather['日期'] == date]
        if len(weather_row) == 0:
            return 1.0, "无对应日期天气数据"
        
        weather = weather_row.iloc[0]['天气']
        high_temp = weather_row.iloc[0]['最高温度']
        
        weather_factor = self.WEATHER_EFFECT.get(weather, 1.0)
        
        temp_factor = 1.0
        if high_temp > 30:
            temp_factor = 0.85
            temp_note = "高温天气"
        elif high_temp > 25:
            temp_factor = 0.95
            temp_note = "温暖天气"
        elif high_temp < 5:
            temp_factor = 0.8
            temp_note = "寒冷天气"
        else:
            temp_factor = 1.0
            temp_note = "适宜温度"
        
        combined_factor = weather_factor * temp_factor
        
        return combined_factor, f"天气:{weather}, {temp_note}"
    
    def calculate_holiday_impact(self, date):
        if self.cleaned_holiday is None:
            return 1.0, "无节假日数据"
        
        holiday_row = self.cleaned_holiday[self.cleaned_holiday['日期'] == date]
        if len(holiday_row) == 0:
            day_of_week = date.weekday()
            if day_of_week >= 5:
                return 1.2, "周末"
            else:
                return 1.0, "工作日"
        
        is_holiday = holiday_row.iloc[0]['是否节假日']
        holiday_name = holiday_row.iloc[0]['节假日名称']
        
        if is_holiday == '是' or is_holiday == True:
            factor = self.HOLIDAY_EFFECT.get(holiday_name, 1.3)
            return factor, f"节假日: {holiday_name}"
        else:
            day_of_week = date.weekday()
            if day_of_week >= 5:
                return 1.2, "周末"
            else:
                return 1.0, "工作日"
    
    def calculate_sales_trend(self, product_code, category, date):
        if self.cleaned_sales is None:
            return 1.0, "无销量数据"
        
        product_sales = self.cleaned_sales[self.cleaned_sales['商品编码'] == product_code]
        if len(product_sales) == 0:
            category_sales = self.cleaned_sales[self.cleaned_sales['分类'] == category]
            if len(category_sales) == 0:
                return 1.0, "无同类产品历史销量"
            avg_sales = category_sales['销量'].mean()
            return 1.0, f"使用分类平均销量 ({avg_sales:.1f}件/天)"
        
        recent_sales = product_sales[product_sales['日期'] <= date].tail(7)
        if len(recent_sales) < 3:
            avg_sales = product_sales['销量'].mean()
            return 1.0, f"历史平均销量 ({avg_sales:.1f}件/天)"
        
        avg_recent = recent_sales['销量'].mean()
        avg_all = product_sales['销量'].mean()
        
        if avg_all == 0:
            trend_factor = 1.0
        else:
            trend_factor = avg_recent / avg_all
        
        trend_note = f"近期销量趋势: {'上升' if trend_factor > 1.1 else '下降' if trend_factor < 0.9 else '平稳'}"
        
        return trend_factor, f"{trend_note} (近期:{avg_recent:.1f}, 历史:{avg_all:.1f})"
    
    def predict_waste_risk(self):
        print("\n[4/5] 报废预测分析...")
        self.predictions = []
        
        if self.cleaned_inventory is None:
            print("⚠️ 无库存数据，无法进行预测")
            return []
        
        unique_dates = sorted(self.cleaned_inventory['日期'].unique())
        
        for check_date in unique_dates:
            daily_inventory = self.cleaned_inventory[self.cleaned_inventory['日期'] == check_date]
            
            for idx, inv_row in daily_inventory.iterrows():
                product_code = inv_row['商品编码']
                product_name = inv_row['商品名称']
                category = inv_row.get('分类', '未知')
                inventory_qty = inv_row['库存数量']
                
                expiry_risk, expiry_reason = self.calculate_expiry_risk(inv_row, check_date)
                
                weather_factor, weather_reason = self.calculate_weather_impact(check_date)
                
                holiday_factor, holiday_reason = self.calculate_holiday_impact(check_date)
                
                trend_factor, trend_reason = self.calculate_sales_trend(
                    product_code, category, check_date)
                
                if expiry_risk >= 0.8:
                    adjusted_waste_rate = 1.0
                else:
                    base_waste_rate = 0.1
                    if expiry_risk >= 0.5:
                        base_waste_rate = 0.6
                    elif expiry_risk >= 0.3:
                        base_waste_rate = 0.3
                    
                    demand_factor = weather_factor * holiday_factor * max(0.5, trend_factor)
                    if demand_factor > 1:
                        adjusted_waste_rate = base_waste_rate / demand_factor
                    else:
                        adjusted_waste_rate = base_waste_rate / demand_factor
                    
                    adjusted_waste_rate = max(0.05, min(0.95, adjusted_waste_rate))
                
                predicted_waste = inventory_qty * adjusted_waste_rate
                
                risk_level = "低风险"
                if adjusted_waste_rate >= 0.7:
                    risk_level = "高风险"
                elif adjusted_waste_rate >= 0.4:
                    risk_level = "中风险"
                
                prediction = {
                    '日期': check_date,
                    '商品编码': product_code,
                    '商品名称': product_name,
                    '分类': category,
                    '库存数量': inventory_qty,
                    '预测报废数量': round(predicted_waste, 2),
                    '预测报废率': round(adjusted_waste_rate * 100, 1),
                    '风险等级': risk_level,
                    '临期状态': expiry_reason,
                    '天气影响': weather_reason,
                    '节假日影响': holiday_reason,
                    '销量趋势': trend_reason,
                    '综合评分': round(adjusted_waste_rate * 100, 1)
                }
                
                self.predictions.append(prediction)
        
        print(f"  ✓ 完成 {len(self.predictions)} 条商品的报废风险预测")
        return self.predictions
    
    def generate_report(self, output_file):
        print("\n[5/5] 生成预测报告...")
        
        report_lines = []
        report_lines.append("="*70)
        report_lines.append("便利店鲜食报废预测报告")
        report_lines.append("="*70)
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        if not self.predictions:
            report_lines.append("⚠️ 无预测数据")
        else:
            predictions_df = pd.DataFrame(self.predictions)
            
            total_inventory = predictions_df['库存数量'].sum()
            total_predicted_waste = predictions_df['预测报废数量'].sum()
            overall_waste_rate = (total_predicted_waste / total_inventory * 100) if total_inventory > 0 else 0
            
            report_lines.append("【总体情况】")
            report_lines.append("-"*70)
            report_lines.append(f"分析商品数: {len(predictions_df)} 种")
            report_lines.append(f"总库存数量: {total_inventory:.0f} 件")
            report_lines.append(f"预测报废数量: {total_predicted_waste:.1f} 件")
            report_lines.append(f"整体预测报废率: {overall_waste_rate:.1f}%")
            report_lines.append("")
            
            high_risk = predictions_df[predictions_df['风险等级'] == '高风险']
            medium_risk = predictions_df[predictions_df['风险等级'] == '中风险']
            low_risk = predictions_df[predictions_df['风险等级'] == '低风险']
            
            report_lines.append("【风险分布】")
            report_lines.append("-"*70)
            report_lines.append(f"高风险商品: {len(high_risk)} 种")
            report_lines.append(f"中风险商品: {len(medium_risk)} 种")
            report_lines.append(f"低风险商品: {len(low_risk)} 种")
            report_lines.append("")
            
            category_stats = predictions_df.groupby('分类').agg({
                '库存数量': 'sum',
                '预测报废数量': 'sum'
            }).reset_index()
            category_stats['报废率'] = (
                category_stats['预测报废数量'] / category_stats['库存数量'] * 100
            ).round(1)
            category_stats = category_stats.sort_values('报废率', ascending=False)
            
            report_lines.append("【分类报废率统计】")
            report_lines.append("-"*70)
            for _, row in category_stats.iterrows():
                report_lines.append(
                    f"{row['分类']}: 报废率 {row['报废率']}% "
                    f"(库存:{row['库存数量']:.0f}件, 预测报废:{row['预测报废数量']:.1f}件)"
                )
            report_lines.append("")
            
            report_lines.append("【高风险商品详情（带预测理由）】")
            report_lines.append("="*70)
            
            if len(high_risk) > 0:
                for _, row in high_risk.head(10).iterrows():
                    report_lines.append(f"\n【{row['商品名称']}】({row['分类']})")
                    report_lines.append("-"*50)
                    report_lines.append(f"  📅 日期: {row['日期'].strftime('%Y-%m-%d')}")
                    report_lines.append(f"  📦 库存数量: {row['库存数量']} 件")
                    report_lines.append(f"  ⚠️ 预测报废: {row['预测报废数量']} 件 ({row['预测报废率']}%)")
                    report_lines.append(f"  🎯 风险等级: {row['风险等级']}")
                    report_lines.append(f"  ")
                    report_lines.append(f"  【预测理由】")
                    report_lines.append(f"  1. 临期状态: {row['临期状态']}")
                    report_lines.append(f"  2. 天气影响: {row['天气影响']}")
                    report_lines.append(f"  3. 节假日影响: {row['节假日影响']}")
                    report_lines.append(f"  4. 销量趋势: {row['销量趋势']}")
                    report_lines.append(f"  5. 综合报废评分: {row['综合评分']}/100")
            else:
                report_lines.append("  ✓ 当前无高风险商品")
            
            if len(medium_risk) > 0:
                report_lines.append("\n" + "="*70)
                report_lines.append("【中风险商品详情（带预测理由）】")
                report_lines.append("="*70)
                
                for _, row in medium_risk.head(10).iterrows():
                    report_lines.append(f"\n【{row['商品名称']}】({row['分类']})")
                    report_lines.append("-"*50)
                    report_lines.append(f"  📅 日期: {row['日期'].strftime('%Y-%m-%d')}")
                    report_lines.append(f"  📦 库存数量: {row['库存数量']} 件")
                    report_lines.append(f"  ⚠️ 预测报废: {row['预测报废数量']} 件 ({row['预测报废率']}%)")
                    report_lines.append(f"  🎯 风险等级: {row['风险等级']}")
                    report_lines.append(f"  ")
                    report_lines.append(f"  【预测理由】")
                    report_lines.append(f"  1. 临期状态: {row['临期状态']}")
                    report_lines.append(f"  2. 天气影响: {row['天气影响']}")
                    report_lines.append(f"  3. 节假日影响: {row['节假日影响']}")
                    report_lines.append(f"  4. 销量趋势: {row['销量趋势']}")
        
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))
        
        print(f"  ✓ 报告已保存到: {output_file}")
        
        for line in report_lines[:50]:
            print(line)
        
        return report_lines
    
    def predict_and_generate_report(self, output_file):
        self.load_all_data()
        self.clean_all_data()
        self.predict_waste_risk()
        self.generate_report(output_file)
    
    def run_full_demo(self, output_file):
        print("\n" + "="*70)
        print("🏪 便利店鲜食报废预测器 - 完整演示")
        print("="*70)
        
        self.load_all_data()
        self.validate_all_data()
        self.clean_all_data()
        self.predict_waste_risk()
        self.generate_report(output_file)
        
        print("\n" + "="*70)
        print("✅ 演示完成！")
        print("="*70)
