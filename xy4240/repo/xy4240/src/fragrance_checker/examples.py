"""
示例数据模块 - 提供 init 命令生成的示例文件内容
"""

import os
from typing import Dict, Tuple


class ExampleDataGenerator:
    """示例数据生成器"""
    
    @staticmethod
    def get_formula_csv() -> str:
        """获取示例配方 CSV 内容
        
        格式说明：
        - 第一行：表头（包含配方和原料的所有字段）
        - 第二行：配方元数据（ingredient_ 前缀的字段为空）
        - 后续行：原料数据（配方字段重复或留空）
        """
        return """formula_id,formula_name,formula_version,formula_created_date,formula_total_amount,formula_unit,formula_notes,ingredient_raw_material_id,ingredient_amount,ingredient_unit,ingredient_batch_number,ingredient_notes
F001,玫瑰花香水,1.0,2024-01-15,100.0,g,经典玫瑰配方,,,,,
F001,,,,,,,RM001,15.0,g,BATCH001,玫瑰精油 - 保加利亚
F001,,,,,,,RM002,8.0,g,BATCH002,柠檬精油
F001,,,,,,,RM003,5.0,g,BATCH003,香叶醇
F001,,,,,,,RM004,2.0,g,BATCH004,芳樟醇
F001,,,,,,,RM005,70.0,g,BATCH005,乙醇 - 95%
"""
    
    @staticmethod
    def get_raw_materials_csv() -> str:
        """获取示例原料 CSV 内容"""
        return """id,name,cas_number,molecular_weight,density,flash_point,allergens,is_ethanol,is_fragrance,unit_cost
RM001,玫瑰精油,8007-01-0,154.25,0.87,100,linalool;geraniol;citronellol,False,True,2.5
RM002,柠檬精油,8008-56-8,136.24,0.85,45,limonene;linalool,False,True,0.8
RM003,香叶醇,106-24-1,154.25,0.88,121,geraniol,False,True,1.2
RM004,芳樟醇,78-70-6,154.25,0.86,75,linalool,False,True,1.0
RM005,乙醇,64-17-5,46.07,0.79,12,,True,False,0.05
RM006,麝香酮,541-91-3,224.34,0.92,145,,False,True,5.0
RM999,禁用物质测试,000-00-0,0.0,1.0,0,,False,True,0.0
"""
    
    @staticmethod
    def get_batches_csv() -> str:
        """获取示例批次 CSV 内容"""
        return """batch_number,raw_material_id,manufacture_date,expiry_date,supplier,supplier_batch,quantity,unit,purity,notes
BATCH001,RM001,2024-01-01,2026-01-01,保加利亚香料公司,SUP001,500.0,g,1.0,优质玫瑰精油
BATCH002,RM002,2024-02-01,2025-02-01,意大利柑橘厂,SUP002,300.0,g,1.0,冷榨柠檬油
BATCH003,RM003,2023-06-01,2024-06-01,德国香料公司,SUP003,100.0,g,0.99,合成香叶醇
BATCH004,RM004,2024-03-01,2026-03-01,法国香料公司,SUP004,200.0,g,0.98,天然芳樟醇
BATCH005,RM005,2024-01-01,2027-01-01,本地化工厂,SUP005,5000.0,g,0.95,食用级乙醇
BATCH006,RM001,2023-12-01,2024-05-01,老供应商,SUP006,50.0,g,1.0,即将过期批次
"""
    
    @staticmethod
    def get_rules_yaml() -> str:
        """获取示例规则 YAML 内容"""
        return """name: "IFRA 49th Amendment + EU 过敏原规则"
version: "49.0"
description: "基于 IFRA 第49修正案和欧盟化妆品法规的合规规则"

ifra_rules:
  - raw_material_id: "RM001"
    limit_type: "max_concentration"
    limit_value: 0.20
    product_category: "fine-fragrance"
    notes: "玫瑰精油在香水类产品中的最大限制为20%"
  
  - raw_material_id: "RM003"
    limit_type: "max_concentration"
    limit_value: 0.08
    product_category: "leave-on"
    notes: "香叶醇在驻留类产品中的最大限制为8%"
  
  - raw_material_id: "RM004"
    limit_type: "max_concentration"
    limit_value: 0.05
    product_category: "rinse-off"
    notes: "芳樟醇在洗去类产品中的最大限制为5%"

allergen_rules:
  - allergen_type: "linalool"
    reporting_threshold: 0.001
    restriction_limit: 0.08
    notes: "芳樟醇报告阈值0.1%，限制值8%"
  
  - allergen_type: "limonene"
    reporting_threshold: 0.001
    restriction_limit: 0.10
    notes: "柠檬烯报告阈值0.1%，限制值10%"
  
  - allergen_type: "geraniol"
    reporting_threshold: 0.001
    restriction_limit: 0.08
    notes: "香叶醇报告阈值0.1%，限制值8%"
  
  - allergen_type: "citronellol"
    reporting_threshold: 0.001
    restriction_limit: null
    notes: "香茅醇报告阈值0.1%，无特定限制"

banned_substances:
  - "RM999"
"""
    
    @staticmethod
    def get_config_yaml() -> str:
        """获取示例配置 YAML 内容"""
        return """project_name: "我的调香工作室"
data_directory: "./data"
default_currency: "CNY"
drop_conversion: 0.05
default_density: 1.0

paths:
  formulas: "${data_directory}/formulas"
  raw_materials: "${data_directory}/raw_materials"
  batches: "${data_directory}/batches"
  rules: "${data_directory}/rules"
  reports: "${data_directory}/reports"
"""
    
    @classmethod
    def generate_all(cls, output_dir: str) -> Dict[str, str]:
        """
        生成所有示例文件
        
        Args:
            output_dir: 输出目录
        
        Returns:
            Dict[str, str]: 文件名到路径的映射
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # 创建子目录
        subdirs = ["formulas", "raw_materials", "batches", "rules", "reports"]
        for subdir in subdirs:
            os.makedirs(os.path.join(output_dir, subdir), exist_ok=True)
        
        generated_files = {}
        
        # 配方文件
        formula_path = os.path.join(output_dir, "formulas", "example_formula.csv")
        with open(formula_path, 'w', encoding='utf-8', newline='') as f:
            f.write(cls.get_formula_csv())
        generated_files["formula"] = formula_path
        
        # 原料文件
        materials_path = os.path.join(output_dir, "raw_materials", "example_materials.csv")
        with open(materials_path, 'w', encoding='utf-8', newline='') as f:
            f.write(cls.get_raw_materials_csv())
        generated_files["raw_materials"] = materials_path
        
        # 批次文件
        batches_path = os.path.join(output_dir, "batches", "example_batches.csv")
        with open(batches_path, 'w', encoding='utf-8', newline='') as f:
            f.write(cls.get_batches_csv())
        generated_files["batches"] = batches_path
        
        # 规则文件
        rules_path = os.path.join(output_dir, "rules", "example_rules.yaml")
        with open(rules_path, 'w', encoding='utf-8') as f:
            f.write(cls.get_rules_yaml())
        generated_files["rules"] = rules_path
        
        # 配置文件
        config_path = os.path.join(output_dir, "config.yaml")
        with open(config_path, 'w', encoding='utf-8') as f:
            f.write(cls.get_config_yaml())
        generated_files["config"] = config_path
        
        return generated_files
