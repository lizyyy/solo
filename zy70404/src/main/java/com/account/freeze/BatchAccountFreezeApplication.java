package com.account.freeze;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.account.freeze.mapper")
public class BatchAccountFreezeApplication {

    public static void main(String[] args) {
        SpringApplication.run(BatchAccountFreezeApplication.class, args);
    }
}
