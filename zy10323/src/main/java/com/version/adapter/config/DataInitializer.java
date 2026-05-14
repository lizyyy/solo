package com.version.adapter.config;

import com.version.adapter.entity.*;
import com.version.adapter.entity.enums.VersionStatus;
import com.version.adapter.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final ClientVersionRepository clientVersionRepository;
    private final ResponseTemplateRepository responseTemplateRepository;
    private final VersionTemplateMappingRepository versionTemplateMappingRepository;
    private final FieldMappingRepository fieldMappingRepository;
    private final DefaultValueRepository defaultValueRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (clientVersionRepository.count() == 0) {
            log.info("初始化演示数据...");
            initializeDemoData();
        } else {
            log.info("数据库已有数据，跳过初始化");
        }
    }

    private void initializeDemoData() {
        ClientVersion v1 = ClientVersion.builder()
                .versionNumber("v1.0.0")
                .clientType("mobile")
                .description("移动端 v1.0.0 版本")
                .status(VersionStatus.ACTIVE)
                .isDeprecated(false)
                .createdBy("system")
                .createdAt(LocalDateTime.now())
                .build();
        v1 = clientVersionRepository.save(v1);
        log.info("创建客户端版本: {}", v1.getVersionNumber());

        ClientVersion v2 = ClientVersion.builder()
                .versionNumber("v2.0.0")
                .clientType("mobile")
                .description("移动端 v2.0.0 版本")
                .status(VersionStatus.ACTIVE)
                .isDeprecated(false)
                .createdBy("system")
                .createdAt(LocalDateTime.now())
                .build();
        v2 = clientVersionRepository.save(v2);
        log.info("创建客户端版本: {}", v2.getVersionNumber());

        ResponseTemplate template1 = ResponseTemplate.builder()
                .templateName("user-info-api-v1")
                .apiEndpoint("/api/user/info")
                .httpMethod("GET")
                .description("用户信息接口 v1 模板")
                .templateJson("{}")
                .isActive(true)
                .createdBy("system")
                .createdAt(LocalDateTime.now())
                .build();
        template1 = responseTemplateRepository.save(template1);
        log.info("创建响应模板: {}", template1.getTemplateName());

        VersionTemplateMapping mapping1 = VersionTemplateMapping.builder()
                .clientVersionId(v1.getId())
                .templateId(template1.getId())
                .isActive(true)
                .createdBy("system")
                .createdAt(LocalDateTime.now())
                .build();
        versionTemplateMappingRepository.save(mapping1);

        VersionTemplateMapping mapping2 = VersionTemplateMapping.builder()
                .clientVersionId(v2.getId())
                .templateId(template1.getId())
                .isActive(true)
                .createdBy("system")
                .createdAt(LocalDateTime.now())
                .build();
        versionTemplateMappingRepository.save(mapping2);
        log.info("创建版本模板映射关系");

        FieldMapping field1 = FieldMapping.builder()
                .templateId(template1.getId())
                .sourceField("id")
                .targetField("userId")
                .fieldType("number")
                .sortOrder(1)
                .isRequired(true)
                .isActive(true)
                .createdBy("system")
                .createdAt(LocalDateTime.now())
                .build();
        field1 = fieldMappingRepository.save(field1);

        FieldMapping field2 = FieldMapping.builder()
                .templateId(template1.getId())
                .sourceField("name")
                .targetField("userName")
                .fieldType("string")
                .sortOrder(2)
                .isRequired(true)
                .isActive(true)
                .createdBy("system")
                .createdAt(LocalDateTime.now())
                .build();
        fieldMappingRepository.save(field2);

        FieldMapping field3 = FieldMapping.builder()
                .templateId(template1.getId())
                .sourceField("email")
                .targetField("email")
                .fieldType("string")
                .sortOrder(3)
                .isRequired(false)
                .isActive(true)
                .createdBy("system")
                .createdAt(LocalDateTime.now())
                .build();
        field3 = fieldMappingRepository.save(field3);
        log.info("创建字段映射配置");

        DefaultValue defaultValue3 = DefaultValue.builder()
                .fieldMappingId(field3.getId())
                .defaultValue("unknown@example.com")
                .valueType("string")
                .description("邮箱默认值")
                .isActive(true)
                .createdBy("system")
                .createdAt(LocalDateTime.now())
                .build();
        defaultValueRepository.save(defaultValue3);
        log.info("创建默认值配置");

        log.info("演示数据初始化完成！");
        log.info("测试适配接口: POST /api/versions/adapt");
        log.info("示例请求: {\"clientVersion\":\"v1.0.0\",\"apiEndpoint\":\"/api/user/info\",\"httpMethod\":\"GET\",\"originalResponse\":{\"id\":123,\"name\":\"张三\"}}");
    }
}
