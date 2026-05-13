package com.batchqueue.service;

import com.batchqueue.model.entity.ScheduleLog;
import com.batchqueue.model.entity.Task;
import com.batchqueue.model.enums.TaskStatus;
import com.batchqueue.repository.ScheduleLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleLogService {
    private final ScheduleLogRepository scheduleLogRepository;

    @Transactional
    public void logStatusChange(Task task, TaskStatus previousStatus, TaskStatus newStatus, 
                                String message, String operator) {
        ScheduleLog logEntry = ScheduleLog.builder()
                .taskId(task.getId())
                .taskName(task.getTaskName())
                .previousStatus(previousStatus)
                .newStatus(newStatus)
                .message(message)
                .operator(operator)
                .build();
        scheduleLogRepository.save(logEntry);
        log.info("任务状态变更 - taskId: {}, 从 {} 变为 {}, 原因: {}", 
                task.getTaskId(), previousStatus, newStatus, message);
    }

    public List<ScheduleLog> getTaskLogs(Long taskId) {
        return scheduleLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    public List<ScheduleLog> getAllLogs() {
        return scheduleLogRepository.findAllByOrderByCreatedAtDesc();
    }
}
