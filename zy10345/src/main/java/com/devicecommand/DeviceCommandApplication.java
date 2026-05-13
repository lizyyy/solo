package com.devicecommand;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DeviceCommandApplication {

    public static void main(String[] args) {
        SpringApplication.run(DeviceCommandApplication.class, args);
    }
}
