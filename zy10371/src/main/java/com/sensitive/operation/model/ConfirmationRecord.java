package com.sensitive.operation.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "confirmation_records")
public class ConfirmationRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String operationId;

    @Column(nullable = false)
    private String confirmerId;

    @Column(nullable = false)
    private String confirmerName;

    @Column(nullable = false)
    private LocalDateTime confirmedAt;

    private String comment;
}
