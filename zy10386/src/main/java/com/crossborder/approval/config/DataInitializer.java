package com.crossborder.approval.config;

import com.crossborder.approval.model.entity.DataDomain;
import com.crossborder.approval.repository.DataDomainRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final DataDomainRepository dataDomainRepository;

    @Override
    public void run(String... args) {
        if (dataDomainRepository.count() == 0) {
            log.info("初始化数据域数据...");
            
            List<DataDomain> domains = Arrays.asList(
                    createDataDomain("USER_PROFILE", "用户个人信息", 
                            "包含用户姓名、联系方式、地址等个人身份信息", 
                            false, 2),
                    createDataDomain("FINANCIAL_DATA", "财务数据", 
                            "交易记录、账户余额、支付信息等敏感财务数据", 
                            true, 3),
                    createDataDomain("HEALTH_RECORD", "健康记录", 
                            "用户健康数据、医疗记录等", 
                            true, 3),
                    createDataDomain("BUSINESS_INTEL", "商业智能数据", 
                            "销售报表、市场分析、运营指标等", 
                            false, 2),
                    createDataDomain("PUBLIC_DATA", "公开数据", 
                            "可对外公开的业务数据", 
                            false, 1)
            );
            
            dataDomainRepository.saveAll(domains);
            log.info("数据域数据初始化完成，共 {} 条记录", domains.size());
        }
    }

    private DataDomain createDataDomain(String code, String name, String description,
                                        boolean requiresSpecialApproval, int sensitivityLevel) {
        DataDomain domain = new DataDomain();
        domain.setCode(code);
        domain.setName(name);
        domain.setDescription(description);
        domain.setRequiresSpecialApproval(requiresSpecialApproval);
        domain.setSensitivityLevel(sensitivityLevel);
        return domain;
    }
}
