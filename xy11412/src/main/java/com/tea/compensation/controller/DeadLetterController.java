package com.tea.compensation.controller;

import com.tea.compensation.dto.Result;
import com.tea.compensation.entity.CompensationTask;
import com.tea.compensation.entity.DeadLetter;
import com.tea.compensation.service.DeadLetterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/dead-letters")
@RequiredArgsConstructor
public class DeadLetterController {

    private final DeadLetterService deadLetterService;

    @GetMapping("/{id}")
    public Result<DeadLetter> getById(@PathVariable Long id) {
        DeadLetter deadLetter = deadLetterService.getDeadLetterById(id);
        return Result.success(deadLetter);
    }

    @GetMapping("/batch/{batchNo}")
    public Result<DeadLetter> getByBatchNo(@PathVariable String batchNo) {
        DeadLetter deadLetter = deadLetterService.getDeadLetterByBatchNo(batchNo);
        return Result.success(deadLetter);
    }

    @GetMapping
    public Result<Page<DeadLetter>> query(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) Boolean recovered
    ) {
        Page<DeadLetter> page = deadLetterService.queryDeadLetters(pageNum, pageSize, recovered);
        return Result.success(page);
    }

    @PostMapping("/{id}/recover")
    public Result<CompensationTask> recover(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = request.getRemoteAddr();
        CompensationTask task = deadLetterService.recoverFromDeadLetter(id, userId, userName, ipAddress);
        return Result.success("恢复成功，新批次号: " + task.getBatchNo(), task);
    }

    @GetMapping("/stats/count-unrecovered")
    public Result<Long> countUnrecovered() {
        long count = deadLetterService.countUnrecovered();
        return Result.success(count);
    }

    @GetMapping("/stats/by-task-type")
    public Result<List<Object[]>> getUnrecoveredByTaskType() {
        List<Object[]> data = deadLetterService.getUnrecoveredByTaskType();
        return Result.success(data);
    }
}
