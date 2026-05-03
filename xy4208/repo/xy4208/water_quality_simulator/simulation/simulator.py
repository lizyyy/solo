from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from uuid import uuid4

from ..models import (
    PondConfig,
    PondState,
    WaterQualityParams,
    SimulationParams,
    Scenario,
    WaterChangePlan,
    AerationPlan,
    ProbioticsPlan,
    SimulationResult,
)
from .water_quality_model import WaterQualityModel, WaterQualityState


class WaterQualitySimulator:
    def __init__(self, pond_config: PondConfig):
        self.pond_config = pond_config
        self.model = WaterQualityModel(pond_config)

    def _create_initial_state(
        self,
        initial_params: WaterQualityParams,
        start_time: datetime,
    ) -> WaterQualityState:
        return WaterQualityState(
            timestamp=start_time,
            temperature=initial_params.temperature,
            ph=initial_params.ph,
            ammonia_nitrogen=initial_params.ammonia_nitrogen,
            nitrite=initial_params.nitrite,
            nitrate=initial_params.nitrite * 0.5,
            salinity=initial_params.salinity,
            dissolved_oxygen=initial_params.dissolved_oxygen,
            turbidity=initial_params.turbidity,
            alkalinity=initial_params.alkalinity,
            hardness=initial_params.hardness,
        )

    def _get_active_actions_at_time(
        self,
        current_time: datetime,
        scenario: Optional[Scenario],
        base_params: SimulationParams,
    ) -> Dict[str, Any]:
        actions: Dict[str, Any] = {
            "water_exchange": {"rate": base_params.water_exchange_rate},
            "aeration": {"rate": base_params.aeration_rate},
            "probiotics": {
                "dosage": 0,
                "efficiency": base_params.probiotics_efficiency,
            },
        }

        if scenario is None:
            return actions

        for wc_plan in scenario.water_change_plans:
            if wc_plan.start_time <= current_time < wc_plan.get_end_time():
                actions["water_exchange"]["rate"] = max(
                    actions["water_exchange"]["rate"],
                    wc_plan.exchange_rate,
                )
                actions["water_exchange"]["plan_id"] = wc_plan.plan_id

        for aer_plan in scenario.aeration_plans:
            if aer_plan.start_time <= current_time < aer_plan.get_end_time():
                actions["aeration"]["rate"] = max(
                    actions["aeration"]["rate"],
                    aer_plan.aeration_rate,
                )
                actions["aeration"]["plan_id"] = aer_plan.plan_id

        for prob_plan in scenario.probiotics_plans:
            hours_since_apply = (current_time - prob_plan.application_time).total_seconds() / 3600
            if 0 <= hours_since_apply < 72:
                actions["probiotics"]["dosage"] = prob_plan.dosage
                actions["probiotics"]["hours_since_apply"] = hours_since_apply
                actions["probiotics"]["plan_id"] = prob_plan.plan_id

        return actions

    def simulate(
        self,
        initial_state: WaterQualityParams,
        simulation_params: SimulationParams,
        scenario: Optional[Scenario] = None,
        start_time: Optional[datetime] = None,
    ) -> SimulationResult:
        start_time = start_time or datetime.now()
        current_state = self._create_initial_state(initial_state, start_time)

        timestamps: List[datetime] = [current_state.timestamp]
        temperatures: List[float] = [current_state.temperature]
        ph_values: List[float] = [current_state.ph]
        ammonia_nitrogens: List[float] = [current_state.ammonia_nitrogen]
        nitrites: List[float] = [current_state.nitrite]
        salinities: List[float] = [current_state.salinity]
        dissolved_oxygens: List[float] = [current_state.dissolved_oxygen]

        total_hours = simulation_params.simulation_hours
        time_step = simulation_params.time_step
        num_steps = int(total_hours / time_step)

        effective_params = simulation_params.model_copy()
        if scenario and scenario.simulation_params_override:
            for key, value in scenario.simulation_params_override.items():
                if hasattr(effective_params, key):
                    setattr(effective_params, key, value)

        for _ in range(num_steps):
            active_actions = self._get_active_actions_at_time(
                current_state.timestamp,
                scenario,
                effective_params,
            )

            current_state = self.model.step(
                current_state,
                effective_params,
                time_step,
                active_actions,
            )

            timestamps.append(current_state.timestamp)
            temperatures.append(current_state.temperature)
            ph_values.append(current_state.ph)
            ammonia_nitrogens.append(current_state.ammonia_nitrogen)
            nitrites.append(current_state.nitrite)
            salinities.append(current_state.salinity)
            dissolved_oxygens.append(current_state.dissolved_oxygen)

        return SimulationResult(
            timestamps=timestamps,
            temperatures=temperatures,
            ph_values=ph_values,
            ammonia_nitrogens=ammonia_nitrogens,
            nitrites=nitrites,
            salinities=salinities,
            dissolved_oxygens=dissolved_oxygens,
        )

    def simulate_with_scenario(
        self,
        initial_state: WaterQualityParams,
        base_params: SimulationParams,
        scenario: Scenario,
        start_time: Optional[datetime] = None,
    ) -> SimulationResult:
        return self.simulate(
            initial_state=initial_state,
            simulation_params=base_params,
            scenario=scenario,
            start_time=start_time,
        )

    def simulate_baseline(
        self,
        initial_state: WaterQualityParams,
        base_params: SimulationParams,
        start_time: Optional[datetime] = None,
    ) -> SimulationResult:
        return self.simulate(
            initial_state=initial_state,
            simulation_params=base_params,
            scenario=None,
            start_time=start_time,
        )

    def compare_scenarios(
        self,
        initial_state: WaterQualityParams,
        base_params: SimulationParams,
        scenarios: List[Scenario],
        start_time: Optional[datetime] = None,
    ) -> Dict[str, SimulationResult]:
        results: Dict[str, SimulationResult] = {}

        results["baseline"] = self.simulate_baseline(
            initial_state, base_params, start_time
        )

        for scenario in scenarios:
            results[scenario.scenario_id] = self.simulate_with_scenario(
                initial_state, base_params, scenario, start_time
            )

        return results
