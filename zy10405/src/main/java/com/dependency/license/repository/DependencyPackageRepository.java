package com.dependency.license.repository;

import com.dependency.license.model.DependencyPackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DependencyPackageRepository extends JpaRepository<DependencyPackage, Long> {
    Optional<DependencyPackage> findByGroupIdAndArtifactId(String groupId, String artifactId);
    List<DependencyPackage> findByNameContaining(String name);
    List<DependencyPackage> findByCategory(String category);
}