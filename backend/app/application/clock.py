"""Clock implementations: real system clock and demo-ready simulated clock."""
from __future__ import annotations

from datetime import UTC, date, datetime

from app.application.ports import Clock, SettingsRepository


class SystemClock(Clock):
    """Real clock reading UTC time from the system."""

    def today(self) -> date:
        return datetime.now(UTC).date()

    def now(self) -> datetime:
        # Return naive UTC datetime or UTC-aware as per convention
        return datetime.now(UTC).replace(tzinfo=None)


class SimulatedClock(Clock):
    """Simulated clock reading 'simulated_date' setting to allow time-travel demos.

    If setting 'simulated_date' is configured (ISO 'YYYY-MM-DD'), today() returns
    that date and now() returns that date at 09:00:00 UTC. Otherwise delegates to SystemClock.
    """

    def __init__(self, settings: SettingsRepository) -> None:
        self.settings = settings
        self._real_clock = SystemClock()

    def _simulated_date(self) -> date | None:
        val = self.settings.get("simulated_date")
        if val and val.strip():
            try:
                return date.fromisoformat(val.strip())
            except ValueError:
                return None
        return None

    def today(self) -> date:
        sim = self._simulated_date()
        if sim is not None:
            return sim
        return self._real_clock.today()

    def now(self) -> datetime:
        sim = self._simulated_date()
        if sim is not None:
            return datetime(sim.year, sim.month, sim.day, 9, 0, 0)
        return self._real_clock.now()
