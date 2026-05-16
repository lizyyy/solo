package com.privacy.export.config;

import com.privacy.export.entity.ConsentVersion;
import com.privacy.export.repository.ConsentVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final ConsentVersionRepository consentVersionRepository;

    @Override
    public void run(String... args) {
        log.info("Initializing sample data...");
        
        if (consentVersionRepository.count() == 0) {
            createSampleConsentVersions();
        }
        
        log.info("Sample data initialization completed.");
    }

    private void createSampleConsentVersions() {
        log.info("Creating sample consent versions...");

        ConsentVersion v1 = ConsentVersion.builder()
                .versionCode("PRIVACY-V1.0")
                .versionName("隐私政策同意版本1.0")
                .description("个人数据导出基础版本")
                .effectiveDate(LocalDateTime.now().minusDays(30))
                .expiryDate(null)
                .isActive(true)
                .consentContent("本人同意按照隐私政策V1.0的规定导出个人数据，包括基本资料、联系方式、交易记录等。")
                .legalReference("《个人信息保护法》第45条")
                .createdBy("SYSTEM")
                .createdAt(LocalDateTime.now())
                .build();

        ConsentVersion v2 = ConsentVersion.builder()
                .versionCode("PRIVACY-V2.0")
                .versionName("隐私政策同意版本2.0")
                .description("扩展范围版本，包含行为数据和设备信息")
                .effectiveDate(LocalDateTime.now().minusDays(7))
                .expiryDate(null)
                .isActive(true)
                .consentContent("本人同意按照隐私政策V2.0的规定导出个人数据，包括基本资料、联系方式、交易记录、行为数据、设备信息等。")
                .legalReference("《个人信息保护法》第45条、《数据安全法》第32条")
                .createdBy("SYSTEM")
                .createdAt(LocalDateTime.now())
                .build();

        consentVersionRepository.save(v1);
        consentVersionRepository.save(v2);

        log.info("Sample consent versions created: PRIVACY-V1.0, PRIVACY-V2.0");
    }
}
