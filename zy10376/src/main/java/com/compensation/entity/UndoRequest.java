package com.compensation.entity;

import com.compensation.enums.RequestStatus;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "undo_request")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UndoRequest {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false, length = 64)
    private String requestId;
    
    @Column(nullable = false, length = 128)
    private String businessType;
    
    @Column(length = 512)
    private String businessKey;
    
    @Column(length = 1024)
    private String description;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private RequestStatus status;
    
    @Column(length = 2048)
    private String requestData;
    
    private Integer retryCount;
    
    private Integer maxRetry;
    
    private LocalDateTime expireTime;
    
    @Column(length = 2048)
    private String callbackUrl;
    
    @OneToMany(mappedBy = "undoRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ExecutedAction> executedActions = new ArrayList<>();
    
    @OneToMany(mappedBy = "undoRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CompensationTask> compensationTasks = new ArrayList<>();
    
    @OneToOne(mappedBy = "undoRequest", cascade = CascadeType.ALL)
    private CompletionProof completionProof;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (retryCount == null) retryCount = 0;
        if (maxRetry == null) maxRetry = 3;
        if (status == null) status = RequestStatus.CREATED;
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
