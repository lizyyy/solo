package com.api.inspection.controller;

import com.api.inspection.annotation.Idempotent;
import com.api.inspection.dto.ApiResponse;
import com.api.inspection.dto.CreateTemplateRequest;
import com.api.inspection.entity.TransactionTemplate;
import com.api.inspection.enums.TransactionStatus;
import com.api.inspection.service.TransactionTemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class TransactionTemplateController {
    private final TransactionTemplateService templateService;

    @PostMapping
    @Idempotent(expireSeconds = 10)
    public ApiResponse<TransactionTemplate> createTemplate(@Valid @RequestBody CreateTemplateRequest request) {
        log.info("创建事务模板: {}", request.getTemplateCode());
        TransactionTemplate template = templateService.createTemplate(request);
        return ApiResponse.success("创建成功", template);
    }

    @GetMapping("/{id}")
    public ApiResponse<TransactionTemplate> getTemplate(@PathVariable Long id) {
        return ApiResponse.success(templateService.getTemplate(id));
    }

    @GetMapping("/code/{templateCode}")
    public ApiResponse<TransactionTemplate> getTemplateByCode(@PathVariable String templateCode) {
        return ApiResponse.success(templateService.getTemplateByCode(templateCode));
    }

    @GetMapping
    public ApiResponse<List<TransactionTemplate>> getAllTemplates() {
        return ApiResponse.success(templateService.getAllTemplates());
    }

    @PostMapping("/{id}/validate")
    public ApiResponse<TransactionTemplate> validateTemplate(@PathVariable Long id) {
        log.info("校验事务模板: {}", id);
        return ApiResponse.success("校验成功", templateService.validateTemplate(id));
    }

    @PostMapping("/{id}/status")
    public ApiResponse<TransactionTemplate> updateStatus(@PathVariable Long id, @RequestParam TransactionStatus status) {
        log.info("更新事务模板状态: {} -> {}", id, status);
        return ApiResponse.success("状态更新成功", templateService.updateStatus(id, status));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<TransactionTemplate> cancelTemplate(@PathVariable Long id) {
        log.info("撤销事务模板: {}", id);
        return ApiResponse.success("撤销成功", templateService.cancelTemplate(id));
    }
}
