package com.example.lock;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ResourceLockApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResourceLockApplication.class, args);
    }
}
