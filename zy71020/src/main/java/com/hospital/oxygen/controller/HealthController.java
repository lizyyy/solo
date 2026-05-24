package com.hospital.oxygen.controller;

import com.hospital.oxygen.common.ApiResponse;
import com.hospital.oxygen.service.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);

    private final BookingService bookingService;
    private final TransferService transferService;
    private final EquipmentBorrowService borrowService;
    private final RuleEngineService ruleEngineService;

    public HealthController(BookingService bookingService, TransferService transferService, EquipmentBorrowService borrowService, RuleEngineService ruleEngineService) {
        this.bookingService = bookingService;
        this.transferService = transferService;
        this.borrowService = borrowService;
        this.ruleEngineService = ruleEngineService;
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> healthCheck() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "UP");
        result.put("service", "Oxygen Booking API");
        result.put("version", "1.0.0");

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("activeBookings", bookingService.getActiveBookings().size());
        stats.put("totalBookings", bookingService.getAllBookings().size());
        stats.put("unreleasedTransfers", transferService.getUnreleasedTransfers().size());
        stats.put("overdueBorrows", borrowService.getOverdueBorrows().size());
        result.put("stats", stats);

        return ApiResponse.success(result);
    }

    @GetMapping("/self-check")
    public ApiResponse<Map<String, Object>> selfCheck() {
        log.info("执行系统自检...");
        Map<String, Object> result = new LinkedHashMap<>();

        Map<String, Object> checks = new LinkedHashMap<>();

        try {
            int activeBookings = bookingService.getActiveBookings().size();
            checks.put("bookingService", "OK - " + activeBookings + " active bookings");
        } catch (Exception e) {
            checks.put("bookingService", "FAIL - " + e.getMessage());
        }

        try {
            int unreleased = transferService.getUnreleasedTransfers().size();
            checks.put("transferService", "OK - " + unreleased + " unreleased transfers");
        } catch (Exception e) {
            checks.put("transferService", "FAIL - " + e.getMessage());
        }

        try {
            int overdue = borrowService.getOverdueBorrows().size();
            checks.put("borrowService", "OK - " + overdue + " overdue borrows");
        } catch (Exception e) {
            checks.put("borrowService", "FAIL - " + e.getMessage());
        }

        try {
            var unreleased = ruleEngineService.checkUnreleasedTransfers();
            checks.put("ruleEngine.transfers", "OK - " + unreleased.size() + " unreleased transfers detected");
        } catch (Exception e) {
            checks.put("ruleEngine.transfers", "FAIL - " + e.getMessage());
        }

        try {
            var overdue = ruleEngineService.checkOverdueBorrows();
            checks.put("ruleEngine.overdue", "OK - " + overdue.size() + " overdue borrows detected");
        } catch (Exception e) {
            checks.put("ruleEngine.overdue", "FAIL - " + e.getMessage());
        }

        boolean allOk = checks.values().stream().allMatch(v -> v.toString().startsWith("OK"));
        result.put("allChecksPassed", allOk);
        result.put("checks", checks);

        log.info("系统自检完成: {}", allOk ? "全部通过" : "存在问题");
        return ApiResponse.success(allOk ? "自检通过" : "自检发现问题", result);
    }
}
