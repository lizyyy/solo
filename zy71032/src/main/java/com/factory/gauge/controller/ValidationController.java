package com.factory.gauge.controller;

import com.factory.gauge.common.Result;
import com.factory.gauge.service.DataValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/validation")
@RequiredArgsConstructor
public class ValidationController {

    private final DataValidationService dataValidationService;

    @GetMapping("/full")
    public Result<Map<String, Object>> performFullValidation() {
        Map<String, Object> result = dataValidationService.performFullValidation();
        return Result.success(result);
    }

    @GetMapping("/traceability/{toolNo}")
    public Result<Map<String, Object>> validateGaugeTraceability(@PathVariable String toolNo) {
        Map<String, Object> result = dataValidationService.validateGaugeTraceability(toolNo);
        return Result.success(result);
    }
}
