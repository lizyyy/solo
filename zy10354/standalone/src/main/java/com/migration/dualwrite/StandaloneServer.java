package com.migration.dualwrite;

import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

/**
 * 零依赖嵌入式 HTTP 服务器
 * 使用 Java 8 内置 HttpServer
 * 无需 Spring Boot、无需 Maven、无需任何外部依赖
 */
public class StandaloneServer {

    public static final int PORT = 8080;
    public static final String DATA_DIR = "./data";

    public static void main(String[] args) throws Exception {
        // 确保数据目录存在
        new File(DATA_DIR).mkdirs();

        // 创建 HttpServer
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        
        // 注册路由
        server.createContext("/api/migration/tasks", new TaskHandler());
        server.createContext("/api/migration/tasks/", new TaskHandler());
        server.createContext("/actuator/health", new HealthHandler());
        
        // 使用线程池
        server.setExecutor(Executors.newFixedThreadPool(10));
        
        // 启动服务器
        server.start();
        
        System.out.println("========================================");
        System.out.println("  接口迁移双写比对 API - 独立版本");
        System.out.println("========================================");
        System.out.println("  Java 版本: " + System.getProperty("java.version"));
        System.out.println("  服务地址: http://localhost:" + PORT);
        System.out.println("  健康检查: http://localhost:" + PORT + "/actuator/health");
        System.out.println("  数据目录: " + new File(DATA_DIR).getAbsolutePath());
        System.out.println("========================================");
        System.out.println("  按 Ctrl+C 停止服务");
        System.out.println("========================================");
    }
}
