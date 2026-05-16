package com.promptversion.entity;

import lombok.Data;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "hit_record")
public class HitRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long templateId;

    @Column(nullable = false)
    private Long versionId;

    @Column(nullable = false)
    private String requestId;

    @Column(nullable = false)
    private String userId;

    private String modelName;

    @Column(length = 1000)
    private String hitReason;

    @Column(nullable = false)
    private LocalDateTime hitTime;

    private Long latencyMs;

    @PrePersist
    protected void onCreate() {
        hitTime = LocalDateTime.now();
    }
}