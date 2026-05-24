package com.hazardous.waste.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "disposal_report")
public class DisposalReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String reportNo;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private Double totalWeight;

    @Column(nullable = false)
    private Integer wasteCount;

    private String transferFormNo;

    private String disposalCompany;

    private String disposalMethod;

    private LocalDateTime disposalTime;

    private String disposalResult;

    @Column(length = 3000)
    private String disposalReason;

    @Column(length = 3000)
    private String checkDetail;

    private String reporter;

    private String approver;

    private LocalDateTime approveTime;

    @Column(nullable = false)
    private Boolean isApproved;

    @Column(length = 2000)
    private String remark;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (isApproved == null) isApproved = false;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
