package com.privacy.replay.config;

import com.privacy.replay.model.MaskingLevel;
import com.privacy.replay.service.PrivacyBudgetService;
import com.privacy.replay.service.UserSampleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final PrivacyBudgetService privacyBudgetService;
    private final UserSampleService userSampleService;

    @Override
    public void run(String... args) {
        log.info("Initializing test data...");

        privacyBudgetService.createBudget(
                "user001",
                BigDecimal.valueOf(10000),
                100,
                MaskingLevel.MEDIUM
        );
        log.info("Created budget for user001");

        privacyBudgetService.createBudget(
                "user002",
                BigDecimal.valueOf(500),
                5,
                MaskingLevel.HIGH
        );
        log.info("Created budget for user002 (limited budget)");

        userSampleService.createSample(
                "user001",
                "phone",
                "13800138000",
                60
        );

        userSampleService.createSample(
                "user001",
                "name",
                "张三",
                40
        );

        userSampleService.createSample(
                "user001",
                "idcard",
                "110101199001011234",
                80
        );

        userSampleService.createSample(
                "user001",
                "address",
                "北京市朝阳区某某街道123号",
                70
        );

        log.info("Test data initialization completed");
    }
}
