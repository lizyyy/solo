package com.package.repo.repository;

import com.package.repo.model.entity.DependencyProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DependencyProjectRepository extends JpaRepository<DependencyProject, Long> {

    @Query("SELECT d FROM DependencyProject d JOIN d.packageVersion p WHERE p.packageName = :packageName AND p.version = :version AND d.isActive = true")
    List<DependencyProject> findActiveByPackageNameAndVersion(String packageName, String version);

    List<DependencyProject> findByProjectName(String projectName);

    @Query("SELECT COUNT(d) FROM DependencyProject d JOIN d.packageVersion p WHERE p.packageName = :packageName AND p.version = :version AND d.isActive = true")
    int countActiveDependencies(String packageName, String version);
}
