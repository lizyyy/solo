package com.package.repo.repository;

import com.package.repo.model.entity.PackageVersion;
import com.package.repo.model.enums.PackageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PackageVersionRepository extends JpaRepository<PackageVersion, Long> {

    Optional<PackageVersion> findByPackageNameAndVersionAndDeletedFalse(String packageName, String version);

    List<PackageVersion> findByPackageNameAndDeletedFalseOrderByPublishTimeDesc(String packageName);

    List<PackageVersion> findByStatusAndDeletedFalse(PackageStatus status);

    List<PackageVersion> findByPublisherAndDeletedFalse(String publisher);

    @Query("SELECT p FROM PackageVersion p WHERE p.deleted = false ORDER BY p.publishTime DESC")
    List<PackageVersion> findAllActive();

    @Query("SELECT p FROM PackageVersion p WHERE p.deleted = false AND p.packageName LIKE %:keyword% ORDER BY p.publishTime DESC")
    List<PackageVersion> searchByKeyword(@Param("keyword") String keyword);

    boolean existsByPackageNameAndVersionAndDeletedFalse(String packageName, String version);
}
