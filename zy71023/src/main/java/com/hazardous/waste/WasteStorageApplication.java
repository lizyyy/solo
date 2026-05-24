package com.hazardous.waste;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WasteStorageApplication {
    public static void main(String[] args) {
        SpringApplication.run(WasteStorageApplication.class, args);
    }
}
