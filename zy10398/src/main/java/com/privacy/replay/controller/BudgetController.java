package com.privacy.replay.controller;

import com.privacy.replay.dto.ApiResponse;
import com.privacy.replay.model.MaskingLevel;
import com.privacy.replay.model.PrivacyBudget;
import com.privacy.replay.service.PrivacyBudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/budget")
@RequiredArgsConstructor
public class BudgetController {

    private final PrivacyBudgetService privacyBudgetService;

    @GetMapping("/{userId}")
    public ApiResponse<PrivacyBudget> getBudget(@PathVariable String userId) {
        PrivacyBudget result = privacyBudgetService.getBudgetByUserId(userId);
        return ApiResponse.success(result);
    }

    @PostMapping("/create")
    public ApiResponse<PrivacyBudget> createBudget(
            @RequestParam String userId,
            @RequestParam BigDecimal totalBudget,
            @RequestParam Integer maxUsageCount,
            @RequestParam(required = false, defaultValue = "MEDIUM") MaskingLevel defaultMaskingLevel) {
        PrivacyBudget result = privacyBudgetService.createBudget(
                userId, totalBudget, maxUsageCount, defaultMaskingLevel);
        return ApiResponse.success(result);
    }
}
