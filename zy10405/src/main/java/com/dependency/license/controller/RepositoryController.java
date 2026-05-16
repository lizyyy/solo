package com.dependency.license.controller;

import com.dependency.license.dto.ApiResponse;
import com.dependency.license.dto.CreateRepositoryRequest;
import com.dependency.license.model.Repository;
import com.dependency.license.service.RepositoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/repositories")
@RequiredArgsConstructor
@Tag(name = "仓库管理", description = "代码仓库信息管理接口")
public class RepositoryController {
    private final RepositoryService repositoryService;

    @PostMapping
    @Operation(summary = "创建仓库", description = "注册一个新的代码仓库")
    public ApiResponse<Repository> createRepository(@Valid @RequestBody CreateRepositoryRequest request) {
        return ApiResponse.success(repositoryService.createRepository(request));
    }

    @GetMapping
    @Operation(summary = "获取所有仓库", description = "查询所有仓库列表")
    public ApiResponse<List<Repository>> getAllRepositories() {
        return ApiResponse.success(repositoryService.getAllRepositories());
    }

    @GetMapping("/active")
    @Operation(summary = "获取活跃仓库", description = "查询所有活跃状态的仓库列表")
    public ApiResponse<List<Repository>> getActiveRepositories() {
        return ApiResponse.success(repositoryService.getActiveRepositories());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取仓库详情", description = "根据ID获取仓库详细信息")
    public ApiResponse<Repository> getRepositoryById(@PathVariable Long id) {
        return ApiResponse.success(repositoryService.getRepositoryById(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新仓库", description = "更新仓库信息")
    public ApiResponse<Repository> updateRepository(@PathVariable Long id,
                                                 @Valid @RequestBody CreateRepositoryRequest request) {
        return ApiResponse.success(repositoryService.updateRepository(id, request));
    }
}