package com.migration.dualwrite.dto;

import com.migration.dualwrite.enums.TaskStatus;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class MigrationTask {
    private String taskId;
    private String interfaceName;
    private String businessKey;
    private TaskStatus status;
    private String statusDesc;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String remark;

    private DataSourceConfig oldDataSource;
    private DataSourceConfig newDataSource;
    private List<MigrationField> fields;
    private Map<String, Object> writeData;

    private WriteResult oldWriteResult;
    private WriteResult newWriteResult;

    private List<FieldDiff> diffs;
    private Integer diffCount;
    private Boolean diffPassed;

    private SwitchConclusion switchConclusion;
    private RollbackRecord rollbackRecord;

    private String errorCode;
    private String errorMessage;
    private List<String> errorDetails;

    public void addErrorDetail(String detail) {
        if (this.errorDetails == null) {
            this.errorDetails = new ArrayList<>();
        }
        this.errorDetails.add(detail);
    }
}
