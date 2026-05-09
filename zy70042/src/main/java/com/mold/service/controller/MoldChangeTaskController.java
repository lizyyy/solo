package com.mold.service.controller;

import com.mold.service.common.ApiResponse;
import com.mold.service.domain.entity.MoldChangeTask;
import com.mold.service.domain.repository.MoldChangeTaskRepository;
import com.mold.service.service.MoldLifeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mold-change-tasks")
@RequiredArgsConstructor
public class MoldChangeTaskController {
    
    private final MoldChangeTaskRepository taskRepository;
    private final MoldLifeService moldLifeService;
    
    @GetMapping
    public ApiResponse<List<MoldChangeTask>> getAllTasks(
            @RequestParam(required = false) List<MoldChangeTask.TaskStatus> statuses) {
        List<MoldChangeTask> tasks = statuses != null && !statuses.isEmpty()
                ? taskRepository.findByStatusIn(statuses)
                : taskRepository.findAll();
        return ApiResponse.success(tasks);
    }
    
    @GetMapping("/{taskNo}")
    public ApiResponse<MoldChangeTask> getByTaskNo(@PathVariable String taskNo) {
        return taskRepository.findByTaskNo(taskNo)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "任务不存在: " + taskNo));
    }
    
    @GetMapping("/mold/{moldCode}")
    public ApiResponse<List<MoldChangeTask>> getByMoldCode(
            @PathVariable String moldCode,
            @RequestParam(required = false) Long moldId) {
        if (moldId != null) {
            return ApiResponse.success(taskRepository.findByMoldIdOrderByCreatedAtDesc(moldId));
        }
        return ApiResponse.error(400, "需要提供moldId参数");
    }
    
    @GetMapping("/pending")
    public ApiResponse<List<MoldChangeTask>> getPendingTasks() {
        return ApiResponse.success(taskRepository.findByStatusIn(
                List.of(MoldChangeTask.TaskStatus.PENDING)));
    }
    
    @GetMapping("/expired-mold-tasks")
    public ApiResponse<List<MoldChangeTask>> getExpiredMoldTasks() {
        return ApiResponse.success(taskRepository.findExpiredMoldTasks());
    }
    
    @PostMapping("/{taskNo}/complete")
    public ApiResponse<MoldChangeTask> completeTask(
            @PathVariable String taskNo,
            @RequestParam(required = false) String remark,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        moldLifeService.completeTask(taskNo, operator, remark);
        return taskRepository.findByTaskNo(taskNo)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "任务不存在: " + taskNo));
    }
    
    @PutMapping("/{taskNo}/status")
    public ApiResponse<MoldChangeTask> updateStatus(
            @PathVariable String taskNo,
            @RequestParam MoldChangeTask.TaskStatus status,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        return taskRepository.findByTaskNo(taskNo)
                .map(task -> {
                    task.setStatus(status);
                    task.setUpdatedBy(operator);
                    if (status == MoldChangeTask.TaskStatus.IN_PROGRESS) {
                        task.setActualStartTime(java.time.LocalDateTime.now());
                    } else if (status == MoldChangeTask.TaskStatus.COMPLETED) {
                        task.setActualCompleteTime(java.time.LocalDateTime.now());
                    }
                    return ApiResponse.success(taskRepository.save(task));
                })
                .orElse(ApiResponse.error(404, "任务不存在: " + taskNo));
    }
}
