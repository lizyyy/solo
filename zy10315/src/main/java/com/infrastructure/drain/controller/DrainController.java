package com.infrastructure.drain.controller;

import com.infrastructure.drain.dto.ApiResponse;
import com.infrastructure.drain.dto.CreateDrainBatchRequest;
import com.infrastructure.drain.dto.DrainBatchResponse;
import com.infrastructure.drain.model.DrainStatus;
import com.infrastructure.drain.service.DrainService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.util.List;

@Slf4j
@Api(tags = "服务实例排空 API")
@RestController
@RequestMapping("/api/v1/drain")
@RequiredArgsConstructor
@Validated
public class DrainController {
    
    private final DrainService drainService;
    
    @ApiOperation("创建排空批次")
    @PostMapping("/batches")
    public ApiResponse<DrainBatchResponse> createBatch(
            @Valid @RequestBody CreateDrainBatchRequest request,
            HttpServletRequest httpRequest) {
        log.info("收到创建排空批次请求: batchId={}, operator={}", request.getBatchId(), request.getOperator());
        DrainBatchResponse response = drainService.createBatch(request);
        return ApiResponse.success("批次创建成功", response);
    }
    
    @ApiOperation("校验批次")
    @PostMapping("/batches/{batchId}/validate")
    public ApiResponse<DrainBatchResponse> validateBatch(
            @PathVariable @NotBlank(message = "批次ID不能为空") String batchId,
            @RequestParam @NotBlank(message = "操作人不能为空") String operator,
            HttpServletRequest httpRequest) {
        log.info("收到校验批次请求: batchId={}, operator={}", batchId, operator);
        DrainBatchResponse response = drainService.validateBatch(batchId, operator);
        return ApiResponse.success("校验完成", response);
    }
    
    @ApiOperation("开始摘流")
    @PostMapping("/batches/{batchId}/offload")
    public ApiResponse<DrainBatchResponse> startTrafficOffload(
            @PathVariable @NotBlank(message = "批次ID不能为空") String batchId,
            @RequestParam @NotBlank(message = "操作人不能为空") String operator,
            HttpServletRequest httpRequest) {
        log.info("收到摘流请求: batchId={}, operator={}", batchId, operator);
        DrainBatchResponse response = drainService.startTrafficOffload(batchId, operator);
        return ApiResponse.success("摘流完成", response);
    }
    
    @ApiOperation("观察连接状态")
    @PostMapping("/batches/{batchId}/observe")
    public ApiResponse<DrainBatchResponse> observeConnections(
            @PathVariable @NotBlank(message = "批次ID不能为空") String batchId,
            @RequestParam @NotBlank(message = "操作人不能为空") String operator,
            HttpServletRequest httpRequest) {
        log.info("收到观察连接请求: batchId={}, operator={}", batchId, operator);
        DrainBatchResponse response = drainService.observeConnections(batchId, operator);
        return ApiResponse.success("连接观察完成", response);
    }
    
    @ApiOperation("迁移任务")
    @PostMapping("/batches/{batchId}/migrate")
    public ApiResponse<DrainBatchResponse> migrateTasks(
            @PathVariable @NotBlank(message = "批次ID不能为空") String batchId,
            @RequestParam @NotBlank(message = "操作人不能为空") String operator,
            HttpServletRequest httpRequest) {
        log.info("收到任务迁移请求: batchId={}, operator={}", batchId, operator);
        DrainBatchResponse response = drainService.migrateTasks(batchId, operator);
        return ApiResponse.success("任务迁移完成", response);
    }
    
    @ApiOperation("执行排空")
    @PostMapping("/batches/{batchId}/drain")
    public ApiResponse<DrainBatchResponse> drain(
            @PathVariable @NotBlank(message = "批次ID不能为空") String batchId,
            @RequestParam @NotBlank(message = "操作人不能为空") String operator,
            HttpServletRequest httpRequest) {
        log.info("收到排空请求: batchId={}, operator={}", batchId, operator);
        DrainBatchResponse response = drainService.drain(batchId, operator);
        return ApiResponse.success("排空完成", response);
    }
    
    @ApiOperation("完成排空流程")
    @PostMapping("/batches/{batchId}/complete")
    public ApiResponse<DrainBatchResponse> complete(
            @PathVariable @NotBlank(message = "批次ID不能为空") String batchId,
            @RequestParam @NotBlank(message = "操作人不能为空") String operator,
            HttpServletRequest httpRequest) {
        log.info("收到完成请求: batchId={}, operator={}", batchId, operator);
        DrainBatchResponse response = drainService.complete(batchId, operator);
        return ApiResponse.success("流程已完成", response);
    }
    
    @ApiOperation("恢复失败批次")
    @PostMapping("/batches/{batchId}/recover")
    public ApiResponse<DrainBatchResponse> recover(
            @PathVariable @NotBlank(message = "批次ID不能为空") String batchId,
            @RequestParam @NotBlank(message = "操作人不能为空") String operator,
            @RequestParam(defaultValue = "手动恢复") String reason,
            HttpServletRequest httpRequest) {
        log.info("收到恢复请求: batchId={}, operator={}", batchId, operator);
        DrainBatchResponse response = drainService.recover(batchId, operator, reason);
        return ApiResponse.success("恢复完成", response);
    }
    
    @ApiOperation("取消批次")
    @PostMapping("/batches/{batchId}/cancel")
    public ApiResponse<DrainBatchResponse> cancel(
            @PathVariable @NotBlank(message = "批次ID不能为空") String batchId,
            @RequestParam @NotBlank(message = "操作人不能为空") String operator,
            @RequestParam(defaultValue = "手动取消") String reason,
            HttpServletRequest httpRequest) {
        log.info("收到取消请求: batchId={}, operator={}", batchId, operator);
        DrainBatchResponse response = drainService.cancel(batchId, operator, reason);
        return ApiResponse.success("已取消", response);
    }
    
    @ApiOperation("获取批次详情")
    @GetMapping("/batches/{batchId}")
    public ApiResponse<DrainBatchResponse> getBatch(
            @PathVariable @NotBlank(message = "批次ID不能为空") String batchId,
            HttpServletRequest httpRequest) {
        DrainBatchResponse response = drainService.getBatch(batchId);
        return ApiResponse.success(response);
    }
    
    @ApiOperation("获取所有批次列表")
    @GetMapping("/batches")
    public ApiResponse<List<DrainBatchResponse>> listBatches(
            @RequestParam(required = false) DrainStatus status,
            HttpServletRequest httpRequest) {
        List<DrainBatchResponse> batches;
        if (status != null) {
            batches = drainService.listBatchesByStatus(status);
        } else {
            batches = drainService.listBatches();
        }
        return ApiResponse.success(batches);
    }
}
