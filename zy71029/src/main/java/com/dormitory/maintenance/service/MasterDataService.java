package com.dormitory.maintenance.service;

import com.dormitory.maintenance.entity.ConstructionTeam;
import com.dormitory.maintenance.entity.DormBuilding;
import com.dormitory.maintenance.entity.QuietPeriod;
import com.dormitory.maintenance.repository.ConstructionTeamRepository;
import com.dormitory.maintenance.repository.DormBuildingRepository;
import com.dormitory.maintenance.repository.QuietPeriodRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MasterDataService {

    @Autowired
    private DormBuildingRepository buildingRepository;

    @Autowired
    private ConstructionTeamRepository teamRepository;

    @Autowired
    private QuietPeriodRepository quietPeriodRepository;

    public DormBuilding createBuilding(DormBuilding building) {
        if (buildingRepository.existsByBuildingCode(building.getBuildingCode())) {
            throw new IllegalArgumentException("宿舍楼编号已存在");
        }
        return buildingRepository.save(building);
    }

    public DormBuilding updateBuilding(Long id, DormBuilding building) {
        DormBuilding existing = buildingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("宿舍楼不存在"));
        building.setId(id);
        return buildingRepository.save(building);
    }

    public DormBuilding getBuilding(Long id) {
        return buildingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("宿舍楼不存在"));
    }

    public DormBuilding getBuildingByCode(String code) {
        return buildingRepository.findByBuildingCode(code)
                .orElseThrow(() -> new IllegalArgumentException("宿舍楼不存在"));
    }

    public List<DormBuilding> getAllBuildings() {
        return buildingRepository.findByActiveTrue();
    }

    public ConstructionTeam createTeam(ConstructionTeam team) {
        if (teamRepository.existsByTeamCode(team.getTeamCode())) {
            throw new IllegalArgumentException("施工队编号已存在");
        }
        return teamRepository.save(team);
    }

    public ConstructionTeam updateTeam(Long id, ConstructionTeam team) {
        ConstructionTeam existing = teamRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("施工队不存在"));
        team.setId(id);
        return teamRepository.save(team);
    }

    public ConstructionTeam getTeam(Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("施工队不存在"));
    }

    public ConstructionTeam getTeamByCode(String code) {
        return teamRepository.findByTeamCode(code)
                .orElseThrow(() -> new IllegalArgumentException("施工队不存在"));
    }

    public List<ConstructionTeam> getAllTeams() {
        return teamRepository.findByActiveTrue();
    }

    public QuietPeriod createQuietPeriod(QuietPeriod period) {
        return quietPeriodRepository.save(period);
    }

    public QuietPeriod updateQuietPeriod(Long id, QuietPeriod period) {
        QuietPeriod existing = quietPeriodRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("静音时段不存在"));
        period.setId(id);
        return quietPeriodRepository.save(period);
    }

    public void deleteQuietPeriod(Long id) {
        quietPeriodRepository.deleteById(id);
    }

    public QuietPeriod getQuietPeriod(Long id) {
        return quietPeriodRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("静音时段不存在"));
    }

    public List<QuietPeriod> getAllQuietPeriods() {
        return quietPeriodRepository.findByActiveTrue();
    }
}
