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
            Device device = new Device();
            device.setId(1L);
            device.setDeviceCode("DEV001");
            device.setDeviceName("测试设备001");
            device.setDeviceType("GATEWAY");
            device.setManufacturer("TestManufacturer");
            device.setFirmwareVersion("v1.0.0");
            device.setStatus("ONLINE");
            deviceRepository.save(device);
        }

        if (!channelRepository.existsById(1L)) {
            DispatchChannel channel = new DispatchChannel();
            channel.setId(1L);
            channel.setChannelCode("MQTT001");
            channel.setChannelName("MQTT通道001");
            channel.setChannelType("MQTT");
            channel.setEndpoint("tcp://localhost:1883");
            channel.setTimeoutSeconds(30);
            channel.setStatus("ACTIVE");
            channelRepository.save(channel);
        }
    }
}
