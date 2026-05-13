package com.quota.arbitration.config;

import com.quota.arbitration.entity.CustomerQuota;
import com.quota.arbitration.entity.SharedPool;
import com.quota.arbitration.repository.CustomerQuotaRepository;
import com.quota.arbitration.repository.SharedPoolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final CustomerQuotaRepository customerQuotaRepository;
    private final SharedPoolRepository sharedPoolRepository;

    @Override
    public void run(String... args) {
        if (sharedPoolRepository.count() == 0) {
            SharedPool pool1 = new SharedPool();
            pool1.setPoolCode("POOL001");
            pool1.setPoolName("API通用配额池");
            pool1.setTotalCapacity(new BigDecimal("100000.00"));
            pool1.setAllocatedAmount(BigDecimal.ZERO);
            pool1.setAvailableAmount(new BigDecimal("100000.00"));
            pool1.setMaxBorrowPerApplication(new BigDecimal("10000.00"));
            pool1.setIsActive(true);
            pool1.setDescription("API调用的通用共享配额池");
            pool1.setCreatedAt(LocalDateTime.now());
            pool1.setUpdatedAt(LocalDateTime.now());
            sharedPoolRepository.save(pool1);
            log.info("初始化共享池: POOL001");

            SharedPool pool2 = new SharedPool();
            pool2.setPoolCode("POOL002");
            pool2.setPoolName("大客户专属配额池");
            pool2.setTotalCapacity(new BigDecimal("500000.00"));
            pool2.setAllocatedAmount(BigDecimal.ZERO);
            pool2.setAvailableAmount(new BigDecimal("500000.00"));
            pool2.setMaxBorrowPerApplication(new BigDecimal("50000.00"));
            pool2.setIsActive(true);
            pool2.setDescription("大客户专属配额池");
            pool2.setCreatedAt(LocalDateTime.now());
            pool2.setUpdatedAt(LocalDateTime.now());
            sharedPoolRepository.save(pool2);
            log.info("初始化共享池: POOL002");
        }

        if (customerQuotaRepository.count() == 0) {
            CustomerQuota customer1 = new CustomerQuota();
            customer1.setCustomerId("CUST001");
            customer1.setCustomerName("科技有限公司");
            customer1.setTotalQuota(new BigDecimal("50000.00"));
            customer1.setUsedQuota(BigDecimal.ZERO);
            customer1.setAvailableQuota(new BigDecimal("50000.00"));
            customer1.setLockedQuota(BigDecimal.ZERO);
            customer1.setBorrowedQuota(BigDecimal.ZERO);
            customer1.setIsActive(true);
            customer1.setCreatedAt(LocalDateTime.now());
            customer1.setUpdatedAt(LocalDateTime.now());
            customerQuotaRepository.save(customer1);
            log.info("初始化客户: CUST001");

            CustomerQuota customer2 = new CustomerQuota();
            customer2.setCustomerId("CUST002");
            customer2.setCustomerName("数据服务公司");
            customer2.setTotalQuota(new BigDecimal("100000.00"));
            customer2.setUsedQuota(BigDecimal.ZERO);
            customer2.setAvailableQuota(new BigDecimal("100000.00"));
            customer2.setLockedQuota(BigDecimal.ZERO);
            customer2.setBorrowedQuota(BigDecimal.ZERO);
            customer2.setIsActive(true);
            customer2.setCreatedAt(LocalDateTime.now());
            customer2.setUpdatedAt(LocalDateTime.now());
            customerQuotaRepository.save(customer2);
            log.info("初始化客户: CUST002");

            CustomerQuota customer3 = new CustomerQuota();
            customer3.setCustomerId("CUST003");
            customer3.setCustomerName("电商平台");
            customer3.setTotalQuota(new BigDecimal("200000.00"));
            customer3.setUsedQuota(BigDecimal.ZERO);
            customer3.setAvailableQuota(new BigDecimal("200000.00"));
            customer3.setLockedQuota(BigDecimal.ZERO);
            customer3.setBorrowedQuota(BigDecimal.ZERO);
            customer3.setIsActive(true);
            customer3.setCreatedAt(LocalDateTime.now());
            customer3.setUpdatedAt(LocalDateTime.now());
            customerQuotaRepository.save(customer3);
            log.info("初始化客户: CUST003");
        }

        log.info("数据初始化完成!");
    }
}
