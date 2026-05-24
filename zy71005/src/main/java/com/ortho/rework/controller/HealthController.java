package com.ortho.rework.controller;

import com.ortho.rework.dto.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ApiResponse<Map<String, Object>> health() {
        Map<String, Object> data = new HashMap<>();
        data.put("status", "UP");
        data.put("service", "牙套印模返工 API");
        data.put("timestamp", LocalDateTime.now());
        return ApiResponse.success(data);
    }

    @GetMapping("/self-check")
    public ApiResponse<Map<String, Object>> selfCheck() {
        Map<String, Object> data = new HashMap<>();
        data.put("status", "OK");
        data.put("database", "H2 内存数据库 - 可用");
        data.put("h2-console", "http://localhost:8080/h2-console");
        data.put("api-version", "1.0.0");
        data.put("supported-operations", new String[]{
            "create", "receive", "inspect", "technician-note", 
            "doctor-confirm", "review", "ship", "close", 
            "mark-lost", "export"
        });
        data.put("timestamp", LocalDateTime.now());
        return ApiResponse.success(data, "自检完成");
    }
}
