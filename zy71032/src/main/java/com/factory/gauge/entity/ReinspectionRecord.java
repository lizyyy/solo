package com.factory.gauge.entity;

import com.factory.gauge.entity.enums.ReinspectionResult;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "reinspection_record", indexes = {
    @Index(name = "idx_reinspect_batch_id", columnList = "batchId"),
    @Index(name = "idx_reinspect_tool_id", columnList = "toolId"),
    @Index(name = "idx_reinspect_result", columnList = "result")
})
public class ReinspectionRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long batchId;

    @Column(length = 50)
    private String batchNo;

    @Column(nullable = false)
    private Long toolId;

    @Column(length = 50)
    private String toolNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ReinspectionResult result;

    @Column(length = 2000)
    private String inspectionDetail;

    @Column(length = 500)
    private String defectDescription;

    @Column(nullable = false, length = 100)
    private String inspector;

    @Column(length = 100)
    private String correctedBy;

    private LocalDateTime correctionTime;

    @Column(length = 500)
    private String correctionRemark;

    @Column(nullable = false)
    private Boolean isCorrected = false;

    @Column(length = 500)
    private String remarks;

    @Column(length = 100)
    private String createdBy;

    @Column(length = 100)
    private String updatedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Integer version;
}
