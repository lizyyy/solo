package com.batchqueue.service;

import com.batchqueue.exception.InvalidTaskStateException;
import com.batchqueue.model.entity.ExecutionSlot;
import com.batchqueue.model.entity.PreemptionRecord;
import com.batchqueue.model.entity.Task;
import com.batchqueue.model.enums.TaskPriority;
import com.batchqueue.model.enums.TaskStatus;
import com.batchqueue.repository.PreemptionRecordRepository;
import com.batchqueue.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskSchedulerService {
    private final TaskRepository taskRepository;
    private final ExecutionSlotService executionSlotService;
    private final ScheduleLogService scheduleLogService;
    private final PreemptionRecordRepository preemptionRecordRepository;

    @Value("${batchqueue.priority.preemption.enabled:true}")
    private boolean preemptionEnabled;

    @Value("${batchqueue.priority.preemption.max-per-hour:3}")
    private int maxPreemptionsPerHour;

    @Transactional
    public void scheduleTask(Task task) {
        if (task.getStatus() != TaskStatus.PENDING) {
            throw new InvalidTaskStateException("只有待执行的任务才能被调度");
        }

        task.setStatus(TaskStatus.WAITING);
        task.setQueuedAt(LocalDateTime.now());
        taskRepository.save(task);
        scheduleLogService.logStatusChange(task, TaskStatus.PENDING, TaskStatus.WAITING, 
                "任务进入等待队列", task.getHandler());

        tryDispatchTasks();
    }

    @Transactional
    public void tryDispatchTasks() {
        List<Task> waitingTasks = taskRepository.findWaitingTasksOrderedByPriority();
        
        for (Task task : waitingTasks) {
            Optional<ExecutionSlot> availableSlot = executionSlotService.getAvailableSlot();
            
            if (availableSlot.isPresent()) {
                dispatchTaskToSlot(task, availableSlot.get());
            } else if (preemptionEnabled) {
                tryPreemption(task);
            }
        }
    }

    private void dispatchTaskToSlot(Task task, ExecutionSlot slot) {
        TaskStatus previousStatus = task.getStatus();
        
        executionSlotService.occupySlot(slot.getSlotNumber(), task.getId(), task.getTaskName());
        
        task.setStatus(TaskStatus.RUNNING);
        task.setStartedAt(LocalDateTime.now());
        task.setExecutionSlot(slot.getSlotNumber());
        
        Duration waitDuration = Duration.between(task.getQueuedAt(), LocalDateTime.now());
        task.setWaitDurationSeconds(waitDuration.getSeconds());
        
        taskRepository.save(task);
        
        scheduleLogService.logStatusChange(task, previousStatus, TaskStatus.RUNNING,
                "任务分配到槽位 " + slot.getSlotNumber(), task.getHandler());
        
        log.info("任务已调度 - taskId: {}, 槽位: {}", task.getTaskId(), slot.getSlotNumber());
    }

    private void tryPreemption(Task highPriorityTask) {
        if (!canPreemptNow()) {
            log.info("已达到每小时最大抢占次数，跳过抢占");
            return;
        }

        List<Task> runningTasks = taskRepository.findRunningTasksOrderedByPriorityDesc();
        
        for (Task runningTask : runningTasks) {
            if (isHigherPriority(highPriorityTask.getPriority(), runningTask.getPriority())) {
                performPreemption(highPriorityTask, runningTask);
                return;
            }
        }
    }

    private boolean canPreemptNow() {
        LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
        long preemptionsInLastHour = preemptionRecordRepository.countPreemptionsSince(oneHourAgo);
        return preemptionsInLastHour < maxPreemptionsPerHour;
    }

    private boolean isHigherPriority(TaskPriority p1, TaskPriority p2) {
        return p1.getLevel() < p2.getLevel();
    }

    @Transactional
    public void performPreemption(Task preemptingTask, Task preemptedTask) {
        TaskStatus previousPreemptedStatus = preemptedTask.getStatus();
        
        Integer slotNumber = preemptedTask.getExecutionSlot();
        
        executionSlotService.releaseSlot(slotNumber);
        
        preemptedTask.setStatus(TaskStatus.PREEMPTED);
        preemptedTask.setExecutionSlot(null);
        taskRepository.save(preemptedTask);
        
        scheduleLogService.logStatusChange(preemptedTask, previousPreemptedStatus, TaskStatus.PREEMPTED,
                "被高优先级任务 " + preemptingTask.getTaskId() + " 抢占", preemptingTask.getHandler());
        
        PreemptionRecord record = PreemptionRecord.builder()
                .preemptedTaskId(preemptedTask.getId())
                .preemptedTaskName(preemptedTask.getTaskName())
                .preemptedPriority(preemptedTask.getPriority())
                .preemptingTaskId(preemptingTask.getId())
                .preemptingTaskName(preemptingTask.getTaskName())
                .preemptingPriority(preemptingTask.getPriority())
                .executionSlot(slotNumber)
                .reason("高优先级任务抢占")
                .build();
        preemptionRecordRepository.save(record);
        
        Optional<ExecutionSlot> slot = executionSlotService.getAvailableSlot();
        slot.ifPresent(executionSlot -> dispatchTaskToSlot(preemptingTask, executionSlot));
        
        log.info("抢占完成 - 被抢占任务: {}, 抢占任务: {}", preemptedTask.getTaskId(), preemptingTask.getTaskId());
    }

    @Transactional
    public void completeTask(Task task, String result, String operator) {
        if (task.getStatus() != TaskStatus.RUNNING) {
            throw new InvalidTaskStateException("只有运行中的任务才能完成");
        }

        TaskStatus previousStatus = task.getStatus();
        Integer slotNumber = task.getExecutionSlot();
        
        if (slotNumber != null) {
            executionSlotService.releaseSlot(slotNumber);
        }
        
        task.setStatus(TaskStatus.COMPLETED);
        task.setCompletedAt(LocalDateTime.now());
        task.setResult(result);
        
        if (task.getStartedAt() != null) {
            Duration executionDuration = Duration.between(task.getStartedAt(), LocalDateTime.now());
            task.setExecutionDurationSeconds(executionDuration.getSeconds());
        }
        
        task.setExecutionSlot(null);
        taskRepository.save(task);
        
        scheduleLogService.logStatusChange(task, previousStatus, TaskStatus.COMPLETED,
                "任务执行完成", operator);
        
        log.info("任务完成 - taskId: {}", task.getTaskId());
        
        tryDispatchTasks();
    }

    @Transactional
    public void cancelTask(Task task, String reason, String operator) {
        if (task.getStatus() == TaskStatus.COMPLETED || task.getStatus() == TaskStatus.CANCELLED) {
            throw new InvalidTaskStateException("任务已完成或已取消，无法撤销");
        }

        TaskStatus previousStatus = task.getStatus();
        Integer slotNumber = task.getExecutionSlot();
        
        if (slotNumber != null && task.getStatus() == TaskStatus.RUNNING) {
            executionSlotService.releaseSlot(slotNumber);
        }
        
        task.setStatus(TaskStatus.CANCELLED);
        task.setCompletedAt(LocalDateTime.now());
        task.setResult("取消原因: " + reason);
        task.setExecutionSlot(null);
        taskRepository.save(task);
        
        scheduleLogService.logStatusChange(task, previousStatus, TaskStatus.CANCELLED, reason, operator);
        
        log.info("任务已取消 - taskId: {}, 原因: {}", task.getTaskId(), reason);
        
        tryDispatchTasks();
    }

    public List<PreemptionRecord> getAllPreemptionRecords() {
        return preemptionRecordRepository.findAllByOrderByPreemptedAtDesc();
    }

    public Double getAverageWaitTime() {
        return taskRepository.calculateAverageWaitTime();
    }
}
