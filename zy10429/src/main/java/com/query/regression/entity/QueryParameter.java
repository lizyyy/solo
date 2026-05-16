package com.query.regression.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "query_parameters")
public class QueryParameter {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long regressionRecordId;

    @Column(nullable = false, length = 255)
    private String paramKey;

    @Column(columnDefinition = "TEXT")
    private String paramValue;

    @Column(length = 50)
    private String paramType;

    @Column(nullable = false)
    private Boolean normalized;

    @Column
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
