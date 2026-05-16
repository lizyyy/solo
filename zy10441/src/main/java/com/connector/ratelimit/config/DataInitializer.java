package com.connector.ratelimit.config;

import com.connector.ratelimit.model.entity.Connector;
import com.connector.ratelimit.model.entity.SleepStrategy;
import com.connector.ratelimit.model.entity.SupplierAccount;
import com.connector.ratelimit.model.enums.SleepStatus;
import com.connector.ratelimit.repository.ConnectorRepository;
import com.connector.ratelimit.repository.SleepStrategyRepository;
import com.connector.ratelimit.repository.SupplierAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final SleepStrategyRepository sleepStrategyRepository;
    private final SupplierAccountRepository supplierAccountRepository;
    private final ConnectorRepository connectorRepository;

    @Override
    public void run(String... args) {
        initSleepStrategies();
        initSupplierAccounts();
        initConnectors();
        log.info("数据初始化完成");
    }

    private void initSleepStrategies() {
        if (sleepStrategyRepository.count() == 0) {
            SleepStrategy level1 = new SleepStrategy();
            level1.setStrategyCode("LEVEL_1");
            level1.setStrategyName("休眠策略-级别1");
            level1.setSleepLevel(1);
            level1.setSleepDurationSeconds(60L);
            level1.setBackoffType("FIXED");
            level1.setEnabled(true);
            sleepStrategyRepository.save(level1);

            SleepStrategy level2 = new SleepStrategy();
            level2.setStrategyCode("LEVEL_2");
            level2.setStrategyName("休眠策略-级别2");
            level2.setSleepLevel(2);
            level2.setSleepDurationSeconds(300L);
            level2.setBackoffType("FIXED");
            level2.setEnabled(true);
            sleepStrategyRepository.save(level2);

            SleepStrategy level3 = new SleepStrategy();
            level3.setStrategyCode("LEVEL_3");
            level3.setStrategyName("休眠策略-级别3");
            level3.setSleepLevel(3);
            level3.setSleepDurationSeconds(900L);
            level3.setBackoffType("FIXED");
            level3.setEnabled(true);
            sleepStrategyRepository.save(level3);

            SleepStrategy level4 = new SleepStrategy();
            level4.setStrategyCode("LEVEL_4");
            level4.setStrategyName("休眠策略-级别4");
            level4.setSleepLevel(4);
            level4.setSleepDurationSeconds(1800L);
            level4.setBackoffType("FIXED");
            level4.setEnabled(true);
            sleepStrategyRepository.save(level4);

            SleepStrategy level5 = new SleepStrategy();
            level5.setStrategyCode("LEVEL_5");
            level5.setStrategyName("休眠策略-级别5");
            level5.setSleepLevel(5);
            level5.setSleepDurationSeconds(3600L);
            level5.setBackoffType("FIXED");
            level5.setEnabled(true);
            sleepStrategyRepository.save(level5);

            log.info("休眠策略初始化完成，共5条");
        }
    }

    private void initSupplierAccounts() {
        if (supplierAccountRepository.count() == 0) {
            SupplierAccount supplier1 = new SupplierAccount();
            supplier1.setAccountCode("SUPPLIER_ALIYUN");
            supplier1.setSupplierName("阿里云");
            supplier1.setSupplierCode("ALIYUN");
            supplier1.setApiKey("test-api-key-aliyun");
            supplier1.setEndpoint("https://api.aliyun.com");
            supplier1.setDailyLimit(10000);
            supplier1.setHourlyLimit(1000);
            supplier1.setQpsLimit(100);
            supplier1.setEnabled(true);
            supplierAccountRepository.save(supplier1);

            SupplierAccount supplier2 = new SupplierAccount();
            supplier2.setAccountCode("SUPPLIER_TENCENT");
            supplier2.setSupplierName("腾讯云");
            supplier2.setSupplierCode("TENCENT");
            supplier2.setApiKey("test-api-key-tencent");
            supplier2.setEndpoint("https://api.qcloud.com");
            supplier2.setDailyLimit(8000);
            supplier2.setHourlyLimit(800);
            supplier2.setQpsLimit(80);
            supplier2.setEnabled(true);
            supplierAccountRepository.save(supplier2);

            SupplierAccount supplier3 = new SupplierAccount();
            supplier3.setAccountCode("SUPPLIER_HUAWEI");
            supplier3.setSupplierName("华为云");
            supplier3.setSupplierCode("HUAWEI");
            supplier3.setApiKey("test-api-key-huawei");
            supplier3.setEndpoint("https://api.huaweicloud.com");
            supplier3.setDailyLimit(5000);
            supplier3.setHourlyLimit(500);
            supplier3.setQpsLimit(50);
            supplier3.setEnabled(true);
            supplierAccountRepository.save(supplier3);

            log.info("供应商账号初始化完成，共3条");
        }
    }

    private void initConnectors() {
        if (connectorRepository.count() == 0) {
            Connector connector1 = new Connector();
            connector1.setConnectorCode("CONNECTOR_OSS_UPLOAD");
            connector1.setConnectorName("OSS文件上传连接器");
            connector1.setDescription("用于上传文件到阿里云OSS");
            connector1.setSupplierCode("ALIYUN");
            connector1.setStatus(SleepStatus.ACTIVE);
            connector1.setCurrentSleepLevel(0);
            connectorRepository.save(connector1);

            Connector connector2 = new Connector();
            connector2.setConnectorCode("CONNECTOR_SMS_SEND");
            connector2.setConnectorName("短信发送连接器");
            connector2.setDescription("用于调用腾讯云短信服务");
            connector2.setSupplierCode("TENCENT");
            connector2.setStatus(SleepStatus.ACTIVE);
            connector2.setCurrentSleepLevel(0);
            connectorRepository.save(connector2);

            Connector connector3 = new Connector();
            connector3.setConnectorCode("CONNECTOR_OCR_RECOGNIZE");
            connector3.setConnectorName("OCR识别连接器");
            connector3.setDescription("用于调用华为云OCR服务");
            connector3.setSupplierCode("HUAWEI");
            connector3.setStatus(SleepStatus.ACTIVE);
            connector3.setCurrentSleepLevel(0);
            connectorRepository.save(connector3);

            log.info("连接器初始化完成，共3条");
        }
    }
}
