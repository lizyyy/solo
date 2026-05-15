package com.apidiff.config;

import com.apidiff.dto.ApiDiffRequest;
import com.apidiff.dto.StatusUpdateRequest;
import com.apidiff.entity.enums.ConfirmationStatus;
import com.apidiff.service.ApiDiffService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@Profile("!test")
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final ApiDiffService apiDiffService;

    @Override
    public void run(String... args) {
        log.info("Initializing sample data...");

        try {
            createSampleRecord1();
            createSampleRecord2();
            createSampleRecord3();
            log.info("Sample data initialization completed.");
        } catch (Exception e) {
            log.error("Failed to initialize sample data", e);
        }
    }

    private void createSampleRecord1() {
        ApiDiffRequest request = new ApiDiffRequest();
        request.setApiPath("/api/users/1");
        request.setHttpMethod("GET");
        request.setCreatedBy("system");

        Map<String, Object> responseA = new HashMap<>();
        responseA.put("id", 1);
        responseA.put("name", "张三");
        responseA.put("age", 25);
        responseA.put("email", "zhangsan@old.com");
        request.setResponseA(responseA);

        Map<String, Object> responseB = new HashMap<>();
        responseB.put("id", 1);
        responseB.put("name", "张三");
        responseB.put("age", 25);
        responseB.put("email", "zhangsan@new.com");
        responseB.put("phone", "13800138000");
        request.setResponseB(responseB);

        request.setVersionA("v1.0.0");
        request.setVersionB("v1.1.0");
        request.setStatusCodeA(200);
        request.setStatusCodeB(200);
        request.setResponseTimeA(100L);
        request.setResponseTimeB(120L);
        request.setTags("user-api,regression");

        var response = apiDiffService.createDiffRecord(request);

        StatusUpdateRequest updateRequest = new StatusUpdateRequest();
        updateRequest.setStatus(ConfirmationStatus.ANALYZING);
        updateRequest.setOperatedBy("tester");
        apiDiffService.updateStatus(response.getId(), updateRequest);
    }

    private void createSampleRecord2() {
        ApiDiffRequest request = new ApiDiffRequest();
        request.setApiPath("/api/orders/100");
        request.setHttpMethod("GET");
        request.setCreatedBy("system");

        Map<String, Object> responseA = new HashMap<>();
        responseA.put("orderId", 100);
        responseA.put("status", "PENDING");
        responseA.put("amount", 99.99);
        request.setResponseA(responseA);

        Map<String, Object> responseB = new HashMap<>();
        responseB.put("orderId", 100);
        responseB.put("status", "PROCESSING");
        responseB.put("amount", "99.99");
        responseB.put("items", new String[]{"item1", "item2"});
        request.setResponseB(responseB);

        request.setVersionA("v1.0.0");
        request.setVersionB("v1.1.0");
        request.setStatusCodeA(200);
        request.setStatusCodeB(200);
        request.setResponseTimeA(200L);
        request.setResponseTimeB(250L);
        request.setTags("order-api");

        var response = apiDiffService.createDiffRecord(request);

        StatusUpdateRequest updateRequest = new StatusUpdateRequest();
        updateRequest.setStatus(ConfirmationStatus.CONFIRMED_EXPECTED);
        updateRequest.setAttributionNote("状态字段设计变更，增加items字段");
        updateRequest.setOperatedBy("developer");
        apiDiffService.updateStatus(response.getId(), updateRequest);
    }

    private void createSampleRecord3() {
        ApiDiffRequest request = new ApiDiffRequest();
        request.setApiPath("/api/products/50");
        request.setHttpMethod("GET");
        request.setCreatedBy("system");

        Map<String, Object> responseA = new HashMap<>();
        responseA.put("productId", 50);
        responseA.put("name", "测试产品");
        responseA.put("price", 199.00);
        responseA.put("stock", 100);
        request.setResponseA(responseA);

        Map<String, Object> responseB = new HashMap<>();
        responseB.put("productId", 50);
        responseB.put("name", "测试产品");
        responseB.put("price", 199.00);
        responseB.put("stock", 100);
        request.setResponseB(responseB);

        request.setVersionA("v1.0.0");
        request.setVersionB("v1.1.0");
        request.setStatusCodeA(200);
        request.setStatusCodeB(200);
        request.setResponseTimeA(150L);
        request.setResponseTimeB(150L);
        request.setTags("product-api");

        apiDiffService.createDiffRecord(request);
    }
}
