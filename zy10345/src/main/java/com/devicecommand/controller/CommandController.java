package com.devicecommand.controller;

import com.devicecommand.dto.ApiResponse;
import com.devicecommand.dto.ConfirmCommandRequest;
import com.devicecommand.dto.CreateCommandRequest;
import com.devicecommand.entity.*;
import com.devicecommand.service.CommandService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/commands")
public class CommandController {

    @Autowired
    private CommandService commandService;

    @PostMapping("/create")
    public ApiResponse<CommandBatch> createCommand(@Valid @RequestBody CreateCommandRequest request) {
        log.info("创建命令: batchNo={}", request.getBatchNo());
        CommandBatch command = commandService.createCommand(request);
        return ApiResponse.success(command);
    }

    @PostMapping("/validate/{batchNo}")
    public ApiResponse<CommandBatch> validateCommand(@PathVariable String batchNo, 
                                                     @RequestParam(required = false) String handler) {
        log.info("校验命令: batchNo={}", batchNo);
        CommandBatch command = commandService.validateCommand(batchNo, handler);
        return ApiResponse.success(command);
    }

    @PostMapping("/dispatch/{batchNo}")
    public ApiResponse<CommandBatch> dispatchCommand(@PathVariable String batchNo,
                                                     @RequestParam(required = false) String handler) {
        log.info("下发命令: batchNo={}", batchNo);
        CommandBatch command = commandService.dispatchCommand(batchNo, handler);
        return ApiResponse.success(command);
    }

    @PostMapping("/confirm")
    public ApiResponse<CommandBatch> confirmCommand(@Valid @RequestBody ConfirmCommandRequest request) {
        log.info("确认命令: batchNo={}", request.getBatchNo());
        CommandBatch command = commandService.confirmCommand(request);
        return ApiResponse.success(command);
    }

    @GetMapping("/{batchNo}")
    public ApiResponse<CommandBatch> getCommand(@PathVariable String batchNo) {
        CommandBatch command = commandService.getCommandByBatchNo(batchNo);
        return ApiResponse.success(command);
    }

    @GetMapping("/{batchNo}/status-history")
    public ApiResponse<List<CommandStatusHistory>> getStatusHistory(@PathVariable String batchNo) {
        List<CommandStatusHistory> history = commandService.getStatusHistory(batchNo);
        return ApiResponse.success(history);
    }

    @GetMapping("/{batchNo}/confirm-records")
    public ApiResponse<List<ExecutionConfirm>> getConfirmRecords(@PathVariable String batchNo) {
        List<ExecutionConfirm> records = commandService.getConfirmRecords(batchNo);
        return ApiResponse.success(records);
    }

    @GetMapping("/{batchNo}/retry-records")
    public ApiResponse<List<RetryRecord>> getRetryRecords(@PathVariable String batchNo) {
        List<RetryRecord> records = commandService.getRetryRecords(batchNo);
        return ApiResponse.success(records);
    }

    @GetMapping("/{batchNo}/timeout-reasons")
    public ApiResponse<List<TimeoutReason>> getTimeoutReasons(@PathVariable String batchNo) {
        List<TimeoutReason> reasons = commandService.getTimeoutReasons(batchNo);
        return ApiResponse.success(reasons);
    }

    @GetMapping("/{batchNo}/full-trace")
    public ApiResponse<Map<String, Object>> getFullTrace(@PathVariable String batchNo) {
        Map<String, Object> trace = new HashMap<>();
        trace.put("command", commandService.getCommandByBatchNo(batchNo));
        trace.put("statusHistory", commandService.getStatusHistory(batchNo));
        trace.put("confirmRecords", commandService.getConfirmRecords(batchNo));
        trace.put("retryRecords", commandService.getRetryRecords(batchNo));
        trace.put("timeoutReasons", commandService.getTimeoutReasons(batchNo));
        return ApiResponse.success(trace);
    }

    @GetMapping("/device/{deviceCode}")
    public ApiResponse<List<CommandBatch>> getCommandsByDevice(@PathVariable String deviceCode) {
        List<CommandBatch> commands = commandService.getCommandsByDevice(deviceCode);
        return ApiResponse.success(commands);
    }
}
