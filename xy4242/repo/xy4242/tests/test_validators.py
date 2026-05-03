"""校验器模块测试"""

import pytest
from flow_balancer.validators.topology_validator import (
    TopologyValidator, ValidationResult, ValidationIssue, ValidationSeverity
)
from flow_balancer.validators.pump_validator import PumpProgramValidator
from flow_balancer.parsers.topology_parser import TopologyParser
from flow_balancer.parsers.pump_parser import PumpProgramParser


class TestTopologyValidator:
    """拓扑校验器测试"""
    
    def create_valid_topology_data(self):
        """创建有效拓扑数据"""
        return {
            "name": "Test Chip",
            "version": "1.0",
            "description": "Test",
            "mixing_node": "mix",
            "inlet_reagents": {"in1": "reagent_a"},
            "nodes": [
                {"id": "in1", "name": "Inlet", "type": "inlet", "x": 0, "y": 0, "x_unit": "mm", "y_unit": "mm"},
                {"id": "mix", "name": "Mix", "type": "junction", "x": 10, "y": 0, "x_unit": "mm", "y_unit": "mm"},
                {"id": "out", "name": "Outlet", "type": "outlet", "x": 20, "y": 0, "x_unit": "mm", "y_unit": "mm"},
            ],
            "channels": [
                {
                    "id": "ch1", "name": "Ch1", "type": "rectangular",
                    "from": "in1", "to": "mix",
                    "width": 100, "width_unit": "μm",
                    "height": 50, "height_unit": "μm",
                    "length": 10, "length_unit": "mm"
                },
                {
                    "id": "ch2", "name": "Ch2", "type": "rectangular",
                    "from": "mix", "to": "out",
                    "width": 150, "width_unit": "μm",
                    "height": 50, "height_unit": "μm",
                    "length": 10, "length_unit": "mm"
                },
            ]
        }
    
    def test_valid_topology(self):
        """测试有效拓扑"""
        data = self.create_valid_topology_data()
        topology = TopologyParser.parse(data)
        
        result = TopologyValidator.validate(topology)
        
        assert result.is_valid == True
        assert len(result.errors) == 0
    
    def test_missing_nodes(self):
        """测试缺少节点"""
        data = self.create_valid_topology_data()
        data["nodes"] = []
        topology = TopologyParser.parse(data)
        
        result = TopologyValidator.validate(topology)
        
        assert result.is_valid == False
        assert any("没有定义任何节点" in e.message for e in result.errors)
    
    def test_missing_channels(self):
        """测试缺少通道"""
        data = self.create_valid_topology_data()
        data["channels"] = []
        topology = TopologyParser.parse(data)
        
        result = TopologyValidator.validate(topology)
        
        assert result.is_valid == False
        assert any("没有定义任何通道" in e.message for e in result.errors)
    
    def test_invalid_channel_reference(self):
        """测试无效的通道引用"""
        data = self.create_valid_topology_data()
        data["channels"][0]["from"] = "nonexistent"
        topology = TopologyParser.parse(data)
        
        result = TopologyValidator.validate(topology)
        
        assert result.is_valid == False
        assert any("起始节点不存在" in e.message for e in result.errors)
    
    def test_invalid_unit(self):
        """测试无效单位"""
        data = self.create_valid_topology_data()
        data["channels"][0]["width_unit"] = "invalid_unit"
        topology = TopologyParser.parse(data)
        
        result = TopologyValidator.validate(topology)
        
        assert result.is_valid == False
        assert any("无效的宽度单位" in e.message for e in result.errors)
    
    def test_extreme_aspect_ratio(self):
        """测试极端宽高比警告"""
        data = self.create_valid_topology_data()
        data["channels"][0]["width"] = 1000
        data["channels"][0]["height"] = 10
        topology = TopologyParser.parse(data)
        
        result = TopologyValidator.validate(topology)
        
        assert result.is_valid == True
        assert len(result.warnings) > 0
        assert any("宽高比" in w.message for w in result.warnings)
    
    def test_missing_mixing_node(self):
        """测试混合节点不存在"""
        data = self.create_valid_topology_data()
        data["mixing_node"] = "nonexistent"
        topology = TopologyParser.parse(data)
        
        result = TopologyValidator.validate(topology)
        
        assert result.is_valid == False
        assert any("混合点节点不存在" in e.message for e in result.errors)


class TestValidationResult:
    """校验结果测试"""
    
    def test_add_error(self):
        """测试添加错误"""
        result = ValidationResult()
        result.add_error("ERR001", "Test error")
        
        assert result.is_valid == False
        assert len(result.errors) == 1
        assert len(result.issues) == 1
    
    def test_add_warning(self):
        """测试添加警告"""
        result = ValidationResult()
        result.add_warning("WARN001", "Test warning")
        
        assert result.is_valid == True
        assert len(result.warnings) == 1
        assert len(result.errors) == 0
    
    def test_add_info(self):
        """测试添加信息"""
        result = ValidationResult()
        result.add_info("INFO001", "Test info")
        
        assert result.is_valid == True
        assert len(result.infos) == 1


class TestPumpValidator:
    """泵程序校验器测试"""
    
    def create_valid_pump_rows(self):
        """创建有效泵程序行"""
        return [
            {
                "Segment": "1",
                "Duration": "60",
                "Duration_Unit": "s",
                "in1_Flow": "10",
                "in1_Unit": "μL/min",
                "Description": "Test"
            }
        ]
    
    def test_valid_pump_program(self):
        """测试有效泵程序"""
        rows = self.create_valid_pump_rows()
        program = PumpProgramParser.parse_rows(rows)
        
        result = PumpProgramValidator.validate(program)
        
        assert result.is_valid == True
    
    def test_zero_duration(self):
        """测试零持续时间"""
        rows = [
            {
                "Segment": "1",
                "Duration": "0",
                "Duration_Unit": "s",
                "in1_Flow": "10",
                "in1_Unit": "μL/min",
            }
        ]
        program = PumpProgramParser.parse_rows(rows)
        
        result = PumpProgramValidator.validate(program)
        
        assert len(result.warnings) > 0
    
    def test_negative_flow(self):
        """测试负流量"""
        rows = [
            {
                "Segment": "1",
                "Duration": "60",
                "Duration_Unit": "s",
                "in1_Flow": "-10",
                "in1_Unit": "μL/min",
            }
        ]
        program = PumpProgramParser.parse_rows(rows)
        
        result = PumpProgramValidator.validate(program)
        
        assert len(result.warnings) > 0
    
    def test_with_topology_validation(self):
        """测试带拓扑的校验"""
        rows = [
            {
                "Segment": "1",
                "Duration": "60",
                "Duration_Unit": "s",
                "in1_Flow": "10",
                "in1_Unit": "μL/min",
            }
        ]
        program = PumpProgramParser.parse_rows(rows)
        
        topology_data = TopologyParser.parse({
            "name": "Test",
            "nodes": [
                {"id": "in1", "type": "inlet", "x": 0, "y": 0},
                {"id": "out", "type": "outlet", "x": 10, "y": 0},
            ],
            "channels": [
                {
                    "id": "ch1", "type": "rectangular",
                    "from": "in1", "to": "out",
                    "width": 100, "height": 50, "length": 10
                }
            ],
            "inlet_reagents": {"in1": "reagent_a"}
        })
        
        result = PumpProgramValidator.validate(program, topology_data)
        
        assert result.is_valid == True
