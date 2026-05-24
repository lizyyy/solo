package com.hazardous.waste.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "storage_bucket")
public class StorageBucket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String bucketCode;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private Double maxCapacity;

    @Column(nullable = false)
    private Double currentCapacity;

    @Column(nullable = false)
    private Boolean isActive;

    private String location;

    private String remark;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (isActive == null) isActive = true;
        if (currentCapacity == null) currentCapacity = 0.0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
