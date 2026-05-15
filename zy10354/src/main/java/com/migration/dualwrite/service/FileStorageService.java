package com.migration.dualwrite.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.migration.dualwrite.dto.MigrationTask;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class FileStorageService {

    @Value("${storage.data-dir:./data}")
    private String dataDir;

    private final ObjectMapper objectMapper;
    private final Map<String, MigrationTask> taskCache = new ConcurrentHashMap<>();

    public FileStorageService() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    @PostConstruct
    public void init() {
        try {
            Path path = Paths.get(dataDir);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
                log.info("数据目录已创建: {}", dataDir);
            }
            loadAllTasks();
        } catch (IOException e) {
            log.error("初始化数据目录失败", e);
        }
    }

    public void saveTask(MigrationTask task) {
        taskCache.put(task.getTaskId(), task);
        try {
            File file = getTaskFile(task.getTaskId());
            objectMapper.writeValue(file, task);
            log.debug("任务已持久化到文件: {}", file.getAbsolutePath());
        } catch (IOException e) {
            log.error("保存任务到文件失败: taskId={}", task.getTaskId(), e);
        }
    }

    public MigrationTask getTask(String taskId) {
        MigrationTask task = taskCache.get(taskId);
        if (task == null) {
            task = loadTaskFromFile(taskId);
            if (task != null) {
                taskCache.put(taskId, task);
            }
        }
        return task;
    }

    public List<MigrationTask> getAllTasks() {
        return new ArrayList<>(taskCache.values());
    }

    public boolean exists(String taskId) {
        return taskCache.containsKey(taskId) || getTaskFile(taskId).exists();
    }

    public void deleteTask(String taskId) {
        taskCache.remove(taskId);
        File file = getTaskFile(taskId);
        if (file.exists()) {
            file.delete();
        }
    }

    public void clearAll() {
        taskCache.clear();
        File dir = new File(dataDir);
        File[] files = dir.listFiles((d, name) -> name.endsWith(".json"));
        if (files != null) {
            for (File file : files) {
                file.delete();
            }
        }
    }

    private void loadAllTasks() {
        File dir = new File(dataDir);
        File[] files = dir.listFiles((d, name) -> name.endsWith(".json"));
        if (files != null) {
            for (File file : files) {
                try {
                    MigrationTask task = objectMapper.readValue(file, MigrationTask.class);
                    taskCache.put(task.getTaskId(), task);
                    log.debug("加载任务文件: {}", file.getName());
                } catch (IOException e) {
                    log.warn("加载任务文件失败: {}", file.getName(), e);
                }
            }
        }
        log.info("已从磁盘加载 {} 个任务", taskCache.size());
    }

    private MigrationTask loadTaskFromFile(String taskId) {
        File file = getTaskFile(taskId);
        if (!file.exists()) {
            return null;
        }
        try {
            return objectMapper.readValue(file, MigrationTask.class);
        } catch (IOException e) {
            log.error("从文件加载任务失败: taskId={}", taskId, e);
            return null;
        }
    }

    private File getTaskFile(String taskId) {
        return new File(dataDir, "task_" + taskId + ".json");
    }

    public String exportAllTasksAsJson() {
        try {
            return objectMapper.writeValueAsString(new ArrayList<>(taskCache.values()));
        } catch (IOException e) {
            log.error("导出任务为JSON失败", e);
            return "[]";
        }
    }

    public Path getDataDirPath() {
        return Paths.get(dataDir);
    }
}
