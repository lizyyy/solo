package com.airport.baggage;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class BaggageCompensationApplication {

    public static void main(String[] args) {
        SpringApplication.run(BaggageCompensationApplication.class, args);
    }
}
