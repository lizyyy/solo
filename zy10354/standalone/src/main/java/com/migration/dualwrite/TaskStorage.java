package com.migration.dualwrite;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * 任务持久化存储
 * 使用文件系统持久化
 * 零依赖
 */
public class TaskStorage {

    private static final String DATA_DIR = "./data";
    private static final String TASK_FILE_PREFIX = "task_";
    private static final String TASK_FILE_SUFFIX = ".json";

    public TaskStorage() {
        new File(DATA_DIR).mkdirs();
    }

    public void saveTask(Map<String, Object> task) {
        String taskId = (String) task.get("taskId");
        String filename = TASK_FILE_PREFIX + taskId + TASK_FILE_SUFFIX;
        File file = new File(DATA_DIR, filename);

        try (FileWriter writer = new FileWriter(file, StandardCharsets.UTF_8)) {
            writer.write(JsonUtil.toJson(task));
        } catch (IOException e) {
            throw new RuntimeException("Failed to save task: " + taskId, e);
        }
    }

    public Map<String, Object> getTask(String taskId) {
        String filename = TASK_FILE_PREFIX + taskId + TASK_FILE_SUFFIX;
        File file = new File(DATA_DIR, filename);

        if (!file.exists()) {
            return null;
        }

        try {
            String json = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
            return JsonUtil.parseJson(json);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load task: " + taskId, e);
        }
    }

    public List<Map<String, Object>> getAllTasks() {
        List<Map<String, Object>> tasks = new ArrayList<>();
        File dir = new File(DATA_DIR);
        File[] files = dir.listFiles((d, name) -> name.startsWith(TASK_FILE_PREFIX) && name.endsWith(TASK_FILE_SUFFIX));

        if (files == null) {
            return tasks;
        }

        for (File file : files) {
            try {
                String json = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
                Map<String, Object> task = JsonUtil.parseJson(json);
                tasks.add(task);
            } catch (IOException e) {
                // Skip invalid files
            }
        }

        return tasks;
    }

    public boolean exists(String taskId) {
        String filename = TASK_FILE_PREFIX + taskId + TASK_FILE_SUFFIX;
        return new File(DATA_DIR, filename).exists();
    }

    public void clearAll() {
        File dir = new File(DATA_DIR);
        File[] files = dir.listFiles((d, name) -> name.startsWith(TASK_FILE_PREFIX) && name.endsWith(TASK_FILE_SUFFIX));
        if (files != null) {
            for (File file : files) {
                file.delete();
            }
        }
    }

    public int count() {
        File dir = new File(DATA_DIR);
        File[] files = dir.listFiles((d, name) -> name.startsWith(TASK_FILE_PREFIX) && name.endsWith(TASK_FILE_SUFFIX));
        return files != null ? files.length : 0;
    }
}
