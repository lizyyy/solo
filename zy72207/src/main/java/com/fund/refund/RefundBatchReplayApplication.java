package com.fund.refund;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.fund.refund.mapper")
public class RefundBatchReplayApplication {

    public static void main(String[] args) {
        SpringApplication.run(RefundBatchReplayApplication.class, args);
    }
}
