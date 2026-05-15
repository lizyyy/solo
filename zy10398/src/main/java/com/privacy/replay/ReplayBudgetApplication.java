package com.privacy.replay;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ReplayBudgetApplication {

    public static void main(String[] args) {
        SpringApplication.run(ReplayBudgetApplication.class, args);
    }
}
