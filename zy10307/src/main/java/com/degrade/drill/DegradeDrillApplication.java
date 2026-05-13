package com.degrade.drill;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DegradeDrillApplication {
    public static void main(String[] args) {
        SpringApplication.run(DegradeDrillApplication.class, args);
    }
}