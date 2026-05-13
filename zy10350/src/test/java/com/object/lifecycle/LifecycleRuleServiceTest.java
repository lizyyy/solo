package com.object.lifecycle;

import com.object.lifecycle.dto.CreateRuleRequest;
import com.object.lifecycle.entity.LifecycleRule;
import com.object.lifecycle.entity.ObjectPrefix;
import com.object.lifecycle.enums.RuleStatus;
import com.object.lifecycle.exception.BusinessException;
import com.object.lifecycle.repository.LifecycleRuleRepository;
import com.object.lifecycle.repository.ObjectPrefixRepository;
import com.object.lifecycle.service.LifecycleRuleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class LifecycleRuleServiceTest {

    @Autowired
    private LifecycleRuleService ruleService;

    @Autowired
    private ObjectPrefixRepository prefixRepository;

    @Autowired
    private LifecycleRuleRepository ruleRepository;

    private ObjectPrefix testPrefix;

    @BeforeEach
    void setUp() {
        testPrefix = new ObjectPrefix();
        testPrefix.setPrefix("/test/");
        testPrefix.setBucketName("test-bucket");
        testPrefix.setEnabled(true);
        testPrefix = prefixRepository.save(testPrefix);
    }

    @Test
    void testCreateRule_Success() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);

        LifecycleRule rule = ruleService.createRule(request);

        assertNotNull(rule);
        assertEquals("rule-001", rule.getRuleId());
        assertEquals(RuleStatus.DRAFT, rule.getStatus());
    }

    @Test
    void testCreateRule_DuplicateRuleId() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);

        ruleService.createRule(request);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> ruleService.createRule(request));
        assertEquals(400, exception.getCode());
        assertTrue(exception.getMessage().contains("已存在"));
    }

    @Test
    void testVerifyRule_Success() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);
        LifecycleRule rule = ruleService.createRule(request);

        LifecycleRule verified = ruleService.verifyRule(rule.getRuleId());

        assertEquals(RuleStatus.VERIFIED, verified.getStatus());
    }

    @Test
    void testVerifyRule_NotDraftStatus() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);
        LifecycleRule rule = ruleService.createRule(request);
        rule.setStatus(RuleStatus.ACTIVE);
        ruleRepository.save(rule);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> ruleService.verifyRule(rule.getRuleId()));
        assertEquals(400, exception.getCode());
        assertTrue(exception.getMessage().contains("草稿状态"));
    }

    @Test
    void testVerifyRule_InvalidDays() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(90);
        request.setDeleteAfterDays(30);
        LifecycleRule rule = ruleService.createRule(request);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> ruleService.verifyRule(rule.getRuleId()));
        assertEquals(400, exception.getCode());
        assertTrue(exception.getMessage().contains("大于"));
    }

    @Test
    void testActivateRule_Success() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);
        LifecycleRule rule = ruleService.createRule(request);
        rule = ruleService.verifyRule(rule.getRuleId());

        LifecycleRule activated = ruleService.activateRule(rule.getRuleId());

        assertEquals(RuleStatus.ACTIVE, activated.getStatus());
    }

    @Test
    void testActivateRule_InvalidStatus() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);
        LifecycleRule rule = ruleService.createRule(request);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> ruleService.activateRule(rule.getRuleId()));
        assertEquals(400, exception.getCode());
        assertTrue(exception.getMessage().contains("已校验或已暂停"));
    }

    @Test
    void testSuspendRule_Success() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);
        LifecycleRule rule = ruleService.createRule(request);
        rule = ruleService.verifyRule(rule.getRuleId());
        rule = ruleService.activateRule(rule.getRuleId());

        LifecycleRule suspended = ruleService.suspendRule(rule.getRuleId());

        assertEquals(RuleStatus.SUSPENDED, suspended.getStatus());
    }

    @Test
    void testSuspendRule_NotActiveStatus() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);
        LifecycleRule rule = ruleService.createRule(request);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> ruleService.suspendRule(rule.getRuleId()));
        assertEquals(400, exception.getCode());
        assertTrue(exception.getMessage().contains("激活状态"));
    }

    @Test
    void testCancelRule_Success() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);
        LifecycleRule rule = ruleService.createRule(request);

        LifecycleRule cancelled = ruleService.cancelRule(rule.getRuleId());

        assertEquals(RuleStatus.CANCELLED, cancelled.getStatus());
    }

    @Test
    void testCancelRule_AlreadyCancelled() {
        CreateRuleRequest request = new CreateRuleRequest();
        request.setRuleId("rule-001");
        request.setRuleName("测试规则");
        request.setPrefixId(testPrefix.getId());
        request.setArchiveAfterDays(30);
        request.setDeleteAfterDays(90);
        LifecycleRule rule = ruleService.createRule(request);
        rule.setStatus(RuleStatus.CANCELLED);
        ruleRepository.save(rule);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> ruleService.cancelRule(rule.getRuleId()));
        assertEquals(400, exception.getCode());
        assertTrue(exception.getMessage().contains("不能撤销"));
    }
}
