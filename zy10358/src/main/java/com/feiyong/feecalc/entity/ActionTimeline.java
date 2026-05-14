package com.feiyong.feecalc.entity;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "action_timeline")
public class ActionTimeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String requestNo;

    @Column(nullable = false, length = 64)
    private String action;

    @Column(length = 128)
    private String actionDesc;

    @Column(length = 2048)
    private String beforeData;

    @Column(length = 2048)
    private String afterData;

    @Column(length = 64)
    private String operator;

    @Column(nullable = false)
    private LocalDateTime actionTime;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (actionTime == null) {
            actionTime = LocalDateTime.now();
        }
    }
}
