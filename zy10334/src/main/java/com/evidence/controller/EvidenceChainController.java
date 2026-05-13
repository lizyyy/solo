package com.evidence.controller;

import com.evidence.dto.*;
import com.evidence.entity.EvidenceChain;
import com.evidence.enums.EvidenceStatus;
import com.evidence.service.EvidenceChainService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/evidence")
@RequiredArgsConstructor
@Api(tags = "接口证据链追踪 API")
public class EvidenceChainController {

    private final EvidenceChainService evidenceChainService;

    @PostMapping("/create")
    @ApiOperation("创建证据链")
    public ApiResponse<EvidenceChain> create(@Valid @RequestBody CreateEvidenceRequest request) {
        return evidenceChainService.createEvidence(request);
    }

    @PostMapping("/action")
    @ApiOperation("添加动作")
    public ApiResponse<EvidenceChain> addAction(@Valid @RequestBody AddActionRequest request) {
        return evidenceChainService.addAction(request);
    }

    @PostMapping("/status")
    @ApiOperation("更新状态")
    public ApiResponse<EvidenceChain> updateStatus(@Valid @RequestBody StatusUpdateRequest request) {
        return evidenceChainService.updateStatus(request);
    }

    @PostMapping("/remark")
    @ApiOperation("添加人工备注")
    public ApiResponse<EvidenceChain> addRemark(@Valid @RequestBody AddRemarkRequest request) {
        return evidenceChainService.addRemark(request);
    }

    @GetMapping("/{requestId}")
    @ApiOperation("根据请求ID查询证据链")
    public ApiResponse<EvidenceChain> getByRequestId(
            @ApiParam("请求ID") @PathVariable String requestId) {
        return evidenceChainService.getByRequestId(requestId);
    }

    @GetMapping("/business/{businessNo}")
    @ApiOperation("根据业务单号查询所有证据链")
    public ApiResponse<List<EvidenceChain>> getByBusinessNo(
            @ApiParam("业务单号") @PathVariable String businessNo) {
        return evidenceChainService.getByBusinessNo(businessNo);
    }

    @GetMapping("/query")
    @ApiOperation("条件查询证据链")
    public ApiResponse<List<EvidenceChain>> query(
            @ApiParam("业务单号") @RequestParam(required = false) String businessNo,
            @ApiParam("状态") @RequestParam(required = false) EvidenceStatus status,
            @ApiParam("来源系统") @RequestParam(required = false) String sourceSystem) {
        return evidenceChainService.query(businessNo, status, sourceSystem);
    }

    @GetMapping("/summary/{requestId}")
    @ApiOperation("导出证据链摘要")
    public ApiResponse<String> exportSummary(
            @ApiParam("请求ID") @PathVariable String requestId) {
        return evidenceChainService.exportSummary(requestId);
    }

    @GetMapping("/validate/{requestId}")
    @ApiOperation("验证证据链是否存在")
    public ApiResponse<Boolean> validate(
            @ApiParam("请求ID") @PathVariable String requestId) {
        return evidenceChainService.validate(requestId);
    }
}
