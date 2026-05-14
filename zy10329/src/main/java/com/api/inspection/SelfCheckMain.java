package com.api.inspection;

import com.api.inspection.dto.*;
import com.api.inspection.entity.*;
import com.api.inspection.enums.AssertionType;
import com.api.inspection.enums.TransactionStatus;
import com.api.inspection.exception.BusinessException;
import com.api.inspection.service.ExecutionBatchService;
import com.api.inspection.service.TransactionTemplateService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.context.annotation.Bean;

import java.util.ArrayList;
import java.util.List;

@SpringBootApplication
public class SelfCheckMain {

    public static void main(String[] args) {
        System.out.println();
        System.out.println("========================================");
        System.out.println("  API合成事务巡检 - 自检测试");
        System.out.println("========================================");
        System.out.println();
        
        // 以非Web方式运行，不启动Tomcat
        SpringApplication app = new SpringApplication(SelfCheckMain.class);
        app.setWebApplicationType(WebApplicationType.NONE);
        app.run(args);
    }

    @Bean
    CommandLineRunner runTests(TransactionTemplateService templateService, 
                               ExecutionBatchService batchService) {
        return args -> {
            int passed = 0;
            int failed = 0;
            List<String> results = new ArrayList<>();

            System.out.println("开始执行自检...");
            System.out.println();

            // 测试1: 创建事务模板
            System.out.print("测试 1/8: 创建事务模板... ");
            try {
                CreateTemplateRequest request = createValidRequest("API-TEST-001", "用户登录流程测试");
                TransactionTemplate template = templateService.createTemplate(request);
                if (template != null && template.getId() != null) {
                    System.out.println("通过");
                    results.add("✅ 测试1通过 - 创建模板成功, ID: " + template.getId());
                    passed++;
                } else {
                    System.out.println("失败");
                    results.add("❌ 测试1失败 - 创建模板返回空");
                    failed++;
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试1失败 - " + e.getMessage());
                failed++;
            }

            // 测试2: 重复提交拦截
            System.out.print("测试 2/8: 重复提交拦截... ");
            try {
                CreateTemplateRequest request = createValidRequest("API-TEST-001", "重复模板");
                templateService.createTemplate(request);
                System.out.println("失败 - 未抛出异常");
                results.add("❌ 测试2失败 - 未拦截重复编码");
                failed++;
            } catch (BusinessException e) {
                System.out.println("通过");
                results.add("✅ 测试2通过 - 重复编码拦截成功: " + e.getMessage());
                passed++;
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试2失败 - " + e.getMessage());
                failed++;
            }

            // 测试3: 空步骤拦截
            System.out.print("测试 3/8: 空步骤拦截... ");
            try {
                CreateTemplateRequest request = new CreateTemplateRequest();
                request.setTemplateCode("API-TEST-EMPTY");
                request.setTemplateName("空步骤模板");
                request.setCreatedBy("tester");
                request.setSteps(new ArrayList<>());
                
                templateService.createTemplate(request);
                System.out.println("失败 - 未抛出异常");
                results.add("❌ 测试3失败 - 未拦截空步骤");
                failed++;
            } catch (BusinessException e) {
                System.out.println("通过");
                results.add("✅ 测试3通过 - 空步骤拦截成功: " + e.getMessage());
                passed++;
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试3失败 - " + e.getMessage());
                failed++;
            }

            // 测试4: 模板校验功能
            System.out.print("测试 4/8: 模板校验功能... ");
            try {
                CreateTemplateRequest request = createValidRequest("API-TEST-VALIDATE", "待校验模板");
                TransactionTemplate template = templateService.createTemplate(request);
                template = templateService.validateTemplate(template.getId());
                
                if (TransactionStatus.VALIDATED.equals(template.getStatus())) {
                    System.out.println("通过");
                    results.add("✅ 测试4通过 - 模板校验成功, 状态: " + template.getStatus());
                    passed++;
                } else {
                    System.out.println("失败 - 状态未更新");
                    results.add("❌ 测试4失败 - 状态未正确更新");
                    failed++;
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试4失败 - " + e.getMessage());
                failed++;
            }

            // 测试5: 非法状态跳转拦截
            System.out.print("测试 5/8: 非法状态跳转拦截... ");
            try {
                CreateTemplateRequest request = createValidRequest("API-TEST-TRANSITION", "状态跳转测试");
                TransactionTemplate template = templateService.createTemplate(request);
                template = templateService.validateTemplate(template.getId());
                templateService.updateStatus(template.getId(), TransactionStatus.RUNNING);
                
                System.out.println("失败 - 未抛出异常");
                results.add("❌ 测试5失败 - 未拦截非法跳转");
                failed++;
            } catch (BusinessException e) {
                System.out.println("通过");
                results.add("✅ 测试5通过 - 非法跳转拦截成功: " + e.getMessage());
                passed++;
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试5失败 - " + e.getMessage());
                failed++;
            }

            // 测试6: 合法状态流转
            System.out.print("测试 6/8: 合法状态流转... ");
            try {
                CreateTemplateRequest request = createValidRequest("API-TEST-VALID", "合法状态测试");
                TransactionTemplate template = templateService.createTemplate(request);
                template = templateService.validateTemplate(template.getId());
                template = templateService.updateStatus(template.getId(), TransactionStatus.PENDING);
                
                if (TransactionStatus.PENDING.equals(template.getStatus())) {
                    System.out.println("通过");
                    results.add("✅ 测试6通过 - 状态流转成功: VALIDATED -> PENDING");
                    passed++;
                } else {
                    System.out.println("失败 - 状态未更新");
                    results.add("❌ 测试6失败 - 状态未正确更新");
                    failed++;
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试6失败 - " + e.getMessage());
                failed++;
            }

            // 测试7: 创建执行批次
            System.out.print("测试 7/8: 创建执行批次... ");
            try {
                CreateTemplateRequest request = createValidRequest("API-TEST-BATCH", "批次测试模板");
                TransactionTemplate template = templateService.createTemplate(request);
                template = templateService.validateTemplate(template.getId());
                template = templateService.updateStatus(template.getId(), TransactionStatus.PENDING);
                
                ExecutionBatch batch = batchService.createBatch(template.getId(), "tester");
                if (batch != null && batch.getId() != null && TransactionStatus.PENDING.equals(batch.getStatus())) {
                    System.out.println("通过");
                    results.add("✅ 测试7通过 - 创建批次成功, ID: " + batch.getId());
                    passed++;
                } else {
                    System.out.println("失败");
                    results.add("❌ 测试7失败 - 批次创建异常");
                    failed++;
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试7失败 - " + e.getMessage());
                failed++;
            }

            // 测试8: 撤销模板功能
            System.out.print("测试 8/8: 撤销模板功能... ");
            try {
                CreateTemplateRequest request = createValidRequest("API-TEST-CANCEL", "待撤销模板");
                TransactionTemplate template = templateService.createTemplate(request);
                template = templateService.cancelTemplate(template.getId());
                
                if (TransactionStatus.CANCELLED.equals(template.getStatus())) {
                    System.out.println("通过");
                    results.add("✅ 测试8通过 - 模板撤销成功");
                    passed++;
                } else {
                    System.out.println("失败 - 状态未更新");
                    results.add("❌ 测试8失败 - 状态未正确更新");
                    failed++;
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试8失败 - " + e.getMessage());
                failed++;
            }

            // 输出结果汇总
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
            System.out.println();

            if (failed == 0) {
                System.out.println("✅ 所有自检测试通过!");
                System.out.println();
                System.out.println("下一步操作：");
                System.out.println("  启动完整服务: ./mvnw spring-boot:run");
                System.out.println("  访问 H2 控制台: http://localhost:8080/h2-console");
                System.out.println();
                System.exit(0);
            } else {
                System.out.println("❌ 部分测试失败，请检查代码逻辑");
                System.exit(1);
            }
        };
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
}
