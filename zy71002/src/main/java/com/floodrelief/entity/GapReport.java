package com.floodrelief.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "gap_report")
public class GapReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long shelterId;

    @Column(nullable = false)
    private String materialType;

    @Column(nullable = false)
    private String materialName;

    private Integer requiredQuantity;

    private Integer currentQuantity;

    private Integer gapQuantity;

    private String unit;

    private String priority;

    @Column(length = 2000)
    private String reason;

    private String reporter;

    private String status;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime reportedAt;
}
