package com.hazardous.waste.entity;

import com.hazardous.waste.enums.WasteStatus;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "waste_record")
public class WasteRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String recordNo;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String wasteName;

    @Column(nullable = false)
    private Double weight;

    private String component;

    private String hazardCharacteristics;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bucket_id")
    private StorageBucket bucket;

    @Column(nullable = false)
    private LocalDateTime inTime;

    private LocalDateTime outTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WasteStatus status;

    private String transferFormNo;

    private String receiver;

    private LocalDateTime receiveTime;

    @Column(length = 2000)
    private String disposalReason;

    @Column(length = 2000)
    private String checkResult;

    private Boolean isOverdue;

    private Integer storageDays;

    private String submitter;

    private String reviewer;

    private LocalDateTime reviewTime;

    @Column(length = 2000)
    private String reviewComment;

    private String returnReason;

    private Integer resubmitCount;

    @ElementCollection
    @CollectionTable(name = "waste_operation_log", joinColumns = @JoinColumn(name = "record_id"))
    private List<OperationLog> operationLogs = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = WasteStatus.PENDING_SUBMIT;
        if (isOverdue == null) isOverdue = false;
        if (resubmitCount == null) resubmitCount = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    @Embeddable
    @Data
    public static class OperationLog {
        private String operation;
        private String operator;
        private LocalDateTime operateTime;
        private String remark;

        public OperationLog() {}

        public OperationLog(String operation, String operator, String remark) {
            this.operation = operation;
            this.operator = operator;
            this.operateTime = LocalDateTime.now();
            this.remark = remark;
        }
    }
}
