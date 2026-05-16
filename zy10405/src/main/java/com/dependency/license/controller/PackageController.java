package com.dependency.license.controller;

import com.dependency.license.dto.ApiResponse;
import com.dependency.license.dto.CreatePackageRequest;
import com.dependency.license.model.DependencyPackage;
import com.dependency.license.service.PackageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/packages")
@RequiredArgsConstructor
@Tag(name = "依赖包管理", description = "依赖升级相关的包管理接口")
public class PackageController {
    private final PackageService packageService;

    @PostMapping
    @Operation(summary = "创建依赖包", description = "创建一个新的依赖升级包，需要符合语义化版本规范")
    public ApiResponse<DependencyPackage> createPackage(@Valid @RequestBody CreatePackageRequest request) {
        return ApiResponse.success(packageService.createPackage(request));
    }

    @GetMapping
    @Operation(summary = "获取所有依赖包", description = "查询所有依赖包列表")
    public ApiResponse<List<DependencyPackage>> getAllPackages() {
        return ApiResponse.success(packageService.getAllPackages());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取依赖包详情", description = "根据ID获取依赖包详细信息")
    public ApiResponse<DependencyPackage> getPackageById(@PathVariable Long id) {
        return ApiResponse.success(packageService.getPackageById(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新依赖包", description = "更新依赖包信息")
    public ApiResponse<DependencyPackage> updatePackage(@PathVariable Long id,
                                                        @Valid @RequestBody CreatePackageRequest request) {
        return ApiResponse.success(packageService.updatePackage(id, request));
    }
}