"""示例数据生成器"""

import json
import csv
import yaml
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any, List


class SampleDataGenerator:
    """示例数据生成器"""
    
    @classmethod
    def generate_topology(cls) -> Dict[str, Any]:
        """生成示例拓扑数据"""
        return {
            "name": "微流控混合芯片示例",
            "version": "1.0",
            "description": "用于两种试剂混合的微流控芯片拓扑结构",
            "mixing_node": "mix",
            "inlet_reagents": {
                "in1": "reagent_a",
                "in2": "reagent_b",
            },
            "nodes": [
                {
                    "id": "in1",
                    "name": "试剂A入口",
                    "type": "inlet",
                    "x": 0,
                    "y": 10,
                    "x_unit": "mm",
                    "y_unit": "mm"
                },
                {
                    "id": "in2",
                    "name": "试剂B入口",
                    "type": "inlet",
                    "x": 0,
                    "y": 30,
                    "x_unit": "mm",
                    "y_unit": "mm"
                },
                {
                    "id": "j1",
                    "name": "中间节点1",
                    "type": "junction",
                    "x": 20,
                    "y": 10,
                    "x_unit": "mm",
                    "y_unit": "mm"
                },
                {
                    "id": "j2",
                    "name": "中间节点2",
                    "type": "junction",
                    "x": 20,
                    "y": 30,
                    "x_unit": "mm",
                    "y_unit": "mm"
                },
                {
                    "id": "mix",
                    "name": "混合节点",
                    "type": "junction",
                    "x": 40,
                    "y": 20,
                    "x_unit": "mm",
                    "y_unit": "mm"
                },
                {
                    "id": "out",
                    "name": "出口",
                    "type": "outlet",
                    "x": 70,
                    "y": 20,
                    "x_unit": "mm",
                    "y_unit": "mm"
                }
            ],
            "channels": [
                {
                    "id": "ch1",
                    "name": "试剂A主通道",
                    "type": "rectangular",
                    "from": "in1",
                    "to": "j1",
                    "width": 100,
                    "width_unit": "μm",
                    "height": 50,
                    "height_unit": "μm",
                    "length": 20,
                    "length_unit": "mm"
                },
                {
                    "id": "ch2",
                    "name": "试剂B主通道",
                    "type": "rectangular",
                    "from": "in2",
                    "to": "j2",
                    "width": 100,
                    "width_unit": "μm",
                    "height": 50,
                    "height_unit": "μm",
                    "length": 20,
                    "length_unit": "mm"
                },
                {
                    "id": "ch3",
                    "name": "试剂A混合前通道",
                    "type": "rectangular",
                    "from": "j1",
                    "to": "mix",
                    "width": 50,
                    "width_unit": "μm",
                    "height": 50,
                    "height_unit": "μm",
                    "length": 25,
                    "length_unit": "mm"
                },
                {
                    "id": "ch4",
                    "name": "试剂B混合前通道",
                    "type": "rectangular",
                    "from": "j2",
                    "to": "mix",
                    "width": 50,
                    "width_unit": "μm",
                    "height": 50,
                    "height_unit": "μm",
                    "length": 25,
                    "length_unit": "mm"
                },
                {
                    "id": "ch5",
                    "name": "混合后通道",
                    "type": "rectangular",
                    "from": "mix",
                    "to": "out",
                    "width": 150,
                    "width_unit": "μm",
                    "height": 50,
                    "height_unit": "μm",
                    "length": 30,
                    "length_unit": "mm"
                }
            ]
        }
    
    @classmethod
    def generate_pump_program_rows(cls) -> List[Dict[str, str]]:
        """生成示例泵程序CSV行数据"""
        return [
            {
                "Segment": "1",
                "Duration": "60",
                "Duration_Unit": "s",
                "in1_Flow": "10",
                "in1_Unit": "μL/min",
                "in2_Flow": "10",
                "in2_Unit": "μL/min",
                "Description": "初始稳定阶段 - 1:1 混合"
            },
            {
                "Segment": "2",
                "Duration": "120",
                "Duration_Unit": "s",
                "in1_Flow": "15",
                "in1_Unit": "μL/min",
                "in2_Flow": "5",
                "in2_Unit": "μL/min",
                "Description": "梯度变化1 - 3:1 混合"
            },
            {
                "Segment": "3",
                "Duration": "120",
                "Duration_Unit": "s",
                "in1_Flow": "5",
                "in1_Unit": "μL/min",
                "in2_Flow": "15",
                "in2_Unit": "μL/min",
                "Description": "梯度变化2 - 1:3 混合"
            },
            {
                "Segment": "4",
                "Duration": "60",
                "Duration_Unit": "s",
                "in1_Flow": "10",
                "in1_Unit": "μL/min",
                "in2_Flow": "10",
                "in2_Unit": "μL/min",
                "Description": "恢复阶段 - 1:1 混合"
            },
            {
                "Segment": "5",
                "Duration": "30",
                "Duration_Unit": "s",
                "in1_Flow": "0",
                "in1_Unit": "μL/min",
                "in2_Flow": "0",
                "in2_Unit": "μL/min",
                "Description": "停止阶段"
            }
        ]
    
    @classmethod
    def generate_viscosity_data(cls) -> Dict[str, Any]:
        """生成示例黏度数据"""
        return {
            "name": "试剂黏度配置",
            "description": "示例实验的试剂黏度参数",
            "experiment_temperature": {
                "value": 25,
                "unit": "C"
            },
            "target_ratios": {
                "reagent_a": 0.5,
                "reagent_b": 0.5
            },
            "reagents": [
                {
                    "id": "reagent_a",
                    "name": "PBS缓冲液",
                    "description": "磷酸盐缓冲生理盐水",
                    "viscosity": {
                        "value": 1.0,
                        "unit": "mPa·s"
                    },
                    "temperature": {
                        "value": 25,
                        "unit": "C"
                    },
                    "density": {
                        "value": 1000,
                        "unit": "kg/m3"
                    },
                    "target_ratio": 0.5
                },
                {
                    "id": "reagent_b",
                    "name": "10%甘油溶液",
                    "description": "甘油水溶液作为对照",
                    "viscosity": {
                        "value": 1.3,
                        "unit": "mPa·s"
                    },
                    "temperature": {
                        "value": 25,
                        "unit": "C"
                    },
                    "density": {
                        "value": 1020,
                        "unit": "kg/m3"
                    },
                    "target_ratio": 0.5
                }
            ]
        }
    
    @classmethod
    def write_sample_files(cls, output_dir: str, overwrite: bool = False) -> Dict[str, str]:
        """
        写入示例文件到指定目录
        
        Args:
            output_dir: 输出目录路径
            overwrite: 是否覆盖已存在的文件
        
        Returns:
            生成的文件路径字典
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        files_created: Dict[str, str] = {}
        
        # 1. 写入拓扑JSON
        topology_file = output_path / "topology.json"
        if not topology_file.exists() or overwrite:
            with open(topology_file, 'w', encoding='utf-8') as f:
                json.dump(cls.generate_topology(), f, indent=2, ensure_ascii=False)
            files_created["topology"] = str(topology_file)
        
        # 2. 写入泵程序CSV
        pump_file = output_path / "pump_program.csv"
        if not pump_file.exists() or overwrite:
            rows = cls.generate_pump_program_rows()
            if rows:
                with open(pump_file, 'w', encoding='utf-8', newline='') as f:
                    fieldnames = list(rows[0].keys())
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
            files_created["pump_program"] = str(pump_file)
        
        # 3. 写入黏度YAML
        viscosity_file = output_path / "viscosity.yaml"
        if not viscosity_file.exists() or overwrite:
            with open(viscosity_file, 'w', encoding='utf-8') as f:
                yaml.dump(cls.generate_viscosity_data(), f, default_flow_style=False, allow_unicode=True, sort_keys=False)
            files_created["viscosity"] = str(viscosity_file)
        
        return files_created


# 便捷函数
def generate_sample_files(output_dir: str, overwrite: bool = False) -> Dict[str, str]:
    return SampleDataGenerator.write_sample_files(output_dir, overwrite)


def get_sample_topology() -> Dict[str, Any]:
    return SampleDataGenerator.generate_topology()


def get_sample_pump_rows() -> List[Dict[str, str]]:
    return SampleDataGenerator.generate_pump_program_rows()


def get_sample_viscosity() -> Dict[str, Any]:
    return SampleDataGenerator.generate_viscosity_data()
