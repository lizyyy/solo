"""微震事件复核工具 - 最小测试脚本"""

import os
import sys
import numpy as np
from datetime import datetime, timedelta

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def test_data_loader():
    """测试数据加载模块"""
    print("=" * 60)
    print("测试: 数据加载模块")
    print("=" * 60)
    
    from data_loader import DataLoader, Station, Waveform, VelocityModel
    
    # 1. 测试 Station 类
    print("\n1. 测试 Station 类...")
    station = Station(
        station_id='STA001',
        x=0.0, y=0.0, z=0.0,
        sampling_rate=1000.0,
        channel='Z'
    )
    assert station.station_id == 'STA001'
    assert station.x == 0.0
    assert station.is_valid == True
    print("   ✓ Station 类创建成功")
    
    # 2. 测试 Waveform 类
    print("\n2. 测试 Waveform 类...")
    sampling_rate = 1000.0
    dt = 1.0 / sampling_rate
    n_samples = 2000
    
    # 生成测试数据
    np.random.seed(42)
    noise = np.random.normal(0, 0.1, n_samples)
    t = np.arange(n_samples) * dt
    
    # 生成Ricker小波
    f0 = 50.0
    t0 = 0.1
    a = (np.pi * f0 * (t - t0))**2
    ricker = (1 - 2 * a) * np.exp(-a)
    
    data = noise + ricker * 5.0
    
    waveform = Waveform(
        station_id='STA001',
        data=data,
        sampling_rate=sampling_rate,
        start_time=datetime(2024, 1, 1, 0, 0, 0),
        channel='Z'
    )
    
    assert waveform.station_id == 'STA001'
    assert len(waveform.data) == n_samples
    assert waveform.sampling_rate == sampling_rate
    assert waveform.dt == dt
    print("   ✓ Waveform 类创建成功")
    
    # 3. 测试 VelocityModel 类
    print("\n3. 测试 VelocityModel 类...")
    velocity_model = VelocityModel(
        p_velocity=5000.0,
        s_velocity=2890.0
    )
    assert velocity_model.p_velocity == 5000.0
    assert velocity_model.get_p_velocity() == 5000.0
    print("   ✓ VelocityModel 类创建成功")
    
    # 4. 测试跨午夜检测
    print("\n4. 测试跨午夜检测...")
    start_time = datetime(2024, 1, 1, 23, 59, 0)
    long_duration = 120.0  # 2分钟
    long_n_samples = int(long_duration * sampling_rate)
    long_data = np.random.normal(0, 0.1, long_n_samples)
    
    waveform_midnight = Waveform(
        station_id='STA_MIDNIGHT',
        data=long_data,
        sampling_rate=sampling_rate,
        start_time=start_time
    )
    
    assert waveform_midnight.check_cross_midnight() == True
    print("   ✓ 跨午夜检测功能正常")
    
    # 5. 测试从文件加载
    print("\n5. 测试从示例数据加载...")
    sample_dir = os.path.join(os.path.dirname(__file__), 'sample_data')
    stations_path = os.path.join(sample_dir, 'stations.csv')
    waveforms_dir = os.path.join(sample_dir, 'waveforms')
    velocity_path = os.path.join(sample_dir, 'velocity_model.yaml')
    
    if os.path.exists(stations_path) and os.path.exists(waveforms_dir):
        loader = DataLoader(
            stations_path=stations_path,
            waveforms_dir=waveforms_dir,
            velocity_model_path=velocity_path
        )
        loader.load_all()
        
        print(f"   - 加载台站数: {len(loader.stations)}")
        print(f"   - 加载波形数: {len(loader.waveforms)}")
        
        assert len(loader.stations) >= 5  # 至少有STA001-STA005
        assert len(loader.waveforms) >= 5
        
        print("   ✓ 从示例数据加载成功")
    else:
        print("   ⚠ 示例数据目录不存在，跳过文件加载测试")
    
    print("\n✓ 数据加载模块测试通过!")


def test_validator():
    """测试数据校验模块"""
    print("\n" + "=" * 60)
    print("测试: 数据校验模块")
    print("=" * 60)
    
    from validator import DataValidator, ValidationResult, quick_validate
    from data_loader import Station, Waveform
    
    # 1. 测试校验器创建
    print("\n1. 测试 DataValidator 创建...")
    validator = DataValidator(
        min_sampling_rate=100.0,
        max_sampling_rate=10000.0
    )
    print("   ✓ DataValidator 创建成功")
    
    # 2. 测试有效台站校验
    print("\n2. 测试有效台站校验...")
    valid_station = Station(
        station_id='VALID',
        x=0.0, y=0.0, z=0.0,
        sampling_rate=1000.0
    )
    is_valid, errors, warnings = validator.validate_station(valid_station)
    assert is_valid == True
    assert len(errors) == 0
    print("   ✓ 有效台站校验通过")
    
    # 3. 测试无效台站校验
    print("\n3. 测试无效台站校验...")
    invalid_station = Station(
        station_id='',  # 空ID
        x=float('nan'), y=0.0, z=0.0,  # NaN坐标
        sampling_rate=-100.0  # 负采样率
    )
    is_valid, errors, warnings = validator.validate_station(invalid_station)
    assert is_valid == False
    assert len(errors) > 0
    print(f"   ✓ 检测到 {len(errors)} 个错误")
    
    # 4. 测试波形校验
    print("\n4. 测试波形校验...")
    sampling_rate = 1000.0
    valid_data = np.random.normal(0, 0.1, 2000)
    
    valid_waveform = Waveform(
        station_id='WAVE001',
        data=valid_data,
        sampling_rate=sampling_rate
    )
    is_valid, errors, warnings = validator.validate_waveform(valid_waveform)
    assert is_valid == True
    print("   ✓ 有效波形校验通过")
    
    # 5. 测试综合校验
    print("\n5. 测试综合校验...")
    stations = {
        'STA001': Station('STA001', 0, 0, 0, 1000),
        'STA002': Station('STA002', 500, 0, 0, 1000),
    }
    waveforms = {
        'STA001': Waveform('STA001', valid_data, sampling_rate),
    }
    
    result = validator.validate_all(stations, waveforms)
    print(f"   - 有效台站: {result.n_valid_stations}")
    print(f"   - 有效波形: {result.n_valid_waveforms}")
    print(f"   - 缺波形台站: {result.n_missing_waveforms}")
    
    print("\n✓ 数据校验模块测试通过!")


def test_picker():
    """测试P波拾取模块"""
    print("\n" + "=" * 60)
    print("测试: P波拾取模块")
    print("=" * 60)
    
    from picker import PWavePicker, PickResult, auto_pick, STALTAPicker, ThresholdPicker
    from data_loader import Waveform
    
    # 1. 生成测试波形
    print("\n1. 生成测试波形数据...")
    sampling_rate = 1000.0
    dt = 1.0 / sampling_rate
    n_samples = 2000
    
    np.random.seed(42)
    noise = np.random.normal(0, 0.1, n_samples)
    t = np.arange(n_samples) * dt
    
    # 生成P波信号
    f0 = 50.0
    t0 = 0.5  # P波到达时间
    a = (np.pi * f0 * (t - t0))**2
    ricker = (1 - 2 * a) * np.exp(-a)
    
    data = noise + ricker * 10.0
    
    waveform = Waveform(
        station_id='TEST',
        data=data,
        sampling_rate=sampling_rate
    )
    print(f"   ✓ 生成波形，P波理论到达时间: {t0}s")
    
    # 2. 测试 STA/LTA 拾取器
    print("\n2. 测试 STA/LTA 拾取器...")
    sta_lta_picker = STALTAPicker(
        sta_window=0.05,
        lta_window=0.5,
        threshold=3.0
    )
    result = sta_lta_picker.pick(waveform)
    
    print(f"   - 拾取方法: {result.method}")
    print(f"   - 拾取时间: {result.pick_time:.4f}s")
    print(f"   - 拾取质量: {result.pick_quality:.2f}")
    print(f"   - 置信度: {result.confidence:.2f}")
    print(f"   - SNR: {result.snr:.1f}")
    
    # 检查拾取是否接近理论值 (允许±50ms误差)
    assert result.is_valid() == True
    assert abs(result.pick_time - t0) < 0.05  # 50ms容差
    print("   ✓ STA/LTA 拾取器正常工作")
    
    # 3. 测试阈值拾取器
    print("\n3. 测试阈值拾取器...")
    threshold_picker = ThresholdPicker(
        threshold_multiplier=3.0,
        noise_window=0.5
    )
    result_threshold = threshold_picker.pick(waveform)
    
    print(f"   - 拾取方法: {result_threshold.method}")
    print(f"   - 拾取时间: {result_threshold.pick_time:.4f}s")
    print(f"   - 拾取质量: {result_threshold.pick_quality:.2f}")
    
    assert result_threshold.is_valid() == True
    print("   ✓ 阈值拾取器正常工作")
    
    # 4. 测试综合拾取器
    print("\n4. 测试综合拾取器...")
    picker = PWavePicker(method='sta_lta')
    result_all = picker.pick(waveform)
    assert result_all.is_valid() == True
    print("   ✓ 综合拾取器正常工作")
    
    print("\n✓ P波拾取模块测试通过!")


def test_locator():
    """测试事件定位模块"""
    print("\n" + "=" * 60)
    print("测试: 事件定位模块")
    print("=" * 60)
    
    from locator import EventLocator, LocationResult, locate_event
    from data_loader import Station, Waveform, VelocityModel
    from picker import PickResult
    
    # 1. 准备测试数据
    print("\n1. 准备测试数据...")
    
    # 真实事件位置
    true_x, true_y, true_z = 250.0, 250.0, -500.0
    velocity = 5000.0  # m/s
    
    # 台站配置 (5个台站)
    stations = {
        'STA001': Station('STA001', 0.0, 0.0, 0.0, 1000),
        'STA002': Station('STA002', 500.0, 0.0, 0.0, 1000),
        'STA003': Station('STA003', 0.0, 500.0, 0.0, 1000),
        'STA004': Station('STA004', 500.0, 500.0, 0.0, 1000),
        'STA005': Station('STA005', 250.0, 250.0, -200.0, 1000),
    }
    
    print(f"   - 真实事件位置: ({true_x}, {true_y}, {true_z})")
    print(f"   - 台站数量: {len(stations)}")
    
    # 2. 计算理论到时
    print("\n2. 计算理论到时...")
    pick_results = {}
    
    for station_id, station in stations.items():
        # 计算距离
        dx = station.x - true_x
        dy = station.y - true_y
        dz = station.z - true_z
        distance = np.sqrt(dx**2 + dy**2 + dz**2)
        
        # 计算走时
        travel_time = distance / velocity
        
        # 添加一些噪声模拟实际拾取误差
        np.random.seed(hash(station_id) % 4294967295)
        noise = np.random.normal(0, 0.002)  # 2ms噪声
        
        # 创建拾取结果
        pick_result = PickResult(
            station_id=station_id,
            method='sta_lta',
            pick_idx=int((travel_time + noise) * 1000),
            pick_time=travel_time + noise,
            pick_quality=0.9,
            confidence=0.85
        )
        pick_results[station_id] = pick_result
        
        print(f"   - {station_id}: 距离={distance:.1f}m, 理论走时={travel_time:.4f}s")
    
    # 3. 执行定位
    print("\n3. 执行事件定位...")
    velocity_model = VelocityModel(p_velocity=velocity)
    locator = EventLocator(velocity_model=velocity_model)
    
    result = locator.locate(
        stations=stations,
        pick_results=pick_results,
        event_id='TEST_EVT'
    )
    
    print(f"   - 定位状态: {'成功' if result.is_valid else '失败'}")
    print(f"   - 定位坐标: ({result.x:.2f}, {result.y:.2f}, {result.z:.2f})")
    print(f"   - RMS残差: {result.rms*1000:.2f}ms")
    print(f"   - 使用台站数: {result.n_used_stations}")
    print(f"   - 质量等级: {result.quality_class}")
    
    # 4. 验证定位结果
    print("\n4. 验证定位精度...")
    
    # 计算定位误差
    error_x = abs(result.x - true_x)
    error_y = abs(result.y - true_y)
    error_z = abs(result.z - true_z)
    
    print(f"   - X误差: {error_x:.2f}m")
    print(f"   - Y误差: {error_y:.2f}m")
    print(f"   - Z误差: {error_z:.2f}m")
    
    # 断言定位成功且误差在合理范围内 (50m容差)
    assert result.is_valid == True
    assert error_x < 50.0
    assert error_y < 50.0
    print("   ✓ 定位精度符合预期")
    
    # 5. 测试各台站残差
    print("\n5. 检查各台站残差...")
    for station_id, residual in result.station_residuals.items():
        print(f"   - {station_id}: 残差={residual*1000:.2f}ms")
    
    print("\n✓ 事件定位模块测试通过!")


def test_boundary_cases():
    """测试边界情况"""
    print("\n" + "=" * 60)
    print("测试: 边界情况处理")
    print("=" * 60)
    
    from data_loader import Station, Waveform
    from validator import DataValidator
    
    # 1. 测试缺台站情况
    print("\n1. 测试缺台站情况...")
    
    # 只有波形没有台站配置
    sampling_rate = 1000.0
    data = np.random.normal(0, 0.1, 2000)
    
    waveforms = {
        'STA_WITH_CONFIG': Waveform('STA_WITH_CONFIG', data, sampling_rate),
        'STA_WITHOUT_CONFIG': Waveform('STA_WITHOUT_CONFIG', data, sampling_rate),
    }
    
    stations = {
        'STA_WITH_CONFIG': Station('STA_WITH_CONFIG', 0, 0, 0, sampling_rate),
        'STA_EXTRA': Station('STA_EXTRA', 100, 100, 0, sampling_rate),
    }
    
    validator = DataValidator()
    result = validator.validate_all(stations, waveforms)
    
    print(f"   - 缺台站配置的波形数: {result.n_missing_stations}")
    print(f"   - 缺波形的台站数: {result.n_missing_waveforms}")
    
    assert result.n_missing_stations == 1  # STA_WITHOUT_CONFIG
    assert result.n_missing_waveforms == 1  # STA_EXTRA
    print("   ✓ 缺台站检测功能正常")
    
    # 2. 测试跨午夜采样
    print("\n2. 测试跨午夜采样...")
    
    start_time = datetime(2024, 1, 1, 23, 59, 0)
    duration = 120.0  # 2分钟
    n_samples = int(duration * sampling_rate)
    data = np.random.normal(0, 0.1, n_samples)
    
    waveform_midnight = Waveform(
        station_id='MIDNIGHT_TEST',
        data=data,
        sampling_rate=sampling_rate,
        start_time=start_time
    )
    
    print(f"   - 起始时间: {waveform_midnight.start_time}")
    print(f"   - 结束时间: {waveform_midnight.end_time}")
    print(f"   - 是否跨午夜: {waveform_midnight.check_cross_midnight()}")
    
    assert waveform_midnight.check_cross_midnight() == True
    
    # 测试分割功能
    before, after = waveform_midnight.split_at_midnight()
    print(f"   - 分割后波形数: 2")
    print(f"   - 午夜前起始时间: {before.start_time}")
    if after:
        print(f"   - 午夜后起始时间: {after.start_time}")
    
    print("   ✓ 跨午夜处理功能正常")
    
    # 3. 测试不足台站定位
    print("\n3. 测试不足台站定位...")
    
    from locator import EventLocator
    from picker import PickResult
    
    # 只有2个台站 (需要至少3个)
    stations_min = {
        'STA1': Station('STA1', 0, 0, 0, 1000),
        'STA2': Station('STA2', 500, 0, 0, 1000),
    }
    
    picks_min = {
        'STA1': PickResult('STA1', 'sta_lta', pick_idx=100, pick_time=0.1, pick_quality=0.8),
        'STA2': PickResult('STA2', 'sta_lta', pick_idx=200, pick_time=0.2, pick_quality=0.8),
    }
    
    locator = EventLocator(min_stations=3)
    result = locator.locate(stations_min, picks_min)
    
    print(f"   - 台站数量: 2")
    print(f"   - 定位是否有效: {result.is_valid}")
    
    assert result.is_valid == False
    print("   ✓ 不足台站检测功能正常")
    
    print("\n✓ 边界情况处理测试通过!")


def main():
    """主测试函数"""
    print("\n" + "#" * 60)
    print("# 微震事件复核工具 - 最小测试")
    print("#" * 60)
    
    try:
        # 运行所有测试
        test_data_loader()
        test_validator()
        test_picker()
        test_locator()
        test_boundary_cases()
        
        print("\n" + "=" * 60)
        print("✓ 所有测试通过!")
        print("=" * 60)
        
        return 0
        
    except Exception as e:
        print(f"\n✗ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
