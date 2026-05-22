package com.tea.compensation.dto;

import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.enums.TaskType;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskQueryDTO {
    private String batchNo;
    private String storeId;
    private String storeName;
    private TaskType taskType;
    private List<TaskStatus> statuses;
    private String submitter;
    private String currentHandler;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Boolean hasRetryable;
    private int pageNum = 1;
    private int pageSize = 20;
}
