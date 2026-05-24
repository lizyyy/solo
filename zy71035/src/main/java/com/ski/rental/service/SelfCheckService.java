package com.ski.rental.service;

import com.ski.rental.dto.*;
import com.ski.rental.enums.DamageLevel;
import com.ski.rental.model.InspectionItem;
import com.ski.rental.model.Snowboard;
import com.ski.rental.repository.CustomerRepository;
import com.ski.rental.repository.SnowboardRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.*;

@Service
public class SelfCheckService {
    private final RentalService rentalService;
    private final ReportService reportService;
    private final SnowboardRepository snowboardRepository;
    private final CustomerRepository customerRepository;
    private final DataInitializer dataInitializer;

    public SelfCheckService(RentalService rentalService,
                            ReportService reportService,
                            SnowboardRepository snowboardRepository,
                            CustomerRepository customerRepository,
                            DataInitializer dataInitializer) {
        this.rentalService = rentalService;
        this.reportService = reportService;
        this.snowboardRepository = snowboardRepository;
        this.customerRepository = customerRepository;
        this.dataInitializer = dataInitializer;
    }

    @Value("${app.rental.self-check-enabled:true}")
    private boolean selfCheckEnabled;

    public ApiResponse<Map<String, Object>> runSelfCheck() {
        if (!selfCheckEnabled) {
            return ApiResponse.error(503, "自检功能已禁用");
        }

        Map<String, Object> results = new LinkedHashMap<>();
        List<String> passed = new ArrayList<>();
        List<String> failed = new ArrayList<>();

        try {
            results.put("startTime", new Date().toString());

            checkDataInitialization(results, passed, failed);
            testFullWorkflow(results, passed, failed);

            results.put("passed", passed);
            results.put("failed", failed);
            results.put("totalChecks", passed.size() + failed.size());
            results.put("success", failed.isEmpty());
            results.put("endTime", new Date().toString());

            if (failed.isEmpty()) {
                return ApiResponse.ok("自检全部通过", results);
            } else {
                return ApiResponse.error(500, "自检发现 " + failed.size() + " 个问题");
            }

        } catch (Exception e) {
            results.put("error", e.getMessage());
            return ApiResponse.error(500, "自检异常: " + e.getMessage());
        }
    }

    private void checkDataInitialization(Map<String, Object> results, List<String> passed, List<String> failed) {
        long snowboardCount = snowboardRepository.count();
        long customerCount = customerRepository.count();

        if (snowboardCount > 0) {
            passed.add("雪板数据初始化: " + snowboardCount + " 块");
            results.put("snowboardCount", snowboardCount);
        } else {
            failed.add("雪板数据未初始化");
        }

        if (customerCount > 0) {
            passed.add("租客数据初始化: " + customerCount + " 人");
            results.put("customerCount", customerCount);
        } else {
            failed.add("租客数据未初始化");
        }
    }

    private void testFullWorkflow(Map<String, Object> results, List<String> passed, List<String> failed) {
        try {
            Snowboard availableBoard = snowboardRepository.findAll().stream()
                .filter(Snowboard::getIsAvailable)
                .findFirst()
                .orElseThrow(() -> new RuntimeException("没有可用雪板"));

            String customerId = customerRepository.findAll().get(0).getCustomerId();

            RentalSubmitRequest submitReq = new RentalSubmitRequest();
            submitReq.setCustomerId(customerId);
            submitReq.setBoardCode(availableBoard.getBoardCode());
            submitReq.setActualReleaseValue(new BigDecimal("7.0"));
            submitReq.setRentalFee(new BigDecimal("200"));
            submitReq.setOperator("SELF_CHECK");

            ApiResponse<?> submitResult = rentalService.submitSingleRental(submitReq, "BATCH-SELFCHECK", "SELF_CHECK");
            if (submitResult.isSuccess()) {
                passed.add("1. 租赁单提交成功");
            } else {
                failed.add("1. 租赁单提交失败: " + submitResult.getMessage());
                return;
            }

            @SuppressWarnings("unchecked")
            ApiResponse<com.ski.rental.model.RentalOrder> orderResp =
                (ApiResponse<com.ski.rental.model.RentalOrder>) submitResult;
            String orderNo = orderResp.getData().getOrderNo();
            results.put("testOrderNo", orderNo);

            ApiResponse<?> rentOutResult = rentalService.rentOut(orderNo, "SELF_CHECK");
            if (rentOutResult.isSuccess()) {
                passed.add("2. 出租操作成功");
            } else {
                failed.add("2. 出租操作失败: " + rentOutResult.getMessage());
                return;
            }

            ApiResponse<?> duplicateRentResult = rentalService.rentOut(orderNo, "SELF_CHECK");
            if (!duplicateRentResult.isSuccess() && duplicateRentResult.getMessage().contains("重复操作")) {
                passed.add("3. 重复出租拦截成功");
            } else {
                failed.add("3. 重复出租拦截失败");
            }

            ApiResponse<?> returnReqResult = rentalService.requestReturn(orderNo, "SELF_CHECK");
            if (returnReqResult.isSuccess()) {
                passed.add("4. 归还申请成功");
            } else {
                failed.add("4. 归还申请失败: " + returnReqResult.getMessage());
                return;
            }

            ApiResponse<?> duplicateReturnResult = rentalService.requestReturn(orderNo, "SELF_CHECK");
            if (!duplicateReturnResult.isSuccess() && duplicateReturnResult.getMessage().contains("重复操作已记录审计")) {
                passed.add("5. 重复归还申请拦截成功");
            } else {
                failed.add("5. 重复归还申请拦截失败");
            }

            ReturnInspectionRequest inspectionReq = new ReturnInspectionRequest();
            inspectionReq.setOrderNo(orderNo);
            inspectionReq.setOverallDamageLevel(DamageLevel.MINOR);
            inspectionReq.setInspector("SELF_CHECK");
            inspectionReq.setEstimatedDamageFee(new BigDecimal("100"));
            inspectionReq.setInspectionItems(new ArrayList<>());
            InspectionItem item = new InspectionItem();
            item.setItemName("板刃磨损");
            item.setDamageLevel(DamageLevel.MINOR);
            item.setDescription("轻微划痕");
            item.setEstimatedFee(new BigDecimal("100"));
            inspectionReq.getInspectionItems().add(item);

            ApiResponse<?> inspectionResult = rentalService.submitReturnInspection(inspectionReq);
            if (inspectionResult.isSuccess()) {
                passed.add("6. 归还检查提交成功（带损伤）");
            } else {
                failed.add("6. 归还检查提交失败: " + inspectionResult.getMessage());
                return;
            }

            DamageReviewRequest reviewReq = new DamageReviewRequest();
            reviewReq.setOrderNo(orderNo);
            reviewReq.setFinalDamageFee(new BigDecimal("80"));
            reviewReq.setDamageConfirmed(true);
            reviewReq.setReviewNote("轻微磨损，实际费用80");
            reviewReq.setReviewer("MANAGER");

            ApiResponse<?> reviewResult = rentalService.reviewDamage(reviewReq);
            if (reviewResult.isSuccess()) {
                passed.add("7. 损伤复核成功");
            } else {
                failed.add("7. 损伤复核失败: " + reviewResult.getMessage());
                return;
            }

            ApiResponse<?> chargeResult = rentalService.chargeFee(orderNo, "CASHIER");
            if (chargeResult.isSuccess()) {
                passed.add("8. 费用收取成功");
            } else {
                failed.add("8. 费用收取失败: " + chargeResult.getMessage());
                return;
            }

            ApiResponse<?> archiveResult = rentalService.archiveOrder(orderNo, "ADMIN");
            if (archiveResult.isSuccess()) {
                passed.add("9. 订单归档成功");
            } else {
                failed.add("9. 订单归档失败: " + archiveResult.getMessage());
            }

            ApiResponse<?> reportResult = reportService.exportOrderDetail(orderNo);
            if (reportResult.isSuccess()) {
                passed.add("10. 订单详情导出成功");
            } else {
                failed.add("10. 订单详情导出失败: " + reportResult.getMessage());
            }

        } catch (Exception e) {
            failed.add("工作流测试异常: " + e.getMessage());
        }
    }

    public ApiResponse<String> resetAndReseed() {
        dataInitializer.resetData();
        return ApiResponse.ok("数据重置完成");
    }
}
