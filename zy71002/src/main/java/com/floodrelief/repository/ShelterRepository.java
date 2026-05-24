package com.floodrelief.repository;

import com.floodrelief.entity.Shelter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShelterRepository extends JpaRepository<Shelter, Long> {
    Optional<Shelter> findByCode(String code);
    List<Shelter> findByActiveTrue();
}
