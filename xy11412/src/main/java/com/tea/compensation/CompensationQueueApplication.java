package com.tea.compensation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CompensationQueueApplication {
    public static void main(String[] args) {
        SpringApplication.run(CompensationQueueApplication.class, args);
        System.out.println("===============================================");
        System.out.println("  连锁茶饮原料重试补偿队列 API 启动成功!");
        System.out.println("  接口文档: http://localhost:8080/");
        System.out.println("  H2控制台: http://localhost:8080/h2-console");
        System.out.println("===============================================");
    }
}
