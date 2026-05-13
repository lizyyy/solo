package com.lineage.controller;

import com.lineage.dto.*;
import com.lineage.entity.FieldLineage;
import com.lineage.entity.LineageHistory;
import com.lineage.enums.LineageStatus;
import com.lineage.service.FieldLineageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.util.List;

@Slf4j
@Validated
@RestController
@RequestMapping("/api/v1/lineage")
@RequiredArgsConstructor
public class FieldLineageController {

    private final FieldLineageService lineageService;

    @PostMapping
    public ApiResponse<FieldLineage> createLineage(@Valid @RequestBody FieldLineageCreateRequest request) {
        log.info("Received create lineage request: apiPath={}, responseField={}", 
                request.getApiPath(), request.getResponseField());
        FieldLineage result = lineageService.createLineage(request);
        return ApiResponse.success("创建成功", result);
    }

    @GetMapping("/{id}")
    public ApiResponse<FieldLineage> getLineage(@PathVariable Long id) {
        log.info("Received get lineage request: id={}", id);
        FieldLineage result = lineageService.getLineage(id);
        return ApiResponse.success(result);
    }

    @GetMapping("/search")
    public ApiResponse<List<FieldLineage>> getLineagesByApi(@RequestParam String apiPath) {
        log.info("Received search lineage request: apiPath={}", apiPath);
        List<FieldLineage> result = lineageService.getLineagesByApi(apiPath);
        return ApiResponse.success(result);
    }

    @PostMapping("/{id}/validate")
    public ApiResponse<FieldLineage> validateLineage(@PathVariable Long id, 
                                                       @RequestParam @NotBlank(message = "操作人不能为空") String operator) {
        log.info("Received validate lineage request: id={}, operator={}", id, operator);
        FieldLineage result = lineageService.validateLineage(id, operator);
        return ApiResponse.success("验证完成", result);
    }

    @PutMapping("/{id}/status")
    public ApiResponse<FieldLineage> updateStatus(@PathVariable Long id,
                                                   @RequestParam LineageStatus newStatus,
                                                   @RequestParam(required = false) String reason,
                                                   @RequestParam @NotBlank(message = "操作人不能为空") String operator) {
        log.info("Received update status request: id={}, newStatus={}, operator={}", id, newStatus, operator);
        FieldLineage result = lineageService.updateStatus(id, newStatus, reason, operator);
        return ApiResponse.success("状态更新成功", result);
    }

    @GetMapping("/impact/table")
    public ApiResponse<List<FieldLineage>> getImpactAnalysis(@RequestParam String tableName,
                                                              @RequestParam String columnName) {
        log.info("Received impact analysis request: tableName={}, columnName={}", tableName, columnName);
        List<FieldLineage> result = lineageService.getImpactAnalysis(tableName, columnName);
        return ApiResponse.success(result);
    }

    @GetMapping("/impact/api")
    public ApiResponse<List<FieldLineage>> getImpactByApi(@RequestParam String dependentApiPath) {
        log.info("Received API impact analysis request: dependentApiPath={}", dependentApiPath);
        List<FieldLineage> result = lineageService.getImpactByApi(dependentApiPath);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}/dependencies")
    public ApiResponse<List<LineageDependency>> expandDependencies(@PathVariable Long id,
                                                                    @RequestParam(defaultValue = "5") int maxDepth) {
        log.info("Received expand dependencies request: id={}, maxDepth={}", id, maxDepth);
        List<LineageDependency> result = lineageService.expandDependencies(id, maxDepth);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}/history")
    public ApiResponse<List<LineageHistory>> getHistory(@PathVariable Long id) {
        log.info("Received get history request: id={}", id);
        List<LineageHistory> result = lineageService.getHistory(id);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}/export")
    public ApiResponse<LineageExport> exportLineage(@PathVariable Long id) {
        log.info("Received export lineage request: id={}", id);
        LineageExport result = lineageService.exportLineage(id);
        return ApiResponse.success(result);
    }
}
