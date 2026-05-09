package com.manufacture.outsourcing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class OutsourcingInspectionApplication {

    public static void main(String[] args) {
        SpringApplication.run(OutsourcingInspectionApplication.class, args);
    }
}
