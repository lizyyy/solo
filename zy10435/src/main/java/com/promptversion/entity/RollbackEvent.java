package com.promptversion.entity;

import com.promptversion.enums.RollbackType;
import lombok.Data;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "rollback_event")
public class RollbackEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long templateId;

    @Column(nullable = false)
    private Long versionId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private RollbackType rollbackType;

    @Column(nullable = false)
    private String operator;

    @Column(length = 2000)
    private String reason;

    private Long previousVersionId;

    @Column(nullable = false)
    private LocalDateTime rollbackTime;

    @Column(nullable = false)
    private Boolean processed = false;

    @PrePersist
    protected void onCreate() {
        rollbackTime = LocalDateTime.now();
    }
}