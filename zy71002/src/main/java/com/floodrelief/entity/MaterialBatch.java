package com.floodrelief.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "material_batch")
public class MaterialBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String batchNo;

    @Column(nullable = false)
    private String materialType;

    @Column(nullable = false)
    private String materialName;

    private String specification;

    @Column(nullable = false)
    private Integer quantity;

    private String unit;

    private String source;

    private LocalDateTime productionDate;

    private LocalDateTime expiryDate;

    private String storageLocation;

    private String operator;

    @Column(length = 1000)
    private String remark;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
