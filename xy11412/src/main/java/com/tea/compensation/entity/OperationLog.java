package com.tea.compensation.entity;

import com.tea.compensation.enums.OperationType;
import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.enums.TaskType;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "operation_log", indexes = {
    @Index(name = "idx_task_id", columnList = "taskId"),
    @Index(name = "idx_batch_no", columnList = "batchNo"),
    @Index(name = "idx_operator", columnList = "operator"),
    @Index(name = "idx_operation_type", columnList = "operationType"),
    @Index(name = "idx_operation_time", columnList = "operationTime")
})
public class OperationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long taskId;

    @Column(length = 64)
    private String batchNo;

    @Column(length = 32)
    private String storeId;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private TaskType taskType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OperationType operationType;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private TaskStatus beforeStatus;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private TaskStatus afterStatus;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String beforeContent;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String afterContent;

    @Column(length = 2000)
    private String changeSummary;

    @Column(nullable = false, length = 64)
    private String operator;

    @Column(length = 100)
    private String operatorName;

    @Column(length = 500)
    private String remark;

    @Column(nullable = false)
    private LocalDateTime operationTime;

    @Column(length = 128)
    private String ipAddress;

    @Column(length = 256)
    private String userAgent;
}
