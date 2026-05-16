package com.package.repo.config;

import com.package.repo.model.dto.CreatePackageRequest;
import com.package.repo.service.PackageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Profile("!test")
@RequiredArgsConstructor
@Slf4j
public class SampleDataInitializer implements CommandLineRunner {

    private final PackageService packageService;

    @Override
    public void run(String... args) throws Exception {
        if (packageService.getAllPackages().isEmpty()) {
            log.info("初始化样例数据...");

            CreatePackageRequest pkg1 = new CreatePackageRequest();
            pkg1.setPackageName("com.example:core-utils");
            pkg1.setVersion("1.0.0");
            pkg1.setPublisher("zhang.san");
            pkg1.setDescription("核心工具库");
            pkg1.setDependencyProjects(List.of("order-service"));
            packageService.createPackage(pkg1);

            CreatePackageRequest pkg2 = new CreatePackageRequest();
            pkg2.setPackageName("com.example:payment-sdk");
            pkg2.setVersion("2.1.0");
            pkg2.setPublisher("li.si");
            pkg2.setDescription("支付SDK");
            pkg2.setDependencyProjects(List.of("order-service"));
            packageService.createPackage(pkg2);

            CreatePackageRequest pkg3 = new CreatePackageRequest();
            pkg3.setPackageName("com.example:common-web");
            pkg3.setVersion("1.5.0");
            pkg3.setPublisher("wang.wu");
            pkg3.setDescription("Web通用组件");
            pkg3.setDependencyProjects(List.of("order-service"));
            packageService.createPackage(pkg3);

            CreatePackageRequest pkg4 = new CreatePackageRequest();
            pkg4.setPackageName("com.example:framework-core");
            pkg4.setVersion("3.0.0");
            pkg4.setPublisher("zhao.liu");
            pkg4.setDescription("框架核心");
            pkg4.setDependencyProjects(List.of("order-service"));
            packageService.createPackage(pkg4);

            log.info("样例数据初始化完成");
        } else {
            log.info("数据库已有数据，跳过初始化");
        }
    }
}
