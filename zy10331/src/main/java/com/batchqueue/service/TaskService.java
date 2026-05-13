package com.batchqueue.service;

import com.batchqueue.exception.DuplicateTaskException;
import com.batchqueue.exception.TaskNotFoundException;
import com.batchqueue.model.dto.TaskCreateRequest;
import com.batchqueue.model.dto.TaskResponse;
import com.batchqueue.model.entity.Task;
import com.batchqueue.model.enums.TaskStatus;
import com.batchqueue.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {
    private final TaskRepository taskRepository;
    private final TaskSchedulerService taskSchedulerService;

    @Transactional
    public TaskResponse createTask(TaskCreateRequest request) {
        if (taskRepository.existsByTaskId(request.getTaskId())) {
            throw new DuplicateTaskException("任务ID已存在: " + request.getTaskId());
        }

        Task task = Task.builder()
                .taskId(request.getTaskId())
                .taskName(request.getTaskName())
                .taskType(request.getTaskType())
                .priority(request.getPriority())
                .status(TaskStatus.PENDING)
                .payload(request.getPayload())
                .handler(request.getHandler())
                .build();

        task = taskRepository.save(task);
        log.info("创建任务成功 - taskId: {}", task.getTaskId());

        taskSchedulerService.scheduleTask(task);

        return convertToResponse(task);
    }

    public TaskResponse getTaskByTaskId(String taskId) {
        Task task = taskRepository.findByTaskId(taskId)
                .orElseThrow(() -> new TaskNotFoundException("任务不存在: " + taskId));
        return convertToResponse(task);
    }

    public Task getTaskEntityByTaskId(String taskId) {
        return taskRepository.findByTaskId(taskId)
                .orElseThrow(() -> new TaskNotFoundException("任务不存在: " + taskId));
    }

    public List<TaskResponse> getAllTasks() {
        return taskRepository.findAll().stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public List<TaskResponse> getTasksByStatus(TaskStatus status) {
        return taskRepository.findByStatus(status).stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public TaskResponse progressTask(String taskId, String result, String operator) {
        Task task = getTaskEntityByTaskId(taskId);
        taskSchedulerService.completeTask(task, result, operator);
        return convertToResponse(task);
    }

    public TaskResponse cancelTask(String taskId, String reason, String operator) {
        Task task = getTaskEntityByTaskId(taskId);
        taskSchedulerService.cancelTask(task, reason, operator);
        return convertToResponse(task);
    }

    public List<TaskResponse> getWaitingQueue() {
        return taskRepository.findWaitingTasksOrderedByPriority().stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public List<TaskResponse> getRunningTasks() {
        return taskRepository.findRunningTasksOrderedByPriorityDesc().stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    private TaskResponse convertToResponse(Task task) {
        return TaskResponse.builder()
                .id(task.getId())
                .taskId(task.getTaskId())
                .taskName(task.getTaskName())
                .taskType(task.getTaskType())
                .priority(task.getPriority())
                .status(task.getStatus())
                .payload(task.getPayload())
                .result(task.getResult())
                .handler(task.getHandler())
                .executionSlot(task.getExecutionSlot())
                .createdAt(task.getCreatedAt())
                .queuedAt(task.getQueuedAt())
                .startedAt(task.getStartedAt())
                .completedAt(task.getCompletedAt())
                .waitDurationSeconds(task.getWaitDurationSeconds())
                .executionDurationSeconds(task.getExecutionDurationSeconds())
                .build();
    }
}
