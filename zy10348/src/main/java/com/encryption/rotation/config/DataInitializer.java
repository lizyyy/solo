package com.encryption.rotation.config;

import com.encryption.rotation.model.entity.KeyVersion;
import com.encryption.rotation.model.entity.Tenant;
import com.encryption.rotation.model.enums.KeyStatus;
import com.encryption.rotation.repository.KeyVersionRepository;
import com.encryption.rotation.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final TenantRepository tenantRepository;
    private final KeyVersionRepository keyVersionRepository;

    @Override
    public void run(String... args) {
        if (tenantRepository.count() == 0) {
            Tenant tenant1 = new Tenant();
            tenant1.setId("tenant-001");
            tenant1.setTenantCode("ACME");
            tenant1.setTenantName("ACME Corporation");
            tenant1.setDescription("测试租户");
            tenant1.setEnabled(true);
            tenantRepository.save(tenant1);

            Tenant tenant2 = new Tenant();
            tenant2.setId("tenant-002");
            tenant2.setTenantCode("GLOBEX");
            tenant2.setTenantName("Globex Inc.");
            tenant2.setDescription("另一测试租户");
            tenant2.setEnabled(true);
            tenantRepository.save(tenant2);

            log.info("初始化测试租户数据完成");
        }

        if (keyVersionRepository.count() == 0) {
            KeyVersion keyV1 = new KeyVersion();
            keyV1.setId("key-v1");
            keyV1.setTenantId("tenant-001");
            keyV1.setVersion(1);
            keyV1.setKeyReference("aws-kms-key-12345");
            keyV1.setDescription("旧版数据加密密钥");
            keyV1.setStatus(KeyStatus.ACTIVE);
            keyV1.setActivatedAt(LocalDateTime.now().minusMonths(6));
            keyVersionRepository.save(keyV1);

            KeyVersion keyV2 = new KeyVersion();
            keyV2.setId("key-v2");
            keyV2.setTenantId("tenant-001");
            keyV2.setVersion(2);
            keyV2.setKeyReference("aws-kms-key-67890");
            keyV2.setDescription("新版数据加密密钥");
            keyV2.setStatus(KeyStatus.PENDING_ACTIVATION);
            keyVersionRepository.save(keyV2);

            KeyVersion keyV3 = new KeyVersion();
            keyV3.setId("key-v3");
            keyV3.setTenantId("tenant-002");
            keyV3.setVersion(1);
            keyV3.setKeyReference("azure-keyvault-key-abc");
            keyV3.setDescription("GLOBEX加密密钥");
            keyV3.setStatus(KeyStatus.ACTIVE);
            keyV3.setActivatedAt(LocalDateTime.now().minusMonths(3));
            keyVersionRepository.save(keyV3);

            log.info("初始化测试密钥数据完成");
        }

        log.info("数据初始化完成，测试数据:");
        log.info("  Tenant: tenant-001 (ACME)");
        log.info("  Tenant: tenant-002 (GLOBEX)");
        log.info("  Keys: key-v1, key-v2 (tenant-001), key-v3 (tenant-002)");
    }
}
