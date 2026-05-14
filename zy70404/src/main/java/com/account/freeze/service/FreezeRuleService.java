package com.account.freeze.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class FreezeRuleService {

    public Integer getCurrentRuleVersion() {
        return 1;
    }

    public String getRuleDesc(Integer ruleVersion) {
        return "规则版本 " + ruleVersion + "：短信内容完整即可冻结";
    }
}
