package com.package.repo.controller;

import com.package.repo.model.dto.ApiResponse;
import com.package.repo.model.dto.CreatePackageRequest;
import com.package.repo.model.entity.PackageVersion;
import com.package.repo.model.enums.PackageStatus;
import com.package.repo.service.ExportService;
import com.package.repo.service.PackageService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/packages")
@RequiredArgsConstructor
@Slf4j
public class PackageController {

    private final PackageService packageService;
    private final ExportService exportService;

    @PostMapping
    public ResponseEntity<ApiResponse<PackageVersion>> createPackage(
            @Valid @RequestBody CreatePackageRequest request) {
        try {
            PackageVersion result = packageService.createPackage(request);
            return ResponseEntity.ok(ApiResponse.success("包创建成功", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.failed(e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<PackageVersion>>> getAllPackages() {
        List<PackageVersion> packages = packageService.getAllPackages();
        return ResponseEntity.ok(ApiResponse.success(packages));
    }

    @GetMapping("/{packageName}/{version}")
    public ResponseEntity<ApiResponse<PackageVersion>> getPackage(
            @PathVariable String packageName,
            @PathVariable String version) {
        return packageService.getPackage(packageName, version)
                .map(pkg -> ResponseEntity.ok(ApiResponse.success(pkg)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{packageName}")
    public ResponseEntity<ApiResponse<List<PackageVersion>>> getPackagesByName(
            @PathVariable String packageName) {
        List<PackageVersion> packages = packageService.getPackagesByName(packageName);
        return ResponseEntity.ok(ApiResponse.success(packages));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<ApiResponse<List<PackageVersion>>> getPackagesByStatus(
            @PathVariable PackageStatus status) {
        List<PackageVersion> packages = packageService.getPackagesByStatus(status);
        return ResponseEntity.ok(ApiResponse.success(packages));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<PackageVersion>> updateStatus(
            @PathVariable Long id,
            @RequestParam PackageStatus status,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false) String operator) {
        try {
            PackageVersion result = packageService.updatePackageStatus(id, status, reason, operator);
            return ResponseEntity.ok(ApiResponse.success("状态更新成功", result));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.failed(e.getMessage()));
        }
    }

    @PutMapping("/{id}/manual-fix")
    public ResponseEntity<ApiResponse<PackageVersion>> manualFix(
            @PathVariable Long id,
            @RequestParam PackageStatus status,
            @RequestParam String reason,
            @RequestParam String operator) {
        try {
            PackageVersion result = packageService.manualFix(id, status, reason, operator);
            return ResponseEntity.ok(ApiResponse.success("人工修正成功", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.failed(e.getMessage()));
        }
    }

    @GetMapping("/export/csv")
    public ResponseEntity<String> exportPackagesCsv() {
        String csv = exportService.exportPackagesToCsv();
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv; charset=utf-8")
                .body(csv);
    }

    @GetMapping("/{packageName}/{version}/impact")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getImpactAnalysis(
            @PathVariable String packageName,
            @PathVariable String version) {
        Map<String, Object> analysis = exportService.getImpactAnalysis(packageName, version);
        return ResponseEntity.ok(ApiResponse.success(analysis));
    }
}
