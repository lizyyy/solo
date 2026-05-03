"""流体计算模块测试"""

import pytest
import math
from flow_balancer.core.fluidics import (
    Channel, ChannelType, Node, FluidNetwork, 
    FluidicsSimulator, MixingRatio
)
from flow_balancer.core.units import convert


class TestChannel:
    """通道测试"""
    
    def test_rectangular_channel_geometry(self):
        """测试矩形通道几何计算"""
        ch = Channel(
            id="ch1",
            name="Test Channel",
            channel_type=ChannelType.RECTANGULAR,
            width=100e-6,
            height=50e-6,
            length=20e-3,
            from_node="in1",
            to_node="out1"
        )
        
        assert ch.width == 100e-6
        assert ch.height == 50e-6
        assert ch.length == 20e-3
        
        hydraulic_diameter = 2 * (100e-6 * 50e-6) / (100e-6 + 50e-6)
        assert ch.hydraulic_diameter == pytest.approx(hydraulic_diameter)
        
        area = 100e-6 * 50e-6
        assert ch.cross_sectional_area == pytest.approx(area)
        
        volume = area * 20e-3
        assert ch.volume == pytest.approx(volume)
    
    def test_circular_channel_geometry(self):
        """测试圆形通道几何计算"""
        diameter = 100e-6
        ch = Channel(
            id="ch1",
            name="Test Circular",
            channel_type=ChannelType.CIRCULAR,
            width=diameter,
            height=diameter,
            length=10e-3,
            from_node="in1",
            to_node="out1"
        )
        
        assert ch.hydraulic_diameter == pytest.approx(diameter)
        
        area = math.pi * (diameter / 2) ** 2
        assert ch.cross_sectional_area == pytest.approx(area)
    
    def test_resistance_calculation(self):
        """测试阻力计算"""
        viscosity = 0.001
        
        ch = Channel(
            id="ch1",
            name="Test",
            channel_type=ChannelType.RECTANGULAR,
            width=100e-6,
            height=50e-6,
            length=20e-3,
            from_node="in1",
            to_node="out1"
        )
        
        resistance = ch.calculate_resistance(viscosity)
        assert resistance > 0
    
    def test_pressure_drop_calculation(self):
        """测试压降计算"""
        viscosity = 0.001
        flow_rate = 1e-10
        
        ch = Channel(
            id="ch1",
            name="Test",
            channel_type=ChannelType.RECTANGULAR,
            width=100e-6,
            height=50e-6,
            length=20e-3,
            from_node="in1",
            to_node="out1"
        )
        
        pressure_drop = ch.calculate_pressure_drop(flow_rate, viscosity)
        assert pressure_drop >= 0


class TestFluidNetwork:
    """流体网络测试"""
    
    def test_add_node_and_channel(self):
        """测试添加节点和通道"""
        network = FluidNetwork()
        
        node1 = Node(id="in1", name="Inlet 1", type="inlet")
        node2 = Node(id="out1", name="Outlet 1", type="outlet")
        network.add_node(node1)
        network.add_node(node2)
        
        ch = Channel(
            id="ch1",
            name="Main Channel",
            channel_type=ChannelType.RECTANGULAR,
            width=100e-6,
            height=50e-6,
            length=20e-3,
            from_node="in1",
            to_node="out1"
        )
        network.add_channel(ch)
        
        assert len(network.nodes) == 2
        assert len(network.channels) == 1
        assert "in1" in network.nodes
        assert "ch1" in network.channels
    
    def test_get_incoming_outgoing_channels(self):
        """测试获取进出通道"""
        network = FluidNetwork()
        
        network.add_node(Node(id="in1", type="inlet"))
        network.add_node(Node(id="j1", type="junction"))
        network.add_node(Node(id="out1", type="outlet"))
        
        network.add_channel(Channel(
            id="ch1", channel_type=ChannelType.RECTANGULAR,
            width=100e-6, height=50e-6, length=10e-3,
            from_node="in1", to_node="j1"
        ))
        network.add_channel(Channel(
            id="ch2", channel_type=ChannelType.RECTANGULAR,
            width=100e-6, height=50e-6, length=10e-3,
            from_node="j1", to_node="out1"
        ))
        
        incoming = network.get_incoming_channels("j1")
        outgoing = network.get_outgoing_channels("j1")
        
        assert len(incoming) == 1
        assert len(outgoing) == 1
        assert incoming[0].id == "ch1"
        assert outgoing[0].id == "ch2"
    
    def test_get_inlet_outlet_nodes(self):
        """测试获取出入口节点"""
        network = FluidNetwork()
        
        network.add_node(Node(id="in1", type="inlet"))
        network.add_node(Node(id="in2", type="inlet"))
        network.add_node(Node(id="j1", type="junction"))
        network.add_node(Node(id="out1", type="outlet"))
        
        inlets = network.get_inlet_nodes()
        outlets = network.get_outlet_nodes()
        
        assert len(inlets) == 2
        assert len(outlets) == 1


class TestFluidicsSimulator:
    """流体仿真器测试"""
    
    def create_simple_network(self):
        """创建简单测试网络"""
        network = FluidNetwork()
        
        network.add_node(Node(id="in1", type="inlet"))
        network.add_node(Node(id="in2", type="inlet"))
        network.add_node(Node(id="mix", type="junction"))
        network.add_node(Node(id="out", type="outlet"))
        
        network.add_channel(Channel(
            id="ch1", channel_type=ChannelType.RECTANGULAR,
            width=100e-6, height=50e-6, length=10e-3,
            from_node="in1", to_node="mix"
        ))
        network.add_channel(Channel(
            id="ch2", channel_type=ChannelType.RECTANGULAR,
            width=100e-6, height=50e-6, length=10e-3,
            from_node="in2", to_node="mix"
        ))
        network.add_channel(Channel(
            id="ch3", channel_type=ChannelType.RECTANGULAR,
            width=150e-6, height=50e-6, length=20e-3,
            from_node="mix", to_node="out"
        ))
        
        return network
    
    def test_flow_distribution(self):
        """测试流量分配计算"""
        network = self.create_simple_network()
        simulator = FluidicsSimulator(network)
        
        inlet_flows = {
            "in1": 1e-10,
            "in2": 1e-10,
        }
        viscosity = 0.001
        
        channel_flows, node_pressures = simulator.calculate_flow_distribution(
            inlet_flows, viscosity
        )
        
        assert "ch1" in channel_flows
        assert "ch2" in channel_flows
        assert "ch3" in channel_flows
        
        assert channel_flows["ch1"] == pytest.approx(1e-10)
        assert channel_flows["ch2"] == pytest.approx(1e-10)
        assert channel_flows["ch3"] == pytest.approx(2e-10)
    
    def test_calculate_mixing_ratios(self):
        """测试混合比例计算"""
        network = self.create_simple_network()
        simulator = FluidicsSimulator(network)
        
        inlet_flows = {
            "in1": 1.5e-10,
            "in2": 0.5e-10,
        }
        target_ratios = {
            "in1": 0.75,
            "in2": 0.25,
        }
        reagent_names = {
            "in1": "Reagent A",
            "in2": "Reagent B",
        }
        
        ratios = simulator.calculate_mixing_ratios(
            inlet_flows, target_ratios, reagent_names
        )
        
        assert len(ratios) == 2
        
        for ratio in ratios:
            if ratio.reagent_id == "in1":
                assert ratio.actual_ratio == pytest.approx(0.75)
                assert ratio.target_ratio == 0.75
                assert ratio.deviation == pytest.approx(0.0)
            elif ratio.reagent_id == "in2":
                assert ratio.actual_ratio == pytest.approx(0.25)
                assert ratio.target_ratio == 0.25
    
    def test_calculate_delay_volume(self):
        """测试延迟体积计算"""
        network = self.create_simple_network()
        simulator = FluidicsSimulator(network)
        
        delay_volume = simulator.calculate_delay_volume("in1", "mix")
        
        ch1 = network.channels["ch1"]
        expected = ch1.volume
        assert delay_volume == pytest.approx(expected)
    
    def test_full_simulation(self):
        """测试完整仿真"""
        network = self.create_simple_network()
        simulator = FluidicsSimulator(network)
        
        program_segments = [
            {
                "duration": 60.0,
                "inlet_flows": {
                    "in1": 1e-10,
                    "in2": 1e-10,
                }
            }
        ]
        
        viscosity = 0.001
        target_ratios = {"in1": 0.5, "in2": 0.5}
        reagent_names = {"in1": "A", "in2": "B"}
        
        result = simulator.simulate(
            program_segments=program_segments,
            viscosity=viscosity,
            target_ratios=target_ratios,
            reagent_names=reagent_names,
            mixing_node_id="mix"
        )
        
        assert result.total_time == 60.0
        assert len(result.time_segments) == 1
        assert result.max_pressure_drop >= 0
        assert result.total_dead_volume > 0


class TestMixingRatio:
    """混合比例测试"""
    
    def test_deviation_calculation(self):
        """测试偏差计算"""
        ratio = MixingRatio(
            reagent_id="test",
            reagent_name="Test",
            target_ratio=0.5,
            actual_ratio=0.6
        )
        
        assert ratio.deviation == pytest.approx(0.1)
        assert ratio.relative_deviation == pytest.approx(20.0)
    
    def test_zero_target_ratio(self):
        """测试目标比例为0的情况"""
        ratio = MixingRatio(
            reagent_id="test",
            reagent_name="Test",
            target_ratio=0.0,
            actual_ratio=0.1
        )
        
        assert ratio.deviation == pytest.approx(0.1)
        assert ratio.relative_deviation == 0.0
