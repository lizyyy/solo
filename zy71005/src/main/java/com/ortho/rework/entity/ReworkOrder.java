package com.ortho.rework.entity;

import com.ortho.rework.enums.ReworkStatus;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "rework_orders")
public class ReworkOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private ImpressionBatch batch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReworkStatus status;

    @Column(length = 2000)
    private String reworkReason;

    @Column(length = 2000)
    private String technicianNote;

    @Column(length = 2000)
    private String doctorNote;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
