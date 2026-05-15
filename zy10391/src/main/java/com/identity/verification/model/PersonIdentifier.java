package com.identity.verification.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "person_identifier")
public class PersonIdentifier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "source_code", nullable = false, length = 50)
    private String sourceCode;

    @Column(name = "id_type", nullable = false, length = 50)
    private String idType;

    @Column(name = "id_value", nullable = false, length = 200)
    private String idValue;

    @Column(length = 200)
    private String name;

    @Column(length = 10)
    private String gender;

    @Column(name = "birth_date")
    private String birthDate;

    @Column(length = 500)
    private String address;

    @Column(name = "phone_number", length = 50)
    private String phoneNumber;

    @Column(length = 200)
    private String email;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
