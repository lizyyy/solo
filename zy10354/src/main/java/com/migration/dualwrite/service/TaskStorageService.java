package com.migration.dualwrite.service;

import com.migration.dualwrite.constant.ErrorCode;
import com.migration.dualwrite.dto.MigrationTask;
import com.migration.dualwrite.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class TaskStorageService {
    private final Map<String, MigrationTask> taskStorage = new ConcurrentHashMap<>();

    public void saveTask(MigrationTask task) {
        taskStorage.put(task.getTaskId(), task);
        log.info("任务已保存: taskId={}, status={}", task.getTaskId(), task.getStatus());
    }

    public MigrationTask getTask(String taskId) {
        MigrationTask task = taskStorage.get(taskId);
        if (task == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "任务不存在: " + taskId);
        }
        return task;
    }

    public List<MigrationTask> getAllTasks() {
        return new ArrayList<>(taskStorage.values());
    }

    public List<MigrationTask> getTasksByInterfaceName(String interfaceName) {
        return taskStorage.values().stream()
                .filter(task -> interfaceName.equals(task.getInterfaceName()))
                .toList();
    }

    public boolean exists(String taskId) {
        return taskStorage.containsKey(taskId);
    }

    public void clearAll() {
        taskStorage.clear();
    }
}
