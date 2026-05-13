package com.api.inspection;

import com.api.inspection.dto.*;
import com.api.inspection.entity.*;
import com.api.inspection.enums.AssertionType;
import com.api.inspection.enums.TransactionStatus;
import com.api.inspection.exception.BusinessException;
import com.api.inspection.service.ExecutionBatchService;
import com.api.inspection.service.TransactionTemplateService;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@Slf4j
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SelfCheckTest {

    @Autowired
    private TransactionTemplateService templateService;

    @Autowired
    private ExecutionBatchService batchService;

    private static Long createdTemplateId;
    private static Long createdBatchId;

    @Test
    @Order(1)
    @DisplayName("测试1: 创建事务模板 - 正常流程")
    void testCreateTemplate() {
        log.info("=== 测试1: 创建事务模板 ===");
        
        CreateTemplateRequest request = createValidTemplateRequest("API-TEST-001", "用户登录流程测试");
        
        TransactionTemplate template = templateService.createTemplate(request);
        
        assertNotNull(template);
        assertNotNull(template.getId());
        assertEquals("API-TEST-001", template.getTemplateCode());
        assertEquals("用户登录流程测试", template.getTemplateName());
        assertEquals(TransactionStatus.DRAFT, template.getStatus());
        assertEquals(2, template.getSteps().size());
        
        createdTemplateId = template.getId();
        log.info("模板创建成功, ID: {}", createdTemplateId);
    }

    @Test
    @Order(2)
    @DisplayName("测试2: 重复提交测试 - 相同模板编码")
    void testDuplicateTemplateCode() {
        log.info("=== 测试2: 重复提交测试 ===");
        
        CreateTemplateRequest request = createValidTemplateRequest("API-TEST-001", "重复模板");
        
        assertThrows(BusinessException.class, () -> {
            templateService.createTemplate(request);
        }, "相同模板编码应该抛出异常");
        
        log.info("重复提交拦截成功");
    }

    @Test
    @Order(3)
    @DisplayName("测试3: 脏数据测试 - 缺少必填字段")
    void testInvalidTemplateData() {
        log.info("=== 测试3: 脏数据测试 ===");
        
        CreateTemplateRequest request = new CreateTemplateRequest();
        request.setTemplateCode("API-TEST-002");
        request.setTemplateName("缺少步骤的模板");
        request.setCreatedBy("tester");
        request.setSteps(new ArrayList<>());
        
        assertThrows(BusinessException.class, () -> {
            templateService.createTemplate(request);
        }, "缺少步骤应该抛出异常");
        
        log.info("脏数据拦截成功");
    }

    @Test
    @Order(4)
    @DisplayName("测试4: 校验模板 - 草稿状态可以校验")
    void testValidateTemplate() {
        log.info("=== 测试4: 校验模板 ===");
        
        TransactionTemplate template = templateService.validateTemplate(createdTemplateId);
        
        assertEquals(TransactionStatus.VALIDATED, template.getStatus());
        log.info("模板校验成功, 当前状态: {}", template.getStatus());
    }

    @Test
    @Order(5)
    @DisplayName("测试5: 状态跳转测试 - 已校验状态不能直接跳转到执行中")
    void testInvalidStatusTransition() {
        log.info("=== 测试5: 状态跳转测试 ===");
        
        assertThrows(BusinessException.class, () -> {
            templateService.updateStatus(createdTemplateId, TransactionStatus.RUNNING);
        }, "VALIDATED 不能直接跳转到 RUNNING");
        
        log.info("非法状态跳转拦截成功");
    }

    @Test
    @Order(6)
    @DisplayName("测试6: 状态跳转测试 - 正常状态流转")
    void testValidStatusTransition() {
        log.info("=== 测试6: 正常状态流转 ===");
        
        TransactionTemplate template = templateService.updateStatus(createdTemplateId, TransactionStatus.PENDING);
        assertEquals(TransactionStatus.PENDING, template.getStatus());
        log.info("状态流转成功: VALIDATED -> PENDING");
    }

    @Test
    @Order(7)
    @DisplayName("测试7: 创建执行批次 - 正常流程")
    void testCreateBatch() {
        log.info("=== 测试7: 创建执行批次 ===");
        
        ExecutionBatch batch = batchService.createBatch(createdTemplateId, "tester");
        
        assertNotNull(batch);
        assertNotNull(batch.getId());
        assertEquals(TransactionStatus.PENDING, batch.getStatus());
        assertEquals(2, batch.getTotalSteps());
        
        createdBatchId = batch.getId();
        log.info("批次创建成功, ID: {}", createdBatchId);
    }

    @Test
    @Order(8)
    @DisplayName("测试8: 批次执行 - 开始执行")
    void testStartExecution() {
        log.info("=== 测试8: 开始执行批次 ===");
        
        ExecutionBatch batch = batchService.startExecution(createdBatchId);
        assertEquals(TransactionStatus.RUNNING, batch.getStatus());
        assertNotNull(batch.getStartTime());
        log.info("批次开始执行, 状态: {}", batch.getStatus());
    }

    @Test
    @Order(9)
    @DisplayName("测试9: 批次执行 - 执行步骤成功")
    void testExecuteStepSuccess() {
        log.info("=== 测试9: 执行步骤成功 ===");
        
        ExecutionBatchService.StepExecutionResult result = new ExecutionBatchService.StepExecutionResult();
        result.setSuccess(true);
        result.setStartTime(LocalDateTime.now());
        result.setEndTime(LocalDateTime.now().plusSeconds(1));
        result.setDuration(1000L);
        result.setStatusCode(200);
        result.setResponseBody("{\"code\": 200, \"message\": \"success\"}");
        
        List<ExecutionBatchService.AssertionResultDTO> assertions = new ArrayList<>();
        ExecutionBatchService.AssertionResultDTO assertion = new ExecutionBatchService.AssertionResultDTO();
        assertion.setAssertionType(AssertionType.STATUS_CODE);
        assertion.setExpectedValue("200");
        assertion.setActualValue("200");
        assertion.setPassed(true);
        assertions.add(assertion);
        result.setAssertionResults(assertions);
        
        ExecutionBatch batch = batchService.executeStep(createdBatchId, 1, result);
        assertEquals(1, batch.getSuccessSteps());
        log.info("步骤1执行成功");
    }

    @Test
    @Order(10)
    @DisplayName("测试10: 批次执行 - 执行步骤失败")
    void testExecuteStepFailure() {
        log.info("=== 测试10: 执行步骤失败 ===");
        
        ExecutionBatchService.StepExecutionResult result = new ExecutionBatchService.StepExecutionResult();
        result.setSuccess(false);
        result.setStartTime(LocalDateTime.now());
        result.setEndTime(LocalDateTime.now().plusSeconds(2));
        result.setDuration(2000L);
        result.setStatusCode(500);
        result.setResponseBody("{\"code\": 500, \"message\": \"internal error\"}");
        result.setErrorMessage("服务器内部错误");
        
        List<ExecutionBatchService.FailureLocationDTO> failures = new ArrayList<>();
        ExecutionBatchService.FailureLocationDTO failure = new ExecutionBatchService.FailureLocationDTO();
        failure.setLocationType("RESPONSE_BODY");
        failure.setLocation("$.code");
        failure.setDescription("响应状态码不符合预期");
        failure.setExpectedValue("200");
        failure.setActualValue("500");
        failures.add(failure);
        result.setFailureLocations(failures);
        
        ExecutionBatch batch = batchService.executeStep(createdBatchId, 2, result);
        assertEquals(1, batch.getFailedSteps());
        assertEquals(TransactionStatus.FAILED, batch.getStatus());
        assertNotNull(batch.getEndTime());
        log.info("步骤2执行失败, 批次最终状态: {}", batch.getStatus());
    }

    @Test
    @Order(11)
    @DisplayName("测试11: 已结束批次不能撤销")
    void testCancelCompletedBatch() {
        log.info("=== 测试11: 已结束批次撤销测试 ===");
        
        assertThrows(BusinessException.class, () -> {
            batchService.cancelBatch(createdBatchId);
        }, "已结束的批次不能撤销");
        
        log.info("已结束批次撤销拦截成功");
    }

    @Test
    @Order(12)
    @DisplayName("测试12: 并发重复创建模板测试")
    void testConcurrentCreateTemplate() throws InterruptedException {
        log.info("=== 测试12: 并发重复创建测试 ===");
        
        int threadCount = 5;
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        
        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    CreateTemplateRequest request = createValidTemplateRequest(
                            "API-CONCURRENT-001", "并发测试模板");
                    templateService.createTemplate(request);
                    successCount.incrementAndGet();
                } catch (BusinessException e) {
                    failCount.incrementAndGet();
                    log.debug("并发创建被拦截: {}", e.getMessage());
                } finally {
                    latch.countDown();
                }
            });
        }
        
        latch.await();
        executor.shutdown();
        
        assertEquals(1, successCount.get(), "应该只有一个线程创建成功");
        assertEquals(threadCount - 1, failCount.get(), "其余线程应该被幂等性拦截");
        log.info("并发测试完成 - 成功: {}, 失败: {}", successCount.get(), failCount.get());
    }

    @Test
    @Order(13)
    @DisplayName("测试13: 撤销模板 - 正常流程")
    void testCancelTemplate() {
        log.info("=== 测试13: 撤销模板 ===");
        
        CreateTemplateRequest request = createValidTemplateRequest("API-TEST-CANCEL", "待撤销模板");
        TransactionTemplate template = templateService.createTemplate(request);
        
        TransactionTemplate cancelled = templateService.cancelTemplate(template.getId());
        assertEquals(TransactionStatus.CANCELLED, cancelled.getStatus());
        log.info("模板撤销成功");
    }

    @Test
    @Order(14)
    @DisplayName("测试14: 查询功能验证")
    void testQueryFunctions() {
        log.info("=== 测试14: 查询功能验证 ===");
        
        List<TransactionTemplate> templates = templateService.getAllTemplates();
        assertTrue(templates.size() > 0);
        log.info("查询所有模板成功, 数量: {}", templates.size());
        
        TransactionTemplate template = templateService.getTemplate(createdTemplateId);
        assertNotNull(template);
        log.info("查询单个模板成功");
        
        List<ExecutionBatch> batches = batchService.getAllBatches();
        assertTrue(batches.size() > 0);
        log.info("查询所有批次成功, 数量: {}", batches.size());
        
        List<ExecutionBatch> templateBatches = batchService.getBatchesByTemplate(createdTemplateId);
        assertTrue(templateBatches.size() > 0);
        log.info("查询模板关联批次成功");
    }

    @AfterAll
    static void summary() {
        log.info("========================================");
        log.info("  API合成事务巡检 - 自检测试完成");
        log.info("  测试覆盖场景:");
        log.info("  ✓ 正常创建流程");
        log.info("  ✓ 重复提交拦截");
        log.info("  ✓ 脏数据校验");
        log.info("  ✓ 状态机跳转校验");
        log.info("  ✓ 批次执行流程");
        log.info("  ✓ 失败定位记录");
        log.info("  ✓ 并发幂等性控制");
        log.info("  ✓ 撤销功能");
        log.info("  ✓ 查询功能");
        log.info("========================================");
    }

    private CreateTemplateRequest createValidTemplateRequest(String code, String name) {
        CreateTemplateRequest request = new CreateTemplateRequest();
        request.setTemplateCode(code);
        request.setTemplateName(name);
        request.setDescription("自动化测试模板");
        request.setCreatedBy("tester");
        
        List<StepRequest> steps = new ArrayList<>();
        
        StepRequest step1 = new StepRequest();
        step1.setStepOrder(1);
        step1.setStepName("获取验证码");
        step1.setHttpMethod("GET");
        step1.setUrl("http://localhost:8080/api/captcha");
        step1.setTimeout(5000);
        
        VariableExtractRequest extract1 = new VariableExtractRequest();
        extract1.setVariableName("captchaId");
        extract1.setExtractExpression("$.data.captchaId");
        extract1.setSourceType("RESPONSE_BODY");
        step1.setVariableExtracts(List.of(extract1));
        
        StepRequest step2 = new StepRequest();
        step2.setStepOrder(2);
        step2.setStepName("用户登录");
        step2.setHttpMethod("POST");
        step2.setUrl("http://localhost:8080/api/login");
        step2.setBody("{\"username\":\"test\",\"password\":\"123456\",\"captchaId\":\"${captchaId}\"}");
        step2.setTimeout(10000);
        
        AssertionRequest assertion1 = new AssertionRequest();
        assertion1.setAssertionType(AssertionType.STATUS_CODE);
        assertion1.setExpectedValue("200");
        assertion1.setEnabled(true);
        step2.setAssertions(List.of(assertion1));
        
        steps.add(step1);
        steps.add(step2);
        request.setSteps(steps);
        
        return request;
    }
}
