package com.dormitory.maintenance.repository;

import com.dormitory.maintenance.entity.ConstructionTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConstructionTeamRepository extends JpaRepository<ConstructionTeam, Long> {
    Optional<ConstructionTeam> findByTeamCode(String teamCode);
    List<ConstructionTeam> findByActiveTrue();
    boolean existsByTeamCode(String teamCode);
}
