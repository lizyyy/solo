package com.manufacture.outsourcing.controller;

import com.manufacture.outsourcing.common.Result;
import com.manufacture.outsourcing.entity.OperationLog;
import com.manufacture.outsourcing.service.OperationLogService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/logs")
public class OperationLogController {

    private final OperationLogService logService;

    public OperationLogController(OperationLogService logService) {
        this.logService = logService;
    }

    @GetMapping("/entity/{entityType}/{entityId}")
    public Result<List<OperationLog>> findByEntity(@PathVariable String entityType,
                                                    @PathVariable Long entityId) {
        return Result.success(logService.findByEntity(entityType, entityId));
    }

    @GetMapping("/no/{entityNo}")
    public Result<List<OperationLog>> findByEntityNo(@PathVariable String entityNo) {
        return Result.success(logService.findByEntityNo(entityNo));
    }

    @GetMapping("/operator/{operator}")
    public Result<List<OperationLog>> findByOperator(@PathVariable String operator) {
        return Result.success(logService.findByOperator(operator));
    }
}
