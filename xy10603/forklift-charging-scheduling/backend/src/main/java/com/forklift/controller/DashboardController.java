package com.forklift.controller;

import com.forklift.common.Result;
import com.forklift.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {

    @Autowired
    private ReportService reportService;

    @GetMapping("/stats")
    public Result<Map<String, Object>> getStats() {
        return Result.success(reportService.getDashboardStats());
    }
}
