package com.batchqueue.service;

import com.batchqueue.model.dto.TaskResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {
    private final TaskService taskService;

    public byte[] exportTasksToJson() throws Exception {
        List<TaskResponse> tasks = taskService.getAllTasks();
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(tasks);
    }

    public byte[] exportTasksToCsv() throws Exception {
        List<TaskResponse> tasks = taskService.getAllTasks();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintWriter writer = new PrintWriter(out);

        String[] headers = {
                "任务ID", "任务名称", "任务类型", "优先级", "状态", 
                "处理人", "执行槽位", "创建时间", "排队时间", 
                "开始时间", "完成时间", "等待时长(秒)", "执行时长(秒)", "结果"
        };
        
        writer.println(String.join(",", headers));

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        
        for (TaskResponse task : tasks) {
            String[] row = {
                    escapeCsv(task.getTaskId()),
                    escapeCsv(task.getTaskName()),
                    escapeCsv(task.getTaskType() != null ? task.getTaskType().name() : ""),
                    escapeCsv(task.getPriority() != null ? task.getPriority().name() : ""),
                    escapeCsv(task.getStatus() != null ? task.getStatus().name() : ""),
                    escapeCsv(task.getHandler()),
                    task.getExecutionSlot() != null ? String.valueOf(task.getExecutionSlot()) : "",
                    task.getCreatedAt() != null ? task.getCreatedAt().format(formatter) : "",
                    task.getQueuedAt() != null ? task.getQueuedAt().format(formatter) : "",
                    task.getStartedAt() != null ? task.getStartedAt().format(formatter) : "",
                    task.getCompletedAt() != null ? task.getCompletedAt().format(formatter) : "",
                    task.getWaitDurationSeconds() != null ? String.valueOf(task.getWaitDurationSeconds()) : "",
                    task.getExecutionDurationSeconds() != null ? String.valueOf(task.getExecutionDurationSeconds()) : "",
                    escapeCsv(task.getResult())
            };
            writer.println(String.join(",", row));
        }
        
        writer.flush();
        return out.toByteArray();
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
