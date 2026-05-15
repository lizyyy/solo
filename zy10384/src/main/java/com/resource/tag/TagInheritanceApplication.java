package com.resource.tag;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class TagInheritanceApplication {
    public static void main(String[] args) {
        SpringApplication.run(TagInheritanceApplication.class, args);
    }
}
