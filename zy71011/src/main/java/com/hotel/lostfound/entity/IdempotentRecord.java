package com.hotel.lostfound.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "idempotent_records")
public class IdempotentRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 100)
    private String requestId;

    @Column(nullable = false, length = 100)
    private String operationType;

    @Column(length = 500)
    private String responseData;

    private boolean success;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
