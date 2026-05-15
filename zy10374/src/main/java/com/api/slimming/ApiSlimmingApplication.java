package com.api.slimming;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.api.slimming.mapper")
public class ApiSlimmingApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiSlimmingApplication.class, args);
    }
}
