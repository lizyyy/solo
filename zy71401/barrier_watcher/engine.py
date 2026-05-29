from __future__ import annotations

from datetime import date, datetime

from .models import (
    BarrierDirection,
    BarrierJudgment,
    BarrierType,
    Contract,
    JudgmentStatus,
    ObservationPrice,
    ProblemRecord,
    ProblemType,
)


def check_barrier_breach(
    price: float,
    barrier_level: float,
    barrier_direction: BarrierDirection,
) -> bool:
    if barrier_direction == BarrierDirection.UP:
        return price >= barrier_level
    return price <= barrier_level


def judge_observation(
    contract: Contract,
    obs_price: ObservationPrice,
    determined_at: datetime | None = None,
) -> BarrierJudgment:
    _determined_at = determined_at or datetime.now()
    if not contract.has_barrier_condition:
        return BarrierJudgment(
            contract_id=contract.contract_id,
            observation_date=obs_price.observation_date,
            status=JudgmentStatus.PENDING,
            determined_at=_determined_at,
        )
    breached = check_barrier_breach(
        obs_price.price,
        contract.barrier_level,
        contract.barrier_direction,
    )
    breach_type = None
    if breached:
        if contract.barrier_type == BarrierType.KNOCK_IN:
            breach_type = "knocked_in"
        elif contract.barrier_type == BarrierType.KNOCK_OUT:
            breach_type = "knocked_out"
    return BarrierJudgment(
        contract_id=contract.contract_id,
        observation_date=obs_price.observation_date,
        status=JudgmentStatus.BREACHED if breached else JudgmentStatus.NOT_BREACHED,
        breach_type=breach_type,
        price_at_observation=obs_price.price,
        barrier_level_used=contract.barrier_level,
        determined_at=_determined_at,
    )


def validate_price_timestamp(
    obs_price: ObservationPrice,
    observation_date: date,
    tolerance_hours: int = 24,
) -> ProblemRecord | None:
    price_date = obs_price.timestamp.date()
    if price_date != observation_date:
        diff = abs((obs_price.timestamp.date() - observation_date).days)
        if diff * 24 > tolerance_hours:
            return ProblemRecord(
                contract_id=obs_price.contract_id,
                problem_type=ProblemType.PRICE_TIMESTAMP_MISMATCH,
                detail=(
                    f"合约 {obs_price.contract_id} 观察日 {observation_date.isoformat()} "
                    f"的价格时点 {obs_price.timestamp.isoformat()} 不匹配，"
                    f"偏差 {diff} 天"
                ),
                related_material=(
                    f"观察价格记录[{obs_price.contract_id}/"
                    f"{obs_price.observation_date.isoformat()}/"
                    f"timestamp={obs_price.timestamp.isoformat()}]"
                ),
                observation_date=observation_date,
            )
    return None


class BarrierEngine:
    def __init__(self, determined_at: datetime | None = None):
        self._determined_at = determined_at

    def process_contract(
        self,
        contract: Contract,
        prices: list[ObservationPrice],
        existing_judgments: dict[str, BarrierJudgment],
        timestamp_tolerance_hours: int = 24,
    ) -> tuple[list[BarrierJudgment], list[ProblemRecord]]:
        new_judgments: list[BarrierJudgment] = []
        problems: list[ProblemRecord] = []

        if not contract.has_barrier_condition:
            problems.append(
                ProblemRecord(
                    contract_id=contract.contract_id,
                    problem_type=ProblemType.MISSING_BARRIER_CONDITION,
                    detail=(
                        f"合约 {contract.contract_id} 缺少障碍条件"
                        f"（障碍水平={contract.barrier_level}，"
                        f"障碍类型={contract.barrier_type}，"
                        f"障碍方向={contract.barrier_direction}）"
                    ),
                    related_material=(
                        f"合约记录[{contract.contract_id}/"
                        f"barrier_level={contract.barrier_level}/"
                        f"barrier_type={contract.barrier_type}/"
                        f"barrier_direction={contract.barrier_direction}]"
                    ),
                )
            )
            for p in prices:
                jid = f"{contract.contract_id}:{p.observation_date.isoformat()}"
                if jid not in existing_judgments:
                    judgment = BarrierJudgment(
                        contract_id=contract.contract_id,
                        observation_date=p.observation_date,
                        status=JudgmentStatus.PENDING,
                        determined_at=self._determined_at or datetime.now(),
                    )
                    new_judgments.append(judgment)
            return new_judgments, problems

        if not contract.has_observation_calendar:
            problems.append(
                ProblemRecord(
                    contract_id=contract.contract_id,
                    problem_type=ProblemType.MISSING_OBSERVATION_CALENDAR,
                    detail=f"合约 {contract.contract_id} 缺少观察日历",
                    related_material=f"合约记录[{contract.contract_id}/observation_dates=null]",
                )
            )
            return new_judgments, problems

        price_map: dict[date, ObservationPrice] = {}
        for p in prices:
            ts_problem = validate_price_timestamp(
                p, p.observation_date, timestamp_tolerance_hours
            )
            if ts_problem:
                problems.append(ts_problem)
            price_map[p.observation_date] = p

        obs_dates = contract.observation_dates or []
        for obs_date in obs_dates:
            jid = f"{contract.contract_id}:{obs_date.isoformat()}"
            if jid in existing_judgments:
                continue

            if obs_date not in price_map:
                problems.append(
                    ProblemRecord(
                        contract_id=contract.contract_id,
                        problem_type=ProblemType.MISSING_OBSERVATION_PRICE,
                        detail=(
                            f"合约 {contract.contract_id} 观察日 "
                            f"{obs_date.isoformat()} 缺少观察价格"
                        ),
                        related_material=(
                            f"观察价格[{contract.contract_id}/"
                            f"{obs_date.isoformat()}]"
                        ),
                        observation_date=obs_date,
                    )
                )
                judgment = BarrierJudgment(
                    contract_id=contract.contract_id,
                    observation_date=obs_date,
                    status=JudgmentStatus.PENDING,
                    barrier_level_used=contract.barrier_level,
                    determined_at=self._determined_at or datetime.now(),
                )
                new_judgments.append(judgment)
                continue

            obs_price = price_map[obs_date]
            judgment = judge_observation(
                contract, obs_price, self._determined_at
            )
            new_judgments.append(judgment)

        return new_judgments, problems
