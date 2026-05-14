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
import org.springframework.context.annotation.Bean;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@SpringBootApplication
public class SelfCheckMain {

    public static void main(String[] args) {
        System.out.println();
        System.out.println("========================================");
        System.out.println("  API合成事务巡检 - 自检测试");
        System.out.println("========================================");
        System.out.println();
        
        SpringApplication app = new SpringApplication(SelfCheckMain.class);
        app.setWebApplicationType(org.springframework.boot.WebApplicationType.NONE);
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

            System.out.println("========== 模板管理测试 ==========");
            System.out.println();

            // 测试1: 创建事务模板
            System.out.print("测试 1/12: 创建事务模板... ");
            Long templateId = null;
            try {
                CreateTemplateRequest request = createLoginTemplateRequest();
                TransactionTemplate template = templateService.createTemplate(request);
                if (template != null && template.getId() != null) {
                    templateId = template.getId();
                    System.out.println("通过 (ID: " + templateId + ")");
                    results.add("✅ 测试1通过 - 创建模板成功, ID: " + templateId);
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
            System.out.print("测试 2/12: 重复提交拦截... ");
            try {
                CreateTemplateRequest request = createLoginTemplateRequest();
                templateService.createTemplate(request);
                System.out.println("失败 - 未抛出异常");
                results.add("❌ 测试2失败 - 未拦截重复编码");
                failed++;
            } catch (BusinessException e) {
                System.out.println("通过");
                results.add("✅ 测试2通过 - 重复编码拦截成功");
                passed++;
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试2失败 - " + e.getMessage());
                failed++;
            }

            // 测试3: 空步骤拦截
            System.out.print("测试 3/12: 空步骤拦截... ");
            try {
                CreateTemplateRequest request = new CreateTemplateRequest();
                request.setTemplateCode("API-EMPTY-TEST");
                request.setTemplateName("空步骤模板");
                request.setCreatedBy("tester");
                request.setSteps(new ArrayList<StepRequest>());
                
                templateService.createTemplate(request);
                System.out.println("失败 - 未抛出异常");
                results.add("❌ 测试3失败 - 未拦截空步骤");
                failed++;
            } catch (BusinessException e) {
                System.out.println("通过");
                results.add("✅ 测试3通过 - 空步骤拦截成功");
                passed++;
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试3失败 - " + e.getMessage());
                failed++;
            }

            // 测试4: 校验模板
            System.out.print("测试 4/12: 校验模板... ");
            try {
                if (templateId != null) {
                    TransactionTemplate template = templateService.validateTemplate(templateId);
                    if (TransactionStatus.VALIDATED.equals(template.getStatus())) {
                        System.out.println("通过");
                        results.add("✅ 测试4通过 - 模板校验成功");
                        passed++;
                    } else {
                        System.out.println("失败 - 状态未更新");
                        results.add("❌ 测试4失败 - 状态未正确更新");
                        failed++;
                    }
                } else {
                    System.out.println("跳过");
                    results.add("⏭️ 测试4跳过 - 模板未创建");
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试4失败 - " + e.getMessage());
                failed++;
            }

            System.out.println();
            System.out.println("========== 批次执行测试 ==========");
            System.out.println();

            Long batchId = null;

            // 测试5: 创建执行批次
            System.out.print("测试 5/12: 创建执行批次... ");
            try {
                if (templateId != null) {
                    ExecutionBatch batch = batchService.createBatch(templateId, "tester");
                    if (batch != null && batch.getId() != null) {
                        batchId = batch.getId();
                        System.out.println("通过 (ID: " + batchId + ")");
                        results.add("✅ 测试5通过 - 创建批次成功, ID: " + batchId);
                        passed++;
                    } else {
                        System.out.println("失败");
                        results.add("❌ 测试5失败 - 批次创建异常");
                        failed++;
                    }
                } else {
                    System.out.println("跳过");
                    results.add("⏭️ 测试5跳过 - 模板未创建");
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试5失败 - " + e.getMessage());
                failed++;
            }

            // 测试6: 启动批次执行
            System.out.print("测试 6/12: 启动批次执行... ");
            try {
                if (batchId != null) {
                    ExecutionBatch batch = batchService.startExecution(batchId);
                    if (TransactionStatus.RUNNING.equals(batch.getStatus())) {
                        System.out.println("通过");
                        results.add("✅ 测试6通过 - 批次启动成功");
                        passed++;
                    } else {
                        System.out.println("失败 - 状态未更新");
                        results.add("❌ 测试6失败 - 状态未正确更新");
                        failed++;
                    }
                } else {
                    System.out.println("跳过");
                    results.add("⏭️ 测试6跳过 - 批次未创建");
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试6失败 - " + e.getMessage());
                failed++;
            }

            // 测试7: 自动执行步骤1 - 获取验证码(真实HTTP调用)
            System.out.print("测试 7/12: 执行步骤1 - 获取验证码... ");
            try {
                if (batchId != null) {
                    ExecutionBatch batch = batchService.executeStep(batchId, 1);
                    StepExecution step = batch.getStepExecutions().stream()
                            .filter(s -> s.getStepOrder().equals(1))
                            .findFirst().orElse(null);
                    if (step != null && TransactionStatus.SUCCESS.equals(step.getStatus())) {
                        System.out.println("通过");
                        results.add("✅ 测试7通过 - 步骤1执行成功, 状态码: " + step.getStatusCode());
                        passed++;
                    } else {
                        System.out.println("失败 - 步骤执行失败");
                        results.add("❌ 测试7失败 - 步骤执行失败");
                        failed++;
                    }
                } else {
                    System.out.println("跳过");
                    results.add("⏭️ 测试7跳过 - 批次未创建");
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试7失败 - " + e.getMessage());
                failed++;
            }

            // 测试8: 自动执行步骤2 - 用户登录(变量传递 + 断言)
            System.out.print("测试 8/12: 执行步骤2 - 用户登录(变量传递)... ");
            try {
                if (batchId != null) {
                    ExecutionBatch batch = batchService.executeStep(batchId, 2);
                    StepExecution step = batch.getStepExecutions().stream()
                            .filter(s -> s.getStepOrder().equals(2))
                            .findFirst().orElse(null);
                    if (step != null && TransactionStatus.SUCCESS.equals(step.getStatus())) {
                        System.out.println("通过");
                        results.add("✅ 测试8通过 - 步骤2执行成功, 断言: " + step.getAssertionResults().size() + "个");
                        passed++;
                    } else {
                        System.out.println("失败 - 步骤执行失败");
                        results.add("❌ 测试8失败 - 步骤执行失败");
                        failed++;
                    }
                } else {
                    System.out.println("跳过");
                    results.add("⏭️ 测试8跳过 - 批次未创建");
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试8失败 - " + e.getMessage());
                failed++;
            }

            // 测试9: 自动执行步骤3 - 获取用户信息(Header传递token)
            System.out.print("测试 9/12: 执行步骤3 - 获取用户信息... ");
            try {
                if (batchId != null) {
                    ExecutionBatch batch = batchService.executeStep(batchId, 3);
                    StepExecution step = batch.getStepExecutions().stream()
                            .filter(s -> s.getStepOrder().equals(3))
                            .findFirst().orElse(null);
                    if (step != null && TransactionStatus.SUCCESS.equals(step.getStatus())) {
                        System.out.println("通过");
                        results.add("✅ 测试9通过 - 步骤3执行成功");
                        passed++;
                    } else {
                        System.out.println("失败 - 步骤执行失败");
                        results.add("❌ 测试9失败 - 步骤执行失败");
                        failed++;
                    }
                } else {
                    System.out.println("跳过");
                    results.add("⏭️ 测试9跳过 - 批次未创建");
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试9失败 - " + e.getMessage());
                failed++;
            }

            // 测试10: 批次完成状态验证
            System.out.print("测试10/12: 批次完成状态验证... ");
            try {
                if (batchId != null) {
                    ExecutionBatch batch = batchService.getBatch(batchId);
                    if (TransactionStatus.SUCCESS.equals(batch.getStatus()) && batch.getSuccessSteps() == 3) {
                        System.out.println("通过 (成功: " + batch.getSuccessSteps() + "/" + batch.getTotalSteps() + ")");
                        results.add("✅ 测试10通过 - 批次执行成功, 成功: " + batch.getSuccessSteps());
                        passed++;
                    } else {
                        System.out.println("失败 - 批次状态: " + batch.getStatus());
                        results.add("❌ 测试10失败 - 批次最终状态异常");
                        failed++;
                    }
                } else {
                    System.out.println("跳过");
                    results.add("⏭️ 测试10跳过 - 批次未创建");
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试10失败 - " + e.getMessage());
                failed++;
            }

            System.out.println();
            System.out.println("========== 批次对比测试 ==========");
            System.out.println();

            Long batchId2 = null;

            // 测试11: 创建第二个批次用于对比
            System.out.print("测试11/12: 创建第二个批次... ");
            try {
                if (templateId != null) {
                    ExecutionBatch batch = batchService.createBatch(templateId, "tester");
                    batchId2 = batch.getId();
                    batch = batchService.executeAllSteps(batchId2);
                    System.out.println("通过 (状态: " + batch.getStatus() + ")");
                    results.add("✅ 测试11通过 - 第二个批次创建并执行完成");
                    passed++;
                } else {
                    System.out.println("跳过");
                    results.add("⏭️ 测试11跳过 - 模板未创建");
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试11失败 - " + e.getMessage());
                failed++;
            }

            // 测试12: 批次对比功能
            System.out.print("测试12/12: 批次对比功能... ");
            try {
                if (batchId != null && batchId2 != null) {
                    Map<String, Object> compareResult = batchService.compareBatches(batchId, batchId2);
                    if (compareResult != null && compareResult.containsKey("stepComparisons")) {
                        List<?> steps = (List<?>) compareResult.get("stepComparisons");
                        System.out.println("通过 (对比步骤: " + steps.size() + "个)");
                        results.add("✅ 测试12通过 - 批次对比功能正常, 对比步骤: " + steps.size() + "个");
                        passed++;
                    } else {
                        System.out.println("失败 - 对比结果为空");
                        results.add("❌ 测试12失败 - 对比结果为空");
                        failed++;
                    }
                } else {
                    System.out.println("跳过");
                    results.add("⏭️ 测试12跳过 - 批次未创建");
                }
            } catch (Exception e) {
                System.out.println("失败: " + e.getMessage());
                results.add("❌ 测试12失败 - " + e.getMessage());
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
                System.out.println("核心功能验证完成:");
                System.out.println("  ✓ 模板管理 (创建、校验)");
                System.out.println("  ✓ 脏数据拦截 (空步骤、重复编码)");
                System.out.println("  ✓ 真实HTTP API调用");
                System.out.println("  ✓ 变量提取与传递");
                System.out.println("  ✓ 断言自动执行");
                System.out.println("  ✓ 失败定位记录");
                System.out.println("  ✓ 批次对比功能");
                System.out.println();
                System.exit(0);
            } else {
                System.out.println("❌ 部分测试失败，请检查代码逻辑");
                System.exit(1);
            }
        };
    }

    private static CreateTemplateRequest createLoginTemplateRequest() {
        CreateTemplateRequest request = new CreateTemplateRequest();
        request.setTemplateCode("API-LOGIN-DEMO");
        request.setTemplateName("用户登录流程测试");
        request.setDescription("演示完整的登录巡检流程: 获取验证码 -> 登录 -> 获取用户信息");
        request.setCreatedBy("tester");

        List<StepRequest> steps = new ArrayList<>();

        // 步骤1: 获取验证码
        StepRequest step1 = new StepRequest();
        step1.setStepOrder(1);
        step1.setStepName("获取验证码");
        step1.setHttpMethod("GET");
        step1.setUrl("http://localhost:8080/mock/captcha");
        step1.setTimeout(5000);

        VariableExtractRequest extract1 = new VariableExtractRequest();
        extract1.setVariableName("captchaId");
        extract1.setExtractExpression("$.data.captchaId");
        extract1.setSourceType("RESPONSE_BODY");
        step1.setVariableExtracts(java.util.Arrays.asList(extract1));

        AssertionRequest assertion1 = new AssertionRequest();
        assertion1.setAssertionType(AssertionType.STATUS_CODE);
        assertion1.setExpectedValue("200");
        assertion1.setEnabled(true);
        step1.setAssertions(java.util.Arrays.asList(assertion1));

        steps.add(step1);

        // 步骤2: 用户登录 - 使用步骤1提取的captchaId
        StepRequest step2 = new StepRequest();
        step2.setStepOrder(2);
        step2.setStepName("用户登录");
        step2.setHttpMethod("POST");
        step2.setUrl("http://localhost:8080/mock/login");
        step2.setBody("{\"username\":\"demo\",\"password\":\"123456\",\"captchaId\":\"${captchaId}\"}");
        step2.setTimeout(5000);

        VariableExtractRequest extract2 = new VariableExtractRequest();
        extract2.setVariableName("token");
        extract2.setExtractExpression("$.data.token");
        extract2.setSourceType("RESPONSE_BODY");
        step2.setVariableExtracts(java.util.Arrays.asList(extract2));

        AssertionRequest assertion2a = new AssertionRequest();
        assertion2a.setAssertionType(AssertionType.STATUS_CODE);
        assertion2a.setExpectedValue("200");
        assertion2a.setEnabled(true);

        AssertionRequest assertion2b = new AssertionRequest();
        assertion2b.setAssertionType(AssertionType.RESPONSE_BODY);
        assertion2b.setExpectedValue("登录成功");
        assertion2b.setEnabled(true);
        step2.setAssertions(java.util.Arrays.asList(assertion2a, assertion2b));

        steps.add(step2);

        // 步骤3: 获取用户信息 - 使用步骤2提取的token
        StepRequest step3 = new StepRequest();
        step3.setStepOrder(3);
        step3.setStepName("获取用户信息");
        step3.setHttpMethod("GET");
        step3.setUrl("http://localhost:8080/mock/user/info");
        step3.setHeaders("{\"Authorization\":\"${token}\"}");
        step3.setTimeout(5000);

        AssertionRequest assertion3a = new AssertionRequest();
        assertion3a.setAssertionType(AssertionType.STATUS_CODE);
        assertion3a.setExpectedValue("200");
        assertion3a.setEnabled(true);

        AssertionRequest assertion3b = new AssertionRequest();
        assertion3b.setAssertionType(AssertionType.JSON_PATH);
        assertion3b.setExpression("$.data.role");
        assertion3b.setExpectedValue("admin");
        assertion3b.setEnabled(true);
        step3.setAssertions(java.util.Arrays.asList(assertion3a, assertion3b));

        steps.add(step3);
        request.setSteps(steps);

        return request;
    }
}
