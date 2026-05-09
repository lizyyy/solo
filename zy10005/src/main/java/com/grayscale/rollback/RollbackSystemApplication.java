package com.grayscale.rollback;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RollbackSystemApplication {
    
    public static void main(String[] args) {
        SpringApplication.run(RollbackSystemApplication.class, args);
    }
}
