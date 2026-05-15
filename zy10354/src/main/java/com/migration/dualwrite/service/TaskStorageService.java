package com.migration.dualwrite.service;

import com.migration.dualwrite.constant.ErrorCode;
import com.migration.dualwrite.dto.MigrationTask;
import com.migration.dualwrite.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskStorageService {

    private final FileStorageService fileStorageService;

    public void saveTask(MigrationTask task) {
        fileStorageService.saveTask(task);
        log.info("任务已保存: taskId={}, status={}", task.getTaskId(), task.getStatus());
    }

    public MigrationTask getTask(String taskId) {
        MigrationTask task = fileStorageService.getTask(taskId);
        if (task == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "任务不存在: " + taskId);
        }
        return task;
    }

    public List<MigrationTask> getAllTasks() {
        return fileStorageService.getAllTasks();
    }

    public List<MigrationTask> getTasksByInterfaceName(String interfaceName) {
        return fileStorageService.getAllTasks().stream()
                .filter(task -> interfaceName.equals(task.getInterfaceName()))
                .collect(java.util.stream.Collectors.toList());
    }

    public boolean exists(String taskId) {
        return fileStorageService.exists(taskId);
    }

    public void clearAll() {
        fileStorageService.clearAll();
        log.info("所有任务已清除");
    }

    public void deleteTask(String taskId) {
        fileStorageService.deleteTask(taskId);
        log.info("任务已删除: taskId={}", taskId);
    }
}
