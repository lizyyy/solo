package com.edge.config.ack;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.edge.config.ack.mapper")
public class EdgeConfigAckApplication {
    public static void main(String[] args) {
        SpringApplication.run(EdgeConfigAckApplication.class, args);
    }
}
