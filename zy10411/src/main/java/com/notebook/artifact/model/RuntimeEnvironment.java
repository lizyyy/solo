package com.notebook.artifact.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "runtime_environments")
public class RuntimeEnvironment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String pythonVersion;

    @Column
    private String notebookKernel;

    @Column(length = 2000)
    private String dependencies;

    @Column
    private String osInfo;

    @Column
    private String hardwareInfo;

    @Column
    private String environmentHash;
}
