package com.forklift.controller;

import com.forklift.common.Result;
import com.forklift.entity.ChargingTask;
import com.forklift.service.ChargingTaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/tasks")
public class ChargingTaskController {

    @Autowired
    private ChargingTaskService taskService;

    @GetMapping
    public Result<List<ChargingTask>> getAllTasks() {
        return Result.success(taskService.getAllTasks());
    }

    @GetMapping("/status/{status}")
    public Result<List<ChargingTask>> getTasksByStatus(@PathVariable String status) {
        return Result.success(taskService.getTasksByStatus(status));
    }

    @GetMapping("/urgent")
    public Result<List<ChargingTask>> getUrgentTasks() {
        return Result.success(taskService.getUrgentTasks());
    }

    @GetMapping("/wave/{waveId}")
    public Result<List<ChargingTask>> getTasksByWave(@PathVariable Long waveId) {
        return Result.success(taskService.getTasksByWave(waveId));
    }

    @GetMapping("/summary")
    public Result<Map<String, Object>> getTaskStatusSummary() {
        return Result.success(taskService.getTaskStatusSummary());
    }

    @GetMapping("/{id}")
    public Result<ChargingTask> getById(@PathVariable Long id) {
        return Result.success(taskService.getById(id));
    }

    @PostMapping
    public Result<ChargingTask> createTask(@RequestBody ChargingTask task, 
                                           @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(taskService.createTask(task, operator));
    }

    @PutMapping("/{id}")
    public Result<ChargingTask> updateTask(@PathVariable Long id, 
                                           @RequestBody ChargingTask task,
                                           @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(taskService.updateTask(id, task, operator));
    }

    @PostMapping("/{id}/assign-station/{stationId}")
    public Result<ChargingTask> assignStation(@PathVariable Long id, 
                                              @PathVariable Long stationId,
                                              @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(taskService.assignStation(id, stationId, operator));
    }

    @PostMapping("/{id}/start")
    public Result<ChargingTask> startCharging(@PathVariable Long id,
                                              @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(taskService.startCharging(id, operator));
    }

    @PostMapping("/{id}/complete")
    public Result<ChargingTask> completeCharging(@PathVariable Long id,
                                                 @RequestParam Integer finalSoc,
                                                 @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(taskService.completeCharging(id, finalSoc, operator));
    }

    @PostMapping("/{id}/cancel")
    public Result<ChargingTask> cancelTask(@PathVariable Long id,
                                           @RequestParam String reason,
                                           @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(taskService.cancelTask(id, reason, operator));
    }

    @PostMapping("/{id}/adjust-priority")
    public Result<ChargingTask> adjustPriority(@PathVariable Long id,
                                               @RequestParam Integer newPriority,
                                               @RequestParam String reason,
                                               @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(taskService.adjustPriority(id, newPriority, operator, reason));
    }

    @GetMapping("/power-forecast")
    public Result<Map<String, Object>> getPowerForecast() {
        return Result.success(taskService.getPowerForecast());
    }
}
