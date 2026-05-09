package com.example.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ConfigHotUpdateApplication {
    public static void main(String[] args) {
        SpringApplication.run(ConfigHotUpdateApplication.class, args);
    }
}
