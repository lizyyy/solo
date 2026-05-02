"""
生成示例CAN日志文件
包含各类问题：心跳丢失、信号越界、计数器回跳、跨天、未知ID
"""

import struct
from datetime import datetime, timedelta


def generate_can_frame(timestamp: float, can_id: int, data: bytes, interface: str = "can0") -> str:
    """
    生成candump格式的日志行
    
    格式: (timestamp) interface id#data
    """
    data_hex = data.hex().upper()
    return f"({timestamp:.6f}) {interface} {can_id:03X}#{data_hex}"


def encode_motor_heartbeat(counter: int, status: int = 1, vcu_enable: int = 1) -> bytes:
    """
    编码电机控制器心跳帧 (0x123)
    
    信号:
    - heartbeat_counter: 0-7位 (8位)
    - motor_status: 8-11位 (4位)
    - vcu_enable: 12位 (1位)
    """
    # 构建8字节数据
    data = bytearray(8)
    
    # 字节0: counter
    data[0] = counter & 0xFF
    
    # 字节1: status (低4位) + vcu_enable (第5位)
    data[1] = (status & 0x0F) | ((vcu_enable & 0x01) << 4)
    
    return bytes(data)


def encode_motor_status(speed: int, torque: float, motor_temp: float, 
                        inverter_temp: float, counter: int) -> bytes:
    """
    编码电机控制器状态帧 (0x124)
    
    信号:
    - motor_speed: 0-15位 (16位有符号)
    - motor_torque: 16-31位 (16位有符号, scale 0.1)
    - motor_temp: 32-39位 (8位, offset -40)
    - inverter_temp: 40-47位 (8位, offset -40)
    - status_counter: 56-63位 (8位)
    """
    data = bytearray(8)
    
    # 速度 (有符号16位，小端)
    struct.pack_into('<h', data, 0, speed)
    
    # 扭矩 (有符号16位，小端，scale 0.1)
    torque_raw = int(torque / 0.1)
    struct.pack_into('<h', data, 2, torque_raw)
    
    # 电机温度 (offset -40)
    data[4] = int(motor_temp + 40) & 0xFF
    
    # 逆变器温度 (offset -40)
    data[5] = int(inverter_temp + 40) & 0xFF
    
    # 计数器
    data[7] = counter & 0xFF
    
    return bytes(data)


def encode_bms_heartbeat(counter: int, status: int = 0) -> bytes:
    """
    编码BMS心跳帧 (0x150)
    
    信号:
    - bms_counter: 0-7位
    - bms_status: 8-11位
    """
    data = bytearray(8)
    data[0] = counter & 0xFF
    data[1] = status & 0x0F
    return bytes(data)


def encode_bms_voltage_current(voltage: float, current: float, soc: float, 
                                soh: float, counter: int) -> bytes:
    """
    编码BMS电压电流帧 (0x151)
    
    信号:
    - pack_voltage: 0-15位 (无符号16位, scale 0.01)
    - pack_current: 16-31位 (有符号16位, scale 0.1)
    - soc: 32-39位 (无符号8位, scale 0.5)
    - soh: 40-47位 (无符号8位, scale 0.5)
    - data_counter: 56-63位
    """
    data = bytearray(8)
    
    # 电压 (无符号16位，小端，scale 0.01)
    voltage_raw = int(voltage / 0.01)
    struct.pack_into('<H', data, 0, voltage_raw)
    
    # 电流 (有符号16位，小端，scale 0.1)
    current_raw = int(current / 0.1)
    struct.pack_into('<h', data, 2, current_raw)
    
    # SOC (scale 0.5)
    data[4] = int(soc / 0.5) & 0xFF
    
    # SOH (scale 0.5)
    data[5] = int(soh / 0.5) & 0xFF
    
    # 计数器
    data[7] = counter & 0xFF
    
    return bytes(data)


def encode_bms_temperature(max_temp: float, min_temp: float, avg_temp: float) -> bytes:
    """
    编码BMS温度帧 (0x152)
    
    信号:
    - max_temp: 0-7位 (offset -40)
    - min_temp: 8-15位 (offset -40)
    - avg_temp: 16-23位 (offset -40)
    """
    data = bytearray(8)
    data[0] = int(max_temp + 40) & 0xFF
    data[1] = int(min_temp + 40) & 0xFF
    data[2] = int(avg_temp + 40) & 0xFF
    return bytes(data)


def encode_vcu_control(torque: float, accelerator: float, brake: float,
                       gear: int, drive_mode: int, counter: int) -> bytes:
    """
    编码VCU控制帧 (0x180)
    
    信号:
    - target_torque: 0-15位 (有符号16位, scale 0.1)
    - accelerator_pos: 16-23位 (无符号8位, scale 0.4)
    - brake_pos: 24-31位 (无符号8位, scale 0.4)
    - gear_position: 32-34位 (3位)
    - drive_mode: 35-36位 (2位)
    - vcu_counter: 56-63位
    """
    data = bytearray(8)
    
    # 扭矩 (有符号16位，小端，scale 0.1)
    torque_raw = int(torque / 0.1)
    struct.pack_into('<h', data, 0, torque_raw)
    
    # 油门位置 (scale 0.4)
    data[2] = int(accelerator / 0.4) & 0xFF
    
    # 刹车位置 (scale 0.4)
    data[3] = int(brake / 0.4) & 0xFF
    
    # 档位和驾驶模式
    byte4 = (gear & 0x07) | ((drive_mode & 0x03) << 3)
    data[4] = byte4
    
    # 计数器
    data[7] = counter & 0xFF
    
    return bytes(data)


def main():
    """生成示例日志"""
    log_lines = []
    
    # 基础时间戳 (2024-01-15 10:00:00)
    base_time = datetime(2024, 1, 15, 10, 0, 0)
    start_timestamp = base_time.timestamp()
    
    # 计数器初始化
    mcu_hb_counter = 0
    mcu_status_counter = 0
    bms_hb_counter = 0
    bms_data_counter = 0
    vcu_counter = 0
    
    # 模拟参数
    speed = 0
    torque = 0.0
    motor_temp = 25.0
    inverter_temp = 30.0
    battery_voltage = 350.0
    battery_current = 0.0
    soc = 85.0
    soh = 96.0
    max_temp = 28.0
    min_temp = 22.0
    avg_temp = 25.0
    target_torque = 0.0
    accelerator = 0.0
    brake = 20.0
    gear = 0  # P
    drive_mode = 1  # NORMAL
    
    # 模拟时间段: 约15秒
    # 正常运行 5秒 -> 出现问题 -> 继续运行
    # 包含: 心跳丢失、信号越界、计数器回跳、跨天、未知ID
    
    frame_count = 0
    
    # 阶段1: 正常启动 (0-5秒)
    for step in range(500):
        current_time = start_timestamp + step * 0.01  # 10ms步进
        frame_count += 1
        
        # VCU控制帧 (每20ms = 每2步)
        if step % 2 == 0:
            if step < 100:  # 前2秒: P档
                gear = 0
                brake = 30.0
                accelerator = 0.0
            elif step < 200:  # 2-4秒: 切换到D档
                gear = 3
                brake = 10.0
                accelerator = 10.0
            else:  # 4秒后: 加速
                gear = 3
                brake = 0.0
                accelerator = 30.0
                speed = min(speed + 5, 1500)
                torque = 50.0
                target_torque = 60.0
            
            log_lines.append(generate_can_frame(
                current_time, 0x180,
                encode_vcu_control(target_torque, accelerator, brake, gear, drive_mode, vcu_counter)
            ))
            vcu_counter = (vcu_counter + 1) % 256
        
        # MCU状态帧 (每100ms = 每10步)
        if step % 10 == 0:
            if speed > 0:
                motor_temp = min(motor_temp + 0.5, 85.0)
                inverter_temp = min(inverter_temp + 0.3, 75.0)
                battery_current = -80.0  # 放电
                battery_voltage = max(battery_voltage - 0.02, 300.0)
                soc = max(soc - 0.01, 0)
                max_temp = min(max_temp + 0.2, 60.0)
                min_temp = 22.0
                avg_temp = (max_temp + min_temp) / 2
            
            log_lines.append(generate_can_frame(
                current_time, 0x124,
                encode_motor_status(speed, torque, motor_temp, inverter_temp, mcu_status_counter)
            ))
            mcu_status_counter = (mcu_status_counter + 1) % 256
        
        # MCU心跳帧 (每1000ms = 每100步)
        if step % 100 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x123,
                encode_motor_heartbeat(mcu_hb_counter, status=1 if speed > 0 else 0)
            ))
            mcu_hb_counter = (mcu_hb_counter + 1) % 256
        
        # BMS数据帧 (每100ms = 每10步)
        if step % 10 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x151,
                encode_bms_voltage_current(battery_voltage, battery_current, soc, soh, bms_data_counter)
            ))
            bms_data_counter = (bms_data_counter + 1) % 256
        
        # BMS心跳帧 (每1000ms = 每100步)
        if step % 100 == 0:
            bms_status = 2 if battery_current < 0 else 0  # DISCHARGING if current is negative
            log_lines.append(generate_can_frame(
                current_time, 0x150,
                encode_bms_heartbeat(bms_hb_counter, status=bms_status)
            ))
            bms_hb_counter = (bms_hb_counter + 1) % 256
        
        # BMS温度帧 (每500ms = 每50步)
        if step % 50 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x152,
                encode_bms_temperature(max_temp, min_temp, avg_temp)
            ))
    
    # 阶段2: 引入问题 (5-10秒)
    # 问题1: 心跳丢失 (跳过几个MCU心跳帧)
    # 问题2: 信号越界 (电机温度超过max 215, 但实际范围85)
    # 问题3: 计数器回跳
    # 问题4: 未知CAN ID
    
    for step in range(500, 1000):
        current_time = start_timestamp + step * 0.01
        frame_count += 1
        
        # VCU控制帧
        if step % 2 == 0:
            accelerator = 50.0
            speed = min(speed + 3, 3000)
            torque = 120.0
            target_torque = 150.0
            
            log_lines.append(generate_can_frame(
                current_time, 0x180,
                encode_vcu_control(target_torque, accelerator, brake, gear, drive_mode, vcu_counter)
            ))
            vcu_counter = (vcu_counter + 1) % 256
        
        # MCU状态帧 - 故意让温度越界 (在第6秒时)
        if step % 10 == 0:
            if step == 600:  # 第6秒
                # 故意设置越界温度
                motor_temp = 100.0  # 超过BMS温度范围85度
                inverter_temp = 250.0  # 超过范围
            else:
                motor_temp = min(motor_temp + 0.3, 90.0)
                inverter_temp = min(inverter_temp + 0.2, 95.0)
            
            battery_current = -150.0
            battery_voltage = max(battery_voltage - 0.05, 300.0)
            soc = max(soc - 0.02, 0)
            max_temp = motor_temp
            avg_temp = (max_temp + min_temp) / 2
            
            log_lines.append(generate_can_frame(
                current_time, 0x124,
                encode_motor_status(speed, torque, motor_temp, inverter_temp, mcu_status_counter)
            ))
            mcu_status_counter = (mcu_status_counter + 1) % 256
        
        # MCU心跳帧 - 故意跳过一些 (心跳丢失)
        # 在第7秒和第8秒跳过心跳
        if step % 100 == 0:
            if step not in [700, 800]:  # 跳过7秒和8秒的心跳
                log_lines.append(generate_can_frame(
                    current_time, 0x123,
                    encode_motor_heartbeat(mcu_hb_counter, status=1)
                ))
                mcu_hb_counter = (mcu_hb_counter + 1) % 256
        
        # BMS数据帧 - 故意让计数器回跳
        if step % 10 == 0:
            if step == 850:  # 第8.5秒时故意回跳
                bms_data_counter = 10  # 从高值回跳到低值
            else:
                bms_data_counter = (bms_data_counter + 1) % 256
            
            log_lines.append(generate_can_frame(
                current_time, 0x151,
                encode_bms_voltage_current(battery_voltage, battery_current, soc, soh, bms_data_counter)
            ))
        
        # BMS心跳帧
        if step % 100 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x150,
                encode_bms_heartbeat(bms_hb_counter, status=2)
            ))
            bms_hb_counter = (bms_hb_counter + 1) % 256
        
        # BMS温度帧
        if step % 50 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x152,
                encode_bms_temperature(max_temp, min_temp, avg_temp)
            ))
        
        # 注入未知CAN ID (0x200)
        if step % 200 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x200,
                bytes([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
            ))
    
    # 阶段3: 跨天模拟 (时间戳回退)
    # 模拟跨越午夜，时间戳从 86399 变为 1
    # 对应日期从 1月15日 23:59:59 到 1月16日 00:00:01
    
    # 先设置一些接近午夜的时间戳
    midnight_near = datetime(2024, 1, 15, 23, 59, 55)
    midnight_ts = midnight_near.timestamp()
    
    # 添加一些接近午夜的帧
    for step in range(1000, 1050):
        current_time = midnight_ts + (step - 1000) * 0.1
        frame_count += 1
        
        if step % 2 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x180,
                encode_vcu_control(0, 0, 0, 3, 1, vcu_counter)
            ))
            vcu_counter = (vcu_counter + 1) % 256
        
        if step % 10 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x124,
                encode_motor_status(2500, 80, 75, 80, mcu_status_counter)
            ))
            mcu_status_counter = (mcu_status_counter + 1) % 256
        
        if step % 100 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x123,
                encode_motor_heartbeat(mcu_hb_counter, status=1)
            ))
            mcu_hb_counter = (mcu_hb_counter + 1) % 256
        
        if step % 10 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x151,
                encode_bms_voltage_current(320.5, -100, 75.5, 96.0, bms_data_counter)
            ))
            bms_data_counter = (bms_data_counter + 1) % 256
        
        if step % 100 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x150,
                encode_bms_heartbeat(bms_hb_counter, status=2)
            ))
            bms_hb_counter = (bms_hb_counter + 1) % 256
        
        if step % 50 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x152,
                encode_bms_temperature(55, 48, 52)
            ))
    
    # 跨天: 时间戳突然变小 (从 86399.9 变为 1.0)
    # 新的一天开始
    new_day_start = datetime(2024, 1, 16, 0, 0, 1)
    new_day_ts = new_day_start.timestamp()
    
    # 添加新一天的帧
    for step in range(1050, 1100):
        # 这里时间戳"回退"，模拟跨天
        # 实际是从 1月15日23:59:59 到 1月16日00:00:01
        current_time = new_day_ts + (step - 1050) * 0.1
        frame_count += 1
        
        if step % 2 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x180,
                encode_vcu_control(0, 0, 30, 0, 1, vcu_counter)  # P档，停车
            ))
            vcu_counter = (vcu_counter + 1) % 256
        
        if step % 10 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x124,
                encode_motor_status(0, 0, 45, 50, mcu_status_counter)  # 停止，温度下降
            ))
            mcu_status_counter = (mcu_status_counter + 1) % 256
        
        if step % 100 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x123,
                encode_motor_heartbeat(mcu_hb_counter, status=0)
            ))
            mcu_hb_counter = (mcu_hb_counter + 1) % 256
        
        if step % 10 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x151,
                encode_bms_voltage_current(315.0, 0, 72.5, 96.0, bms_data_counter)  # 静置
            ))
            bms_data_counter = (bms_data_counter + 1) % 256
        
        if step % 100 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x150,
                encode_bms_heartbeat(bms_hb_counter, status=0)  # NORMAL
            ))
            bms_hb_counter = (bms_hb_counter + 1) % 256
        
        if step % 50 == 0:
            log_lines.append(generate_can_frame(
                current_time, 0x152,
                encode_bms_temperature(45, 38, 42)
            ))
    
    # 写入文件
    output_path = "/Users/lzy/pro/solocoder/pro/zy8108/repo/zy8108/sample_data/candump.log"
    with open(output_path, 'w', encoding='utf-8') as f:
        for line in log_lines:
            f.write(line + '\n')
    
    print(f"生成日志文件: {output_path}")
    print(f"总帧数: {len(log_lines)}")
    print()
    print("日志包含的问题场景:")
    print("  1. 心跳丢失 (第7秒和第8秒跳过MCU心跳)")
    print("  2. 信号越界 (电机温度超过BMS温度范围)")
    print("  3. 计数器回跳 (第8.5秒BMS数据计数器回跳)")
    print("  4. 未知CAN ID (0x200)")
    print("  5. 跨天时间戳 (从1月15日跨越到1月16日)")


if __name__ == '__main__':
    main()
