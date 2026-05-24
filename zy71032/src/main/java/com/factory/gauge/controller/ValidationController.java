package com.factory.gauge.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.factory.gauge.common.Result;
import com.factory.gauge.service.DataValidationService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/validation")
public class ValidationController {


    private static final Logger log = LoggerFactory.getLogger(ValidationController.class);
    private final DataValidationService dataValidationService;


    public ValidationController(DataValidationService dataValidationService) {
        this.dataValidationService = dataValidationService;
    }
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
