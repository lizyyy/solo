package com.privacy.replay.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "user_samples")
public class UserSample {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String sampleId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String dataType;

    @Column(columnDefinition = "TEXT")
    private String sampleData;

    @Column(nullable = false)
    private Integer sensitivityScore;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime expiredAt;

    @Column(nullable = false)
    private Boolean isActive = true;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
