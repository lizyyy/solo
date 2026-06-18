package com.xxx.financial;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InterestReviewApplication {

    public static void main(String[] args) {
        boolean runAsServer = args.length == 0;
        for (String arg : args) {
            if ("server".equals(arg) || "--server".equals(arg)) {
                runAsServer = true;
                break;
            }
        }
        if (!runAsServer) {
            com.xxx.financial.cli.InterestReviewCli.main(args);
            return;
        }
        SpringApplication.run(InterestReviewApplication.class, args);
        System.out.println("\n============================================");
        System.out.println("  企业票据贴现利息复核服务已启动");
        System.out.println("  API 端口: 8080");
        System.out.println("  接口文档: GET /api/review/");
        System.out.println("============================================\n");
    }
}
