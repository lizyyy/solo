package com.api.inspection;

import com.api.inspection.dto.*;
import com.api.inspection.entity.*;
import com.api.inspection.enums.AssertionType;
import com.api.inspection.enums.TransactionStatus;
import com.api.inspection.exception.BusinessException;
import com.api.inspection.service.ExecutionBatchService;
import com.api.inspection.service.TransactionTemplateService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
public class SelfCheckMain {

    public static void main(String[] args) {
        System.out.println("========================================");
        System.out.println("  API合成事务巡检 - 自检测试入口");
        System.out.println("========================================");
        System.out.println();

        try {
            ApplicationContext context = SpringApplication.run(ApiInspectionApplication.class, args);
            
            TransactionTemplateService templateService = context.getBean(TransactionTemplateService.class);
            ExecutionBatchService batchService = context.getBean(ExecutionBatchService.class);

            int passed = 0;
            int failed = 0;
            List<String> results = new ArrayList<>();

            System.out.println("开始执行自检...");
            System.out.println();

            if (test1_CreateTemplate(templateService, results)) passed++; else failed++;
            if (test2_DuplicateTemplateCode(templateService, results)) passed++; else failed++;
            if (test3_EmptySteps(templateService, results)) passed++; else failed++;
            if (test4_ValidateTemplate(templateService, results)) passed++; else failed++;
            if (test5_InvalidStatusTransition(templateService, results)) passed++; else failed++;
            if (test6_ValidStatusTransition(templateService, results)) passed++; else failed++;
            if (test7_CreateBatch(templateService, batchService, results)) passed++; else failed++;
            if (test13_CancelTemplate(templateService, results)) passed++; else failed++;

            System.out.println();
            System.out.println("========================================");
            System.out.println("  自检结果汇总");
            System.out.println("========================================");
            for (String result : results) {
                System.out.println(result);
            }
            System.out.println("----------------------------------------");
            System.out.printf("  通过: %d, 失败: %d, 总计: %d%n", passed, failed, passed + failed);
            System.out.println("========================================");

            if (failed == 0) {
                System.out.println();
                System.out.println("✅ 所有自检测试通过!");
                System.out.println();
                printApiList();
                System.exit(0);
            } else {
                System.out.println();
                System.out.println("❌ 部分测试失败，请检查代码逻辑");
                System.exit(1);
            }

        } catch (Exception e) {
            System.err.println("自检启动失败: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static boolean test1_CreateTemplate(TransactionTemplateService service, List<String> results) {
        try {
            System.out.print("测试1: 创建事务模板... ");
            CreateTemplateRequest request = createValidRequest("API-TEST-001", "用户登录流程测试");
            TransactionTemplate template = service.createTemplate(request);
            
            if (template != null && template.getId() != null) {
                results.add("✅ 测试1通过 - 创建模板成功, ID: " + template.getId());
                System.out.println("通过");
                return true;
            }
            results.add("❌ 测试1失败 - 创建模板返回空");
            System.out.println("失败");
            return false;
        } catch (Exception e) {
            results.add("❌ 测试1失败 - " + e.getMessage());
            System.out.println("失败: " + e.getMessage());
            return false;
        }
    }

    private static boolean test2_DuplicateTemplateCode(TransactionTemplateService service, List<String> results) {
        try {
            System.out.print("测试2: 重复提交拦截... ");
            CreateTemplateRequest request = createValidRequest("API-TEST-001", "重复模板");
            service.createTemplate(request);
            
            results.add("❌ 测试2失败 - 未拦截重复编码");
            System.out.println("失败 - 未抛出异常");
            return false;
        } catch (BusinessException e) {
            results.add("✅ 测试2通过 - 重复编码拦截成功: " + e.getMessage());
            System.out.println("通过");
            return true;
        } catch (Exception e) {
            results.add("❌ 测试2失败 - " + e.getMessage());
            System.out.println("失败: " + e.getMessage());
            return false;
        }
    }

    private static boolean test3_EmptySteps(TransactionTemplateService service, List<String> results) {
        try {
            System.out.print("测试3: 空步骤拦截... ");
            CreateTemplateRequest request = new CreateTemplateRequest();
            request.setTemplateCode("API-TEST-EMPTY");
            request.setTemplateName("空步骤模板");
            request.setCreatedBy("tester");
            request.setSteps(new ArrayList<>());
            
            service.createTemplate(request);
            
            results.add("❌ 测试3失败 - 未拦截空步骤");
            System.out.println("失败 - 未抛出异常");
            return false;
        } catch (BusinessException e) {
            results.add("✅ 测试3通过 - 空步骤拦截成功: " + e.getMessage());
            System.out.println("通过");
            return true;
        } catch (Exception e) {
            results.add("❌ 测试3失败 - " + e.getMessage());
            System.out.println("失败: " + e.getMessage());
            return false;
        }
    }

    private static boolean test4_ValidateTemplate(TransactionTemplateService service, List<String> results) {
        try {
            System.out.print("测试4: 模板校验... ");
            CreateTemplateRequest request = createValidRequest("API-TEST-VALIDATE", "待校验模板");
            TransactionTemplate template = service.createTemplate(request);
            
            template = service.validateTemplate(template.getId());
            
            if (TransactionStatus.VALIDATED.equals(template.getStatus())) {
                results.add("✅ 测试4通过 - 模板校验成功, 状态: " + template.getStatus());
                System.out.println("通过");
                return true;
            }
            results.add("❌ 测试4失败 - 状态未正确更新");
            System.out.println("失败");
            return false;
        } catch (Exception e) {
            results.add("❌ 测试4失败 - " + e.getMessage());
            System.out.println("失败: " + e.getMessage());
            return false;
        }
    }

    private static boolean test5_InvalidStatusTransition(TransactionTemplateService service, List<String> results) {
        try {
            System.out.print("测试5: 非法状态跳转拦截... ");
            CreateTemplateRequest request = createValidRequest("API-TEST-TRANSITION", "状态跳转测试");
            TransactionTemplate template = service.createTemplate(request);
            template = service.validateTemplate(template.getId());
            
            service.updateStatus(template.getId(), TransactionStatus.RUNNING);
            
            results.add("❌ 测试5失败 - 未拦截非法跳转");
            System.out.println("失败 - 未抛出异常");
            return false;
        } catch (BusinessException e) {
            results.add("✅ 测试5通过 - 非法跳转拦截成功: " + e.getMessage());
            System.out.println("通过");
            return true;
        } catch (Exception e) {
            results.add("❌ 测试5失败 - " + e.getMessage());
            System.out.println("失败: " + e.getMessage());
            return false;
        }
    }

    private static boolean test6_ValidStatusTransition(TransactionTemplateService service, List<String> results) {
        try {
            System.out.print("测试6: 合法状态流转... ");
            CreateTemplateRequest request = createValidRequest("API-TEST-VALID", "合法状态测试");
            TransactionTemplate template = service.createTemplate(request);
            template = service.validateTemplate(template.getId());
            template = service.updateStatus(template.getId(), TransactionStatus.PENDING);
            
            if (TransactionStatus.PENDING.equals(template.getStatus())) {
                results.add("✅ 测试6通过 - 状态流转成功: VALIDATED -> PENDING");
                System.out.println("通过");
                return true;
            }
            results.add("❌ 测试6失败 - 状态未正确更新");
            System.out.println("失败");
            return false;
        } catch (Exception e) {
            results.add("❌ 测试6失败 - " + e.getMessage());
            System.out.println("失败: " + e.getMessage());
            return false;
        }
    }

    private static boolean test7_CreateBatch(TransactionTemplateService templateService, 
                                              ExecutionBatchService batchService, List<String> results) {
        try {
            System.out.print("测试7: 创建执行批次... ");
            CreateTemplateRequest request = createValidRequest("API-TEST-BATCH", "批次测试模板");
            TransactionTemplate template = templateService.createTemplate(request);
            template = templateService.validateTemplate(template.getId());
            template = templateService.updateStatus(template.getId(), TransactionStatus.PENDING);
            
            ExecutionBatch batch = batchService.createBatch(template.getId(), "tester");
            
            if (batch != null && batch.getId() != null && TransactionStatus.PENDING.equals(batch.getStatus())) {
                results.add("✅ 测试7通过 - 创建批次成功, ID: " + batch.getId());
                System.out.println("通过");
                return true;
            }
            results.add("❌ 测试7失败 - 批次创建异常");
            System.out.println("失败");
            return false;
        } catch (Exception e) {
            results.add("❌ 测试7失败 - " + e.getMessage());
            System.out.println("失败: " + e.getMessage());
            return false;
        }
    }

    private static boolean test13_CancelTemplate(TransactionTemplateService service, List<String> results) {
        try {
            System.out.print("测试8: 撤销模板... ");
            CreateTemplateRequest request = createValidRequest("API-TEST-CANCEL", "待撤销模板");
            TransactionTemplate template = service.createTemplate(request);
            
            template = service.cancelTemplate(template.getId());
            
            if (TransactionStatus.CANCELLED.equals(template.getStatus())) {
                results.add("✅ 测试8通过 - 模板撤销成功");
                System.out.println("通过");
                return true;
            }
            results.add("❌ 测试8失败 - 状态未正确更新");
            System.out.println("失败");
            return false;
        } catch (Exception e) {
            results.add("❌ 测试8失败 - " + e.getMessage());
            System.out.println("失败: " + e.getMessage());
            return false;
        }
    }

    private static CreateTemplateRequest createValidRequest(String code, String name) {
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

    private static void printApiList() {
        System.out.println("API 列表:");
        System.out.println("  POST   /api/templates              - 创建事务模板");
        System.out.println("  GET    /api/templates/{id}         - 查询模板详情");
        System.out.println("  POST   /api/templates/{id}/validate - 校验模板");
        System.out.println("  POST   /api/templates/{id}/cancel   - 撤销模板");
        System.out.println("  POST   /api/batches                - 创建执行批次");
        System.out.println("  GET    /api/batches/{id}           - 查询批次详情");
        System.out.println("  POST   /api/batches/{id}/start     - 开始执行批次");
        System.out.println("  POST   /api/batches/{id}/cancel    - 撤销批次");
        System.out.println("  GET    /api/export/template/{id}   - 导出模板");
        System.out.println("  GET    /api/export/batch/{id}      - 导出批次报告");
        System.out.println();
        System.out.println("服务启动后可通过以下方式访问:");
        System.out.println("  - 基础URL: http://localhost:8080");
        System.out.println("  - H2控制台: http://localhost:8080/h2-console");
        System.out.println();
    }
}
