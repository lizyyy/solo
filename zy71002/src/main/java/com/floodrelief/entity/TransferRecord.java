package com.floodrelief.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "transfer_record")
public class TransferRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long shelterId;

    @Column(nullable = false)
    private Integer totalCount;

    private Integer elderlyCount;

    private Integer childrenCount;

    private Integer disabledCount;

    private String reporter;

    @Column(length = 1000)
    private String remark;

    private Boolean manualCorrection = false;

    private String correctedBy;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
