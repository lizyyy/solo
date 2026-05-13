package com.forklift;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.forklift.mapper")
public class ChargingSchedulingApplication {
    public static void main(String[] args) {
        SpringApplication.run(ChargingSchedulingApplication.class, args);
    }
}
