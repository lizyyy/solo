package com.devicecommand.config;

import com.devicecommand.entity.Device;
import com.devicecommand.entity.DispatchChannel;
import com.devicecommand.repository.DeviceRepository;
import com.devicecommand.repository.DispatchChannelRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private DeviceRepository deviceRepository;

    @Autowired
    private DispatchChannelRepository channelRepository;

    @Override
    public void run(String... args) {
        if (!deviceRepository.existsById(1L)) {
            Device device = Device.builder()
                    .id(1L)
                    .deviceCode("DEV001")
                    .deviceName("测试设备001")
                    .deviceType("GATEWAY")
                    .manufacturer("TestManufacturer")
                    .firmwareVersion("v1.0.0")
                    .status("ONLINE")
                    .build();
            deviceRepository.save(device);
        }

        if (!channelRepository.existsById(1L)) {
            DispatchChannel channel = DispatchChannel.builder()
                    .id(1L)
                    .channelCode("MQTT001")
                    .channelName("MQTT通道001")
                    .channelType("MQTT")
                    .endpoint("tcp://localhost:1883")
                    .timeoutSeconds(30)
                    .status("ACTIVE")
                    .build();
            channelRepository.save(channel);
        }
    }
}
