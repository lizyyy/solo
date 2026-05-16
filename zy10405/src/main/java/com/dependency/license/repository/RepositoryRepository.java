package com.dependency.license.repository;

import com.dependency.license.model.Repository;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RepositoryRepository extends JpaRepository<Repository, Long> {
    Optional<Repository> findByName(String name);
    List<Repository> findByMaintainer(String maintainer);
    List<Repository> findByDepartment(String department);
    List<Repository> findByIsActiveTrue();
}