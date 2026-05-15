package com.object.lifecycle.controller;

import com.object.lifecycle.dto.ApiResponse;
import com.object.lifecycle.dto.CreatePrefixRequest;
import com.object.lifecycle.entity.AuditLog;
import com.object.lifecycle.entity.ObjectPrefix;
import com.object.lifecycle.service.AuditLogService;
import com.object.lifecycle.service.ObjectPrefixService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/prefixes")
@RequiredArgsConstructor
public class ObjectPrefixController {

    private final ObjectPrefixService prefixService;
    private final AuditLogService auditLogService;

    @PostMapping
    public ApiResponse<ObjectPrefix> createPrefix(@Valid @RequestBody CreatePrefixRequest request) {
        ObjectPrefix prefix = prefixService.createPrefix(request);
        return ApiResponse.success("前缀创建成功", prefix);
    }

    @GetMapping("/{id}")
    public ApiResponse<ObjectPrefix> getPrefix(@PathVariable Long id) {
        ObjectPrefix prefix = prefixService.getPrefixById(id);
        return ApiResponse.success(prefix);
    }

    @GetMapping
    public ApiResponse<List<ObjectPrefix>> getAllPrefixes(
            @RequestParam(required = false, defaultValue = "false") boolean enabledOnly) {
        if (enabledOnly) {
            return ApiResponse.success(prefixService.getEnabledPrefixes());
        }
        return ApiResponse.success(prefixService.getAllPrefixes());
    }

    @PutMapping("/{id}")
    public ApiResponse<ObjectPrefix> updatePrefix(@PathVariable Long id,
            @Valid @RequestBody CreatePrefixRequest request) {
        ObjectPrefix prefix = prefixService.updatePrefix(id, request);
        return ApiResponse.success("前缀更新成功", prefix);
    }

    @PatchMapping("/{id}/toggle")
    public ApiResponse<ObjectPrefix> togglePrefix(@PathVariable Long id,
            @RequestParam boolean enabled) {
        ObjectPrefix prefix = prefixService.togglePrefix(id, enabled);
        return ApiResponse.success("前缀状态更新成功", prefix);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deletePrefix(@PathVariable Long id) {
        prefixService.deletePrefix(id);
        return ApiResponse.success("前缀删除成功", null);
    }

    @GetMapping("/{id}/audit-logs")
    public ApiResponse<List<AuditLog>> getAuditLogs(@PathVariable Long id) {
        List<AuditLog> logs = auditLogService.getAuditLogs("ObjectPrefix", id.toString());
        return ApiResponse.success(logs);
    }
}
