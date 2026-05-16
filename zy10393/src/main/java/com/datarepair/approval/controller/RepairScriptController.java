package com.datarepair.approval.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.datarepair.approval.common.Result;
import com.datarepair.approval.dto.*;
import com.datarepair.approval.entity.DryRunResult;
import com.datarepair.approval.entity.ExecutionBatch;
import com.datarepair.approval.entity.RepairScript;
import com.datarepair.approval.entity.RollbackRecord;
import com.datarepair.approval.service.RepairScriptService;
import com.datarepair.approval.service.TroubleshootService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.Map;

@RestController
@RequestMapping("/repair-scripts")
@RequiredArgsConstructor
@Validated
public class RepairScriptController {

    private final RepairScriptService repairScriptService;
    private final TroubleshootService troubleshootService;

    @PostMapping
    public Result<RepairScript> create(@Valid @RequestBody RepairScriptCreateDTO dto) {
        RepairScript script = repairScriptService.create(dto);
        return Result.success(script);
    }

    @PostMapping("/submit")
    public Result<Void> submit(@Valid @RequestBody SubmitDTO dto) {
        repairScriptService.submit(dto);
        return Result.success();
    }

    @PostMapping("/dry-run")
    public Result<DryRunResult> dryRun(@Valid @RequestBody DryRunDTO dto) {
        DryRunResult result = repairScriptService.dryRun(dto);
        return Result.success(result);
    }

    @PostMapping("/approve")
    public Result<Void> approve(@Valid @RequestBody ApprovalDTO dto) {
        repairScriptService.approve(dto);
        return Result.success();
    }

    @PostMapping("/execute")
    public Result<ExecutionBatch> execute(@Valid @RequestBody ExecuteDTO dto) {
        ExecutionBatch batch = repairScriptService.execute(dto);
        return Result.success(batch);
    }

    @PostMapping("/rollback")
    public Result<RollbackRecord> rollback(@Valid @RequestBody RollbackDTO dto) {
        RollbackRecord record = repairScriptService.rollback(dto);
        return Result.success(record);
    }

    @GetMapping("/{id}")
    public Result<RepairScript> getById(@PathVariable Long id) {
        RepairScript script = repairScriptService.getById(id);
        return Result.success(script);
    }

    @GetMapping("/{id}/detail")
    public Result<Map<String, Object>> getDetailById(@PathVariable Long id) {
        Map<String, Object> detail = repairScriptService.getDetailById(id);
        return Result.success(detail);
    }

    @GetMapping("/page")
    public Result<IPage<RepairScript>> queryPage(@Valid ScriptQueryDTO dto) {
        IPage<RepairScript> page = repairScriptService.queryPage(dto);
        return Result.success(page);
    }

    @GetMapping("/{id}/troubleshoot-report")
    public Result<Map<String, Object>> getTroubleshootReport(@PathVariable Long id) {
        Map<String, Object> report = troubleshootService.generateTroubleshootReport(id);
        return Result.success(report);
    }
}
