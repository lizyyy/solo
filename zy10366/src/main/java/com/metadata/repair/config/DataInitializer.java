package com.metadata.repair.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class DataInitializer {

    @Bean
    public CommandLineRunner initData() {
        return args -> {
            log.info("==========================================");
            log.info("附件元数据修复API服务启动成功!");
            log.info("==========================================");
            log.info("");
            log.info("API文档说明:");
            log.info("  基础路径: http://localhost:8080/api/repair");
            log.info("  H2控制台: http://localhost:8080/api/h2-console");
            log.info("");
            log.info("接口列表:");
            log.info("  POST /batch              - 创建修复批次");
            log.info("  POST /batch/{no}/validate - 校验批次");
            log.info("  POST /batch/{no}/start   - 开始修复");
            log.info("  GET  /batch/{no}/status  - 查询批次状态");
            log.info("  GET  /batch/{no}/report  - 查询修复报告");
            log.info("  GET  /batch/{no}/history - 查询历史记录");
            log.info("  GET  /batch/{no}/exceptions - 查询异常清单");
            log.info("  GET  /batches            - 查询所有批次");
            log.info("");
            log.info("==========================================");
        };
    }
}
