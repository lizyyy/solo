package com.object.lifecycle;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class ObjectLifecycleApplication {

    public static void main(String[] args) {
        SpringApplication.run(ObjectLifecycleApplication.class, args);
    }
}
