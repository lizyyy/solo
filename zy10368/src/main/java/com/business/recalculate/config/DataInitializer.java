package com.business.recalculate.config;

import com.business.recalculate.model.ProcessingRule;
import com.business.recalculate.repository.ProcessingRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final ProcessingRuleRepository ruleRepository;

    @Override
    public void run(String... args) {
        if (ruleRepository.count() == 0) {
            log.info("初始化处理规则数据...");

            ProcessingRule rule1 = createRule("RULE_001", "交易金额重算规则", "v1.0",
                    "针对历史交易的金额进行重新计算");
            ProcessingRule rule2 = createRule("RULE_002", "手续费计算规则", "v1.2",
                    "按照新的费率标准重新计算交易手续费");
            ProcessingRule rule3 = createRule("RULE_003", "利息计算规则", "v2.0",
                    "更新计息周期和利率计算公式");

            ruleRepository.save(rule1);
            ruleRepository.save(rule2);
            ruleRepository.save(rule3);

            log.info("处理规则初始化完成，共 {} 条", ruleRepository.count());
        }
    }

    private ProcessingRule createRule(String code, String name, String version, String description) {
        ProcessingRule rule = new ProcessingRule();
        rule.setRuleCode(code);
        rule.setRuleName(name);
        rule.setRuleVersion(version);
        rule.setRuleDescription(description);
        rule.setEnabled(true);
        rule.setCreatedAt(LocalDateTime.now());
        rule.setUpdatedAt(LocalDateTime.now());
        rule.setCreatedBy("system");
        rule.setUpdatedBy("system");

        Map<String, String> params = new HashMap<>();
        params.put("version", version);
        params.put("effectiveDate", "2024-01-01");
        rule.setParameters(params);

        return rule;
    }
}
