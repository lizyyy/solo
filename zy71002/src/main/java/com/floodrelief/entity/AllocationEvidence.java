package com.floodrelief.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "allocation_evidence")
public class AllocationEvidence {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long allocationId;

    @Column(nullable = false)
    private String evidenceType;

    @Column(length = 1000)
    private String evidenceUrl;

    @Column(length = 2000)
    private String description;

    private String uploader;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
