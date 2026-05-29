from __future__ import annotations

from datetime import date, timedelta

from .models import Contract, ObservationFreq


def generate_observation_dates(
    start_date: date,
    end_date: date,
    freq: ObservationFreq,
    holidays: set[date] | None = None,
) -> list[date]:
    _holidays = holidays or set()
    dates: list[date] = []
    current = start_date
    while current <= end_date:
        if current.weekday() < 5 and current not in _holidays:
            dates.append(current)
        if freq == ObservationFreq.DAILY:
            current += timedelta(days=1)
        elif freq == ObservationFreq.WEEKLY:
            current += timedelta(weeks=1)
        elif freq == ObservationFreq.MONTHLY:
            next_month = current.month % 12 + 1
            next_year = current.year + (1 if current.month == 12 else 0)
            try:
                current = date(next_year, next_month, current.day)
            except ValueError:
                current = date(next_year, next_month, 28)
        else:
            current += timedelta(days=1)
    return dates


def fill_observation_calendar(
    contract: Contract,
    holidays: set[date] | None = None,
) -> Contract:
    if contract.observation_dates is not None and len(contract.observation_dates) > 0:
        return contract
    if contract.observation_freq == ObservationFreq.CUSTOM:
        return contract
    contract.observation_dates = generate_observation_dates(
        contract.start_date,
        contract.end_date,
        contract.observation_freq,
        holidays,
    )
    return contract


def missing_observation_dates(
    contract: Contract,
    available_price_dates: set[date],
) -> list[date]:
    if not contract.has_observation_calendar:
        return []
    obs_dates = contract.observation_dates or []
    return [d for d in obs_dates if d not in available_price_dates]
