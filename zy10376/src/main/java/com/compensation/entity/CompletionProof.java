package com.compensation.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "completion_proof")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompletionProof {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false, length = 64)
    private String proofId;
    
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false, unique = true)
    private UndoRequest undoRequest;
    
    @Column(nullable = false, length = 32)
    private String proofType;
    
    @Column(nullable = false, length = 64)
    private String proofHash;
    
    @Column(length = 4096)
    private String proofContent;
    
    @Column(length = 2048)
    private String summary;
    
    private Integer totalActions;
    
    private Integer successActions;
    
    private Integer failedActions;
    
    private Integer compensatedActions;
    
    private Integer totalTasks;
    
    private Integer successTasks;
    
    private Integer failedTasks;
    
    @Column(length = 128)
    private String generatedBy;
    
    @Column(nullable = false)
    private LocalDateTime generatedAt;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (generatedAt == null) generatedAt = LocalDateTime.now();
    }
}
