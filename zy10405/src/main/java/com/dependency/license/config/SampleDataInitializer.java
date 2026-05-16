package com.dependency.license.config;

import com.dependency.license.dto.*;
import com.dependency.license.model.ApprovalStatus;
import com.dependency.license.service.BatchService;
import com.dependency.license.service.PackageService;
import com.dependency.license.service.RepositoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;
import java.util.Arrays;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class SampleDataInitializer {
    private final PackageService packageService;
    private final RepositoryService repositoryService;
    private final BatchService batchService;

    @Bean
    public CommandLineRunner initSampleData() {
        return args -> {
            log.info("开始初始化样例数据...");

            CreatePackageRequest pkg1 = new CreatePackageRequest();
            pkg1.setName("Spring Framework");
            pkg1.setGroupId("org.springframework");
            pkg1.setArtifactId("spring-core");
            pkg1.setCurrentVersion("5.3.20");
            pkg1.setTargetVersion("6.1.0");
            pkg1.setDescription("Spring核心框架升级");
            pkg1.setCategory("framework");
            packageService.createPackage(pkg1);

            CreatePackageRequest pkg2 = new CreatePackageRequest();
            pkg2.setName("Jackson Databind");
            pkg2.setGroupId("com.fasterxml.jackson.core");
            pkg2.setArtifactId("jackson-databind");
            pkg2.setCurrentVersion("2.13.0");
            pkg2.setTargetVersion("2.15.2");
            pkg2.setDescription("JSON序列化库升级");
            pkg2.setCategory("library");
            packageService.createPackage(pkg2);

            CreateRepositoryRequest repo1 = new CreateRepositoryRequest();
            repo1.setName("user-service");
            repo1.setUrl("https://git.example.com/user-service");
            repo1.setOwner("平台部");
            repo1.setMaintainer("张三");
            repo1.setMaintainerEmail("zhangsan@example.com");
            repo1.setDepartment("技术平台部");
            repositoryService.createRepository(repo1);

            CreateRepositoryRequest repo2 = new CreateRepositoryRequest();
            repo2.setName("order-service");
            repo2.setUrl("https://git.example.com/order-service");
            repo2.setOwner("电商部");
            repo2.setMaintainer("李四");
            repo2.setMaintainerEmail("lisi@example.com");
            repo2.setDepartment("电商业务部");
            repositoryService.createRepository(repo2);

            CreateRepositoryRequest repo3 = new CreateRepositoryRequest();
            repo3.setName("payment-service");
            repo3.setUrl("https://git.example.com/payment-service");
            repo3.setOwner("支付部");
            repo3.setMaintainer("王五");
            repo3.setMaintainerEmail("wangwu@example.com");
            repo3.setDepartment("支付业务部");
            repositoryService.createRepository(repo3);

            CreateBatchRequest batch1 = new CreateBatchRequest();
            batch1.setName("Spring 6 升级批次");
            batch1.setDescription("全平台Spring Framework 6.1.0升级");
            batch1.setPackageId(1L);
            batch1.setPlannedDate(LocalDateTime.now().plusDays(7));
            batch1.setRiskAssessment("中等风险，需关注Jakarta EE迁移");
            batch1.setCreatedBy("系统管理员");
            batch1.setRepositoryIds(Arrays.asList(1L, 2L, 3L));
            batchService.createBatch(batch1);

            batchService.submitForApproval(3L);

            ApprovalRequest approval1 = new ApprovalRequest();
            approval1.setApproved(true);
            approval1.setApprover("张三");
            approval1.setComment("已完成代码适配，同意升级");
            approval1.setImpactAssessment("影响较小，已完成测试");
            batchService.approve(1L, approval1);

            ApprovalRequest approval2 = new ApprovalRequest();
            approval2.setApproved(true);
            approval2.setApprover("李四");
            approval2.setComment("已验证兼容性，同意升级");
            batchService.approve(2L, approval2);

            log.info("样例数据初始化完成！");
            log.info("访问 Swagger UI: http://localhost:8080/swagger-ui.html");
            log.info("访问 H2 控制台: http://localhost:8080/h2-console");
        };
    }
}