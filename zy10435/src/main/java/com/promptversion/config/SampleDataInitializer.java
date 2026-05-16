package com.promptversion.config;

import com.promptversion.entity.*;
import com.promptversion.enums.*;
import com.promptversion.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
public class SampleDataInitializer implements CommandLineRunner {

    @Autowired
    private PromptTemplateRepository templateRepository;

    @Autowired
    private TemplateVersionRepository versionRepository;

    @Autowired
    private HitRecordRepository hitRecordRepository;

    @Override
    public void run(String... args) throws Exception {
        if (templateRepository.count() > 0) {
            return;
        }

        PromptTemplate template1 = new PromptTemplate();
        template1.setTemplateName("聊天提示词");
        template1.setDescription("用于通用对话场景的提示词模板");
        template1.setCreatedBy("admin");
        template1.setCreatedAt(LocalDateTime.now());
        template1.setUpdatedAt(LocalDateTime.now());
        template1.setDeleted(false);
        templateRepository.save(template1);

        PromptTemplate template2 = new PromptTemplate();
        template2.setTemplateName("代码生成提示词");
        template2.setDescription("用于代码生成场景的提示词模板");
        template2.setCreatedBy("admin");
        template2.setCreatedAt(LocalDateTime.now());
        template2.setUpdatedAt(LocalDateTime.now());
        template2.setDeleted(false);
        templateRepository.save(template2);

        TemplateVersion v1 = new TemplateVersion();
        v1.setTemplateId(template1.getId());
        v1.setVersionNumber("v1.0.0");
        v1.setContent("你是一个乐于助人的AI助手，请用友好的语气回答用户的问题。");
        v1.setTrafficPercentage(new BigDecimal("30"));
        v1.setPublishedBy("alice");
        v1.setStatus(VersionStatus.ACTIVE);
        v1.setPublishedAt(LocalDateTime.now().minusDays(7));
        v1.setActivatedAt(LocalDateTime.now().minusDays(5));
        v1.setCreatedAt(LocalDateTime.now().minusDays(10));
        v1.setUpdatedAt(LocalDateTime.now().minusDays(5));
        v1.setRemark("初始版本，基础对话能力");
        versionRepository.save(v1);

        TemplateVersion v2 = new TemplateVersion();
        v2.setTemplateId(template1.getId());
        v2.setVersionNumber("v1.1.0");
        v2.setContent("你是一个专业的AI助手，回答要详细且有条理，请分点回答。");
        v2.setTrafficPercentage(new BigDecimal("70"));
        v2.setPublishedBy("bob");
        v2.setStatus(VersionStatus.ACTIVE);
        v2.setPublishedAt(LocalDateTime.now().minusDays(3));
        v2.setActivatedAt(LocalDateTime.now().minusDays(2));
        v2.setCreatedAt(LocalDateTime.now().minusDays(5));
        v2.setUpdatedAt(LocalDateTime.now().minusDays(2));
        v2.setRemark("优化回答格式，增加分点输出");
        versionRepository.save(v2);

        TemplateVersion v3 = new TemplateVersion();
        v3.setTemplateId(template1.getId());
        v3.setVersionNumber("v0.9.0");
        v3.setContent("你是一个AI助手，请回答用户问题。");
        v3.setTrafficPercentage(BigDecimal.ZERO);
        v3.setPublishedBy("alice");
        v3.setStatus(VersionStatus.ROLLED_BACK);
        v3.setPublishedAt(LocalDateTime.now().minusDays(15));
        v3.setActivatedAt(LocalDateTime.now().minusDays(12));
        v3.setRolledBackAt(LocalDateTime.now().minusDays(10));
        v3.setCreatedAt(LocalDateTime.now().minusDays(20));
        v3.setUpdatedAt(LocalDateTime.now().minusDays(10));
        v3.setRemark("初始测试版本，效果不佳已回滚");
        versionRepository.save(v3);

        TemplateVersion codeV1 = new TemplateVersion();
        codeV1.setTemplateId(template2.getId());
        codeV1.setVersionNumber("v1.0.0");
        codeV1.setContent("你是一个资深程序员，请生成高质量的代码并添加注释说明。");
        codeV1.setTrafficPercentage(new BigDecimal("100"));
        codeV1.setPublishedBy("charlie");
        codeV1.setStatus(VersionStatus.ACTIVE);
        codeV1.setPublishedAt(LocalDateTime.now().minusDays(2));
        codeV1.setActivatedAt(LocalDateTime.now().minusDays(1));
        codeV1.setCreatedAt(LocalDateTime.now().minusDays(4));
        codeV1.setUpdatedAt(LocalDateTime.now().minusDays(1));
        codeV1.setRemark("代码生成初始版本");
        versionRepository.save(codeV1);

        for (int i = 0; i < 20; i++) {
            HitRecord hit = new HitRecord();
            hit.setTemplateId(template1.getId());
            hit.setVersionId(i % 2 == 0 ? v1.getId() : v2.getId());
            hit.setRequestId("req_" + System.currentTimeMillis() + "_" + i);
            hit.setUserId("user_" + (i % 5));
            hit.setModelName("gpt-4");
            hit.setHitReason(i % 2 == 0 ? "流量分配-30%" : "流量分配-70%");
            hit.setHitTime(LocalDateTime.now().minusMinutes(i * 30));
            hit.setLatencyMs(100L + i * 10);
            hitRecordRepository.save(hit);
        }

        System.out.println("========================================");
        System.out.println("样例数据初始化完成!");
        System.out.println("模板数量: " + templateRepository.count());
        System.out.println("版本数量: " + versionRepository.count());
        System.out.println("命中记录数量: " + hitRecordRepository.count());
        System.out.println("H2控制台: http://localhost:8080/h2-console");
        System.out.println("========================================");
    }
}