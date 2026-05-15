package com.identity.verification.config;

import com.identity.verification.model.IdentitySource;
import com.identity.verification.repository.IdentitySourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final IdentitySourceRepository sourceRepository;

    @Override
    public void run(String... args) {
        if (sourceRepository.count() == 0) {
            log.info("初始化身份数据源配置...");

            IdentitySource govSource = new IdentitySource();
            govSource.setSourceCode("GOV");
            govSource.setSourceName("政府数据源");
            govSource.setSourceDescription("公安系统官方数据源，可信度最高");
            govSource.setTrustWeight(90);
            govSource.setEnabled(true);
            sourceRepository.save(govSource);

            IdentitySource bankSource = new IdentitySource();
            bankSource.setSourceCode("BANK");
            bankSource.setSourceName("银行数据源");
            bankSource.setSourceDescription("银行系统数据源，可信度较高");
            bankSource.setTrustWeight(80);
            bankSource.setEnabled(true);
            sourceRepository.save(bankSource);

            IdentitySource telecomSource = new IdentitySource();
            telecomSource.setSourceCode("TELECOM");
            telecomSource.setSourceName("运营商数据源");
            telecomSource.setSourceDescription("电信运营商数据源");
            telecomSource.setTrustWeight(70);
            telecomSource.setEnabled(true);
            sourceRepository.save(telecomSource);

            IdentitySource thirdPartySource = new IdentitySource();
            thirdPartySource.setSourceCode("THIRD_PARTY");
            thirdPartySource.setSourceName("第三方数据源");
            thirdPartySource.setSourceDescription("第三方合作机构数据源");
            thirdPartySource.setTrustWeight(50);
            thirdPartySource.setEnabled(true);
            sourceRepository.save(thirdPartySource);

            log.info("身份数据源配置初始化完成");
        }
    }
}
