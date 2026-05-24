package com.floodrelief.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "special_need")
public class SpecialNeed {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long shelterId;

    @Column(nullable = false)
    private String needType;

    @Column(nullable = false)
    private String needName;

    private Integer quantity;

    private String unit;

    @Column(length = 2000)
    private String description;

    private String reporter;

    private String status;

    @Column(length = 1000)
    private String evidenceUrl;

    @Column(length = 1000)
    private String remark;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
