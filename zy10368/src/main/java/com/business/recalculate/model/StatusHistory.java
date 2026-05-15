package com.business.recalculate.model;

import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "status_history")
public class StatusHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long batchId;

    @Column(nullable = false)
    private String batchNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecalculateStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecalculateStatus currentStatus;

    @Column(length = 2000)
    private String remark;

    private String operator;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
