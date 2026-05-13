package com.webhook.sequence;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WebhookSequenceApplication {
    public static void main(String[] args) {
        SpringApplication.run(WebhookSequenceApplication.class, args);
    }
}
