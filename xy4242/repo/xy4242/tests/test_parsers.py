"""解析器模块测试"""

import pytest
import tempfile
import os
import json
import csv
import yaml

from flow_balancer.parsers.topology_parser import (
    TopologyParser, TopologyData, topology_to_fluid_network
)
from flow_balancer.parsers.pump_parser import (
    PumpProgramParser, PumpProgram, pump_program_to_segments
)
from flow_balancer.parsers.viscosity_parser import (
    ViscosityParser, ViscosityData, get_average_viscosity
)


class TestTopologyParser:
    """拓扑解析器测试"""
    
    def create_sample_topology_data(self):
        """创建示例拓扑数据"""
        return {
            "name": "Test Chip",
            "version": "1.0",
            "description": "Test topology",
            "mixing_node": "mix",
            "inlet_reagents": {
                "in1": "reagent_a",
                "in2": "reagent_b"
            },
            "nodes": [
                {"id": "in1", "name": "Inlet 1", "type": "inlet", "x": 0, "y": 0, "x_unit": "mm", "y_unit": "mm"},
                {"id": "in2", "name": "Inlet 2", "type": "inlet", "x": 0, "y": 10, "x_unit": "mm", "y_unit": "mm"},
                {"id": "mix", "name": "Mix", "type": "junction", "x": 20, "y": 5, "x_unit": "mm", "y_unit": "mm"},
                {"id": "out", "name": "Outlet", "type": "outlet", "x": 40, "y": 5, "x_unit": "mm", "y_unit": "mm"},
            ],
            "channels": [
                {
                    "id": "ch1", "name": "Channel 1", "type": "rectangular",
                    "from": "in1", "to": "mix",
                    "width": 100, "width_unit": "μm",
                    "height": 50, "height_unit": "μm",
                    "length": 20, "length_unit": "mm"
                },
                {
                    "id": "ch2", "name": "Channel 2", "type": "rectangular",
                    "from": "in2", "to": "mix",
                    "width": 100, "width_unit": "μm",
                    "height": 50, "height_unit": "μm",
                    "length": 20, "length_unit": "mm"
                },
                {
                    "id": "ch3", "name": "Channel 3", "type": "rectangular",
                    "from": "mix", "to": "out",
                    "width": 150, "width_unit": "μm",
                    "height": 50, "height_unit": "μm",
                    "length": 20, "length_unit": "mm"
                },
            ]
        }
    
    def test_parse_topology_dict(self):
        """测试从字典解析拓扑"""
        data = self.create_sample_topology_data()
        topology = TopologyParser.parse(data)
        
        assert topology.name == "Test Chip"
        assert topology.version == "1.0"
        assert len(topology.nodes) == 4
        assert len(topology.channels) == 3
        assert topology.mixing_node == "mix"
        assert topology.inlet_reagents == {"in1": "reagent_a", "in2": "reagent_b"}
    
    def test_parse_topology_file(self):
        """测试从文件解析拓扑"""
        data = self.create_sample_topology_data()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(data, f)
            temp_path = f.name
        
        try:
            topology = TopologyParser.parse_file(temp_path)
            assert topology.name == "Test Chip"
            assert len(topology.nodes) == 4
        finally:
            os.unlink(temp_path)
    
    def test_topology_to_fluid_network(self):
        """测试转换为流体网络"""
        data = self.create_sample_topology_data()
        topology = TopologyParser.parse(data)
        
        network = topology_to_fluid_network(topology)
        
        assert len(network.nodes) == 4
        assert len(network.channels) == 3
        assert "in1" in network.nodes
        assert "ch1" in network.channels


class TestPumpParser:
    """泵程序解析器测试"""
    
    def create_sample_pump_rows(self):
        """创建示例泵程序行"""
        return [
            {
                "Segment": "1",
                "Duration": "60",
                "Duration_Unit": "s",
                "in1_Flow": "10",
                "in1_Unit": "μL/min",
                "in2_Flow": "10",
                "in2_Unit": "μL/min",
                "Description": "Test"
            }
        ]
    
    def test_parse_pump_rows(self):
        """测试解析泵程序行"""
        rows = self.create_sample_pump_rows()
        program = PumpProgramParser.parse_rows(rows)
        
        assert len(program.segments) == 1
        assert program.segments[0].duration == 60.0
        assert len(program.segments[0].pump_flows) == 2
        assert "in1" in program.segments[0].pump_flows
        assert "in2" in program.segments[0].pump_flows
    
    def test_parse_pump_file(self):
        """测试从文件解析泵程序"""
        rows = self.create_sample_pump_rows()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
            temp_path = f.name
        
        try:
            program = PumpProgramParser.parse_file(temp_path)
            assert len(program.segments) == 1
        finally:
            os.unlink(temp_path)
    
    def test_pump_program_to_segments(self):
        """测试转换为仿真格式"""
        rows = self.create_sample_pump_rows()
        program = PumpProgramParser.parse_rows(rows)
        
        # 创建模拟拓扑数据
        class MockTopology:
            inlet_reagents = {"in1": "reagent_a", "in2": "reagent_b"}
        
        segments = pump_program_to_segments(program, MockTopology())
        
        assert len(segments) == 1
        assert segments[0]["duration"] == 60.0
        assert "in1" in segments[0]["inlet_flows"]
        assert "in2" in segments[0]["inlet_flows"]


class TestViscosityParser:
    """黏度解析器测试"""
    
    def create_sample_viscosity_data(self):
        """创建示例黏度数据"""
        return {
            "name": "Test Viscosity",
            "description": "Test",
            "experiment_temperature": {"value": 25, "unit": "C"},
            "target_ratios": {
                "reagent_a": 0.5,
                "reagent_b": 0.5
            },
            "reagents": [
                {
                    "id": "reagent_a",
                    "name": "Reagent A",
                    "description": "Test A",
                    "viscosity": {"value": 1.0, "unit": "mPa·s"},
                    "temperature": {"value": 25, "unit": "C"},
                    "density": {"value": 1000, "unit": "kg/m3"},
                    "target_ratio": 0.5
                },
                {
                    "id": "reagent_b",
                    "name": "Reagent B",
                    "description": "Test B",
                    "viscosity": {"value": 1.3, "unit": "mPa·s"},
                    "temperature": {"value": 25, "unit": "C"},
                    "density": {"value": 1020, "unit": "kg/m3"},
                    "target_ratio": 0.5
                }
            ]
        }
    
    def test_parse_viscosity_dict(self):
        """测试从字典解析黏度"""
        data = self.create_sample_viscosity_data()
        viscosity = ViscosityParser.parse(data)
        
        assert viscosity.name == "Test Viscosity"
        assert len(viscosity.reagents) == 2
        assert "reagent_a" in viscosity.reagents
        assert "reagent_b" in viscosity.reagents
        assert viscosity.default_ratios == {"reagent_a": 0.5, "reagent_b": 0.5}
    
    def test_parse_viscosity_file(self):
        """测试从文件解析黏度"""
        data = self.create_sample_viscosity_data()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(data, f)
            temp_path = f.name
        
        try:
            viscosity = ViscosityParser.parse_file(temp_path)
            assert viscosity.name == "Test Viscosity"
            assert len(viscosity.reagents) == 2
        finally:
            os.unlink(temp_path)
    
    def test_get_average_viscosity(self):
        """测试平均黏度计算"""
        data = self.create_sample_viscosity_data()
        viscosity = ViscosityParser.parse(data)
        
        avg_viscosity = get_average_viscosity(viscosity)
        
        assert avg_viscosity > 0
