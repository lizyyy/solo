package com.datarepair.approval;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.datarepair.approval.mapper")
public class DataRepairApprovalApplication {

    public static void main(String[] args) {
        SpringApplication.run(DataRepairApprovalApplication.class, args);
    }
}
