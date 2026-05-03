import pandas as pd
import numpy as np
from datetime import date, timedelta
from typing import Dict
import random


class SampleDataGenerator:
    def __init__(self):
        self.start_date = date.today() - timedelta(days=14)
        self.end_date = date.today() - timedelta(days=1)
        self.dates = [self.start_date + timedelta(days=i) for i in range((self.end_date - self.start_date).days + 1)]
        
        self.douyin_materials = ['MAT001', 'MAT002', 'MAT003', 'MAT004', 'MAT005']
        self.xhs_materials = ['MAT001', 'MAT002', 'MAT006', 'MAT007']
        self.wxh_materials = ['MAT001', 'MAT003', 'MAT008']

    def generate_douyin_data(self) -> pd.DataFrame:
        records = []
        
        dt = self.douyin_materials
        random.seed(42)
        
        for day_idx, current_date in enumerate(self.dates):
            for material in dt:
                material_idx = dt.index(material)
                base_spend = 500 + material_idx * 200
                day_factor = 1 + (day_idx / len(self.dates)) * 0.3
                
                material_ctr = 0.03 + material_idx * 0.005
                if material == 'MAT001':
                    if day_idx > 10:
                        material_ctr = 0.015
                    else:
                        material_ctr = 0.04
                
                spend = base_spend * day_factor * random.uniform(0.8, 1.2)
                
                if day_idx == 12 and material == 'MAT002':
                    spend = base_spend * 4
                
                impressions = int(spend / random.uniform(0.5, 1.5) * 1000)
                clicks = int(impressions * material_ctr * random.uniform(0.8, 1.2))
                cvr = 0.05 + random.uniform(-0.02, 0.02)
                conversions = int(clicks * cvr)
                
                if day_idx == 8 and material == 'MAT003':
                    conversions = max(1, conversions // 4)
                
                records.append({
                    '日期': current_date.strftime('%Y-%m-%d'),
                    '素材ID': material,
                    '消耗(元)': round(spend, 2),
                    '展示次数': impressions,
                    '点击次数': clicks,
                    '转化数': conversions,
                    '平均点击单价(元)': round(spend / clicks if clicks > 0 else 0, 2),
                    '千次展示成本(元)': round(spend / impressions * 1000 if impressions > 0 else 0, 2)
                })
        
        return pd.DataFrame(records)

    def generate_xiaohongshu_data(self) -> pd.DataFrame:
        records = []
        
        xhs = self.xhs_materials
        random.seed(123)
        
        for day_idx, current_date in enumerate(self.dates):
            for material in xhs:
                material_idx = xhs.index(material)
                base_spend = 300 + material_idx * 150
                day_factor = 1 + (day_idx / len(self.dates)) * 0.2
                
                material_ctr = 0.05 + material_idx * 0.01
                if material == 'MAT001':
                    material_ctr = 0.02
                
                spend = base_spend * day_factor * random.uniform(0.7, 1.3)
                impressions = int(spend / random.uniform(0.8, 2.0) * 1000)
                clicks = int(impressions * material_ctr * random.uniform(0.9, 1.1))
                cvr = 0.04 + random.uniform(-0.015, 0.015)
                conversions = int(clicks * cvr)
                
                records.append({
                    '日期': current_date.strftime('%Y-%m-%d'),
                    '笔记ID': material,
                    '花费(元)': round(spend, 2),
                    '曝光量': impressions,
                    '点击量': clicks,
                    '转化量': conversions,
                    '点击单价(元)': round(spend / clicks if clicks > 0 else 0, 2),
                    '点击率': round(clicks / impressions * 100 if impressions > 0 else 0, 2)
                })
        
        return pd.DataFrame(records)

    def generate_weixin_video_data(self) -> pd.DataFrame:
        records = []
        
        wxh = self.wxh_materials
        random.seed(789)
        
        for day_idx, current_date in enumerate(self.dates):
            for material in wxh:
                material_idx = wxh.index(material)
                base_spend = 400 + material_idx * 100
                day_factor = 1 + (day_idx / len(self.dates)) * 0.4
                
                material_ctr = 0.02 + material_idx * 0.003
                
                spend = base_spend * day_factor * random.uniform(0.85, 1.15)
                impressions = int(spend / random.uniform(0.4, 1.2) * 1000)
                clicks = int(impressions * material_ctr * random.uniform(0.85, 1.15))
                cvr = 0.03 + random.uniform(-0.01, 0.01)
                conversions = int(clicks * cvr)
                
                records.append({
                    '日期': current_date.strftime('%Y-%m-%d'),
                    '创意ID': material,
                    '消耗金额(元)': round(spend, 2),
                    '曝光次数': impressions,
                    '点击次数': clicks,
                    '转化个数': conversions,
                    '单次点击成本(元)': round(spend / clicks if clicks > 0 else 0, 2),
                    '转化率': round(conversions / clicks * 100 if clicks > 0 else 0, 2)
                })
        
        return pd.DataFrame(records)

    def generate_transaction_data(self) -> pd.DataFrame:
        records = []
        
        random.seed(456)
        
        for day_idx, current_date in enumerate(self.dates):
            day_factor = 1 + (day_idx / len(self.dates)) * 0.3
            
            base_orders = 80 + random.randint(-20, 30)
            base_revenue = 15000 + random.randint(-3000, 5000)
            
            orders = int(base_orders * day_factor)
            revenue = base_revenue * day_factor
            
            records.append({
                '日期': current_date.strftime('%Y-%m-%d'),
                '订单数': int(orders),
                '成交金额': round(revenue, 2),
                '客单价': round(revenue / orders if orders > 0 else 0, 2)
            })
        
        return pd.DataFrame(records)

    def get_all_sample_data(self) -> Dict[str, pd.DataFrame]:
        return {
            '抖音': self.generate_douyin_data(),
            '小红书': self.generate_xiaohongshu_data(),
            '视频号': self.generate_weixin_video_data(),
            '成交数据': self.generate_transaction_data()
        }

    def save_sample_data(self, output_dir: str = '.'):
        import os
        
        data = self.get_all_sample_data()
        
        data['抖音'].to_csv(os.path.join(output_dir, 'sample_douyin.csv'), index=False, encoding='utf-8-sig')
        data['小红书'].to_csv(os.path.join(output_dir, 'sample_xiaohongshu.csv'), index=False, encoding='utf-8-sig')
        data['视频号'].to_csv(os.path.join(output_dir, 'sample_weixin_video.csv'), index=False, encoding='utf-8-sig')
        data['成交数据'].to_csv(os.path.join(output_dir, 'sample_transaction.csv'), index=False, encoding='utf-8-sig')
        
        return {
            '抖音': os.path.join(output_dir, 'sample_douyin.csv'),
            '小红书': os.path.join(output_dir, 'sample_xiaohongshu.csv'),
            '视频号': os.path.join(output_dir, 'sample_weixin_video.csv'),
            '成交数据': os.path.join(output_dir, 'sample_transaction.csv')
        }


if __name__ == '__main__':
    generator = SampleDataGenerator()
    
    sample_data = generator.get_all_sample_data()
    
    print('抖音数据:')
    print(sample_data['抖音'].head())
    print(f'\n共 {len(sample_data["抖音"])} 条记录')
    
    print('\n' + '='*50 + '\n')
    
    print('小红书数据:')
    print(sample_data['小红书'].head())
    print(f'\n共 {len(sample_data["小红书"])} 条记录')
    
    print('\n' + '='*50 + '\n')
    
    print('视频号数据:')
    print(sample_data['视频号'].head())
    print(f'\n共 {len(sample_data["视频号"])} 条记录')
    
    print('\n' + '='*50 + '\n')
    
    print('成交数据:')
    print(sample_data['成交数据'].head())
    print(f'\n共 {len(sample_data["成交数据"])} 条记录')
