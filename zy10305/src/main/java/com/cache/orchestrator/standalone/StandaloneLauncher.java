package com.cache.orchestrator.standalone;

import java.io.*;
import java.lang.reflect.Method;
import java.net.*;
import java.util.*;
import java.util.jar.*;

public class StandaloneLauncher {
    public static void main(String[] args) throws Exception {
        System.out.println("========================================");
        System.out.println("  分布式缓存失效编排 API - 独立启动器");
        System.out.println("========================================");
        System.out.println();

        File baseDir = new File(System.getProperty("user.dir"));
        File targetClasses = new File(baseDir, "target/classes");
        
        if (!targetClasses.exists()) {
            System.out.println(" [错误] 找不到 target/classes 目录!");
            System.out.println("  请先编译项目:");
            System.out.println("    方式1: mvn compile -DskipTests");
            System.out.println("    方式2: 在 IDE 中编译项目");
            System.exit(1);
        }
        
        System.out.println(" [1/5] 准备类路径...");
        
        List<URL> urls = new ArrayList<>();
        urls.add(targetClasses.toURI().toURL());
        
        System.out.println("   - 添加: target/classes");
        
        File mavenRepo = new File(System.getProperty("user.home"), ".m2/repository");
        
        String[][] dependencies = {
            {"org.springframework.boot/spring-boot-starter-web/2.7.18", "spring-boot-starter-web-2.7.18.jar"},
            {"org.springframework.boot/spring-boot-starter-data-jpa/2.7.18", "spring-boot-starter-data-jpa-2.7.18.jar"},
            {"org.springframework.boot/spring-boot-starter-validation/2.7.18", "spring-boot-starter-validation-2.7.18.jar"},
            {"com.h2database/h2/2.1.214", "h2-2.1.214.jar"},
            {"org.projectlombok/lombok/1.18.30", "lombok-1.18.30.jar"},
            {"org.springframework.boot/spring-boot/2.7.18", "spring-boot-2.7.18.jar"},
            {"org.springframework.boot/spring-boot-autoconfigure/2.7.18", "spring-boot-autoconfigure-2.7.18.jar"},
            {"org.springframework/spring-context/5.3.27", "spring-context-5.3.27.jar"},
            {"org.springframework/spring-core/5.3.27", "spring-core-5.3.27.jar"},
            {"org.springframework/spring-beans/5.3.27", "spring-beans-5.3.27.jar"},
            {"org.springframework/spring-web/5.3.27", "spring-web-5.3.27.jar"},
            {"org.springframework/spring-webmvc/5.3.27", "spring-webmvc-5.3.27.jar"},
            {"com.fasterxml.jackson.core/jackson-databind/2.13.5", "jackson-databind-2.13.5.jar"},
            {"org.slf4j/slf4j-api/1.7.36", "slf4j-api-1.7.36.jar"},
            {"ch.qos.logback/logback-classic/1.2.11", "logback-classic-1.2.11.jar"},
            {"org.apache.tomcat.embed/tomcat-embed-core/9.0.76", "tomcat-embed-core-9.0.76.jar"},
        };
        
        int found = 0;
        int missing = 0;
        for (String[] dep : dependencies) {
            File jarFile = new File(mavenRepo, dep[0].replace('/', File.separatorChar) + File.separator + dep[1]);
            if (jarFile.exists()) {
                urls.add(jarFile.toURI().toURL());
                found++;
            } else {
                missing++;
            }
        }
        
        System.out.println("   - 找到 " + found + " 个依赖 jar, 缺失 " + missing + " 个");
        
        if (missing > 0) {
            System.out.println();
            System.out.println(" [警告] 部分依赖缺失, 尝试备选启动方式...");
            System.out.println();
            launchWithAlternative(targetClasses);
            return;
        }
        
        System.out.println();
        System.out.println(" [2/5] 创建类加载器...");
        
        URLClassLoader classLoader = new URLClassLoader(urls.toArray(new URL[0]), Thread.currentThread().getContextClassLoader());
        
        System.out.println("   - 类加载器已创建, 共 " + urls.size() + " 个 URL");
        
        System.out.println();
        System.out.println(" [3/5] 加载主类...");
        
        Class<?> mainClass = classLoader.loadClass("com.cache.orchestrator.CacheInvalidationApplication");
        
        System.out.println("   - 主类加载成功: com.cache.orchestrator.CacheInvalidationApplication");
        
        System.out.println();
        System.out.println(" [4/5] 启动 Spring Boot 应用...");
        System.out.println();
        System.out.println("========================================");
        System.out.println();
        
        Thread.currentThread().setContextClassLoader(classLoader);
        
        Method mainMethod = mainClass.getMethod("main", String[].class);
        mainMethod.invoke(null, (Object) args);
    }
    
    private static void launchWithAlternative(File targetClasses) throws Exception {
        System.out.println("========================================");
        System.out.println("  备选启动方式 - 直接使用类文件");
        System.out.println("========================================");
        System.out.println();
        System.out.println("  正在使用目标类文件直接启动...");
        System.out.println();
        
        String javaHome = System.getProperty("java.home");
        String javaCmd = new File(new File(javaHome, "bin"), "java").getAbsolutePath();
        
        String classPath = buildClassPath(targetClasses);
        
        ProcessBuilder pb = new ProcessBuilder(
            javaCmd,
            "-cp", classPath,
            "com.cache.orchestrator.CacheInvalidationApplication"
        );
        
        pb.inheritIO();
        pb.directory(new File(System.getProperty("user.dir")));
        
        System.out.println("  启动命令已准备, 正在启动...");
        System.out.println();
        System.out.println("========================================");
        System.out.println();
        
        Process process = pb.start();
        process.waitFor();
    }
    
    private static String buildClassPath(File targetClasses) throws Exception {
        StringBuilder cp = new StringBuilder();
        cp.append(targetClasses.getAbsolutePath());
        
        File mavenRepo = new File(System.getProperty("user.home"), ".m2/repository");
        
        String[] commonPaths = {
            "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar",
            "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar",
            "org/springframework/spring-context/5.3.27/spring-context-5.3.27.jar",
            "org/springframework/spring-core/5.3.27/spring-core-5.3.27.jar",
            "org/springframework/spring-beans/5.3.27/spring-beans-5.3.27.jar",
            "org/springframework/spring-web/5.3.27/spring-web-5.3.27.jar",
            "org/springframework/spring-webmvc/5.3.27/spring-webmvc-5.3.27.jar",
            "org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar",
            "org/springframework/boot/spring-boot-starter-data-jpa/2.7.18/spring-boot-starter-data-jpa-2.7.18.jar",
            "com/h2database/h2/2.1.214/h2-2.1.214.jar",
        };
        
        for (String path : commonPaths) {
            File jar = new File(mavenRepo, path);
            if (jar.exists()) {
                cp.append(File.pathSeparator).append(jar.getAbsolutePath());
            }
        }
        
        return cp.toString();
    }
}
