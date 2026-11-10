"""Money value object — immutable, decimal-exact representation of a monetary amount."""
from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Union


@dataclass(frozen=True)
class Money:
    """Immutable value object representing a monetary amount.

    Never uses float. Stores Decimal quantised to 2 decimal places.
    """

    amount: Decimal
    currency: str = "INR"

    def __post_init__(self) -> None:
        if isinstance(self.amount, float):
            raise TypeError("Money does not accept float; use str, int or Decimal")
        quantised = Decimal(str(self.amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        object.__setattr__(self, "amount", quantised)

    # ── Constructors ──────────────────────────────────────────────────────────

    @classmethod
    def of(cls, value: Union[str, int, Decimal], currency: str = "INR") -> "Money":
        """Primary constructor. Accepts str, int or Decimal (never float)."""
        if isinstance(value, float):
            raise TypeError("Money does not accept float; use str, int or Decimal")
        try:
            return cls(amount=Decimal(str(value)), currency=currency)
        except InvalidOperation as exc:
            raise ValueError(f"Cannot create Money from {value!r}") from exc

    @classmethod
    def zero(cls, currency: str = "INR") -> "Money":
        """Zero amount in the given currency."""
        return cls(amount=Decimal("0.00"), currency=currency)

    @classmethod
    def from_minor_units(cls, n: int, currency: str = "INR") -> "Money":
        """Construct from integer minor units (paise / cents)."""
        return cls(amount=Decimal(n) / Decimal("100"), currency=currency)

    # ── Internal helper ───────────────────────────────────────────────────────

    def _check_currency(self, other: "Money") -> None:
        from app.domain.exceptions import DomainValidationError  # local import to avoid cycles
        if self.currency != other.currency:
            raise DomainValidationError(
                f"Currency mismatch: {self.currency} vs {other.currency}"
            )

    # ── Arithmetic ────────────────────────────────────────────────────────────

    def add(self, other: "Money") -> "Money":
        """Return self + other; currencies must match."""
        self._check_currency(other)
        return Money(amount=self.amount + other.amount, currency=self.currency)

    def subtract(self, other: "Money") -> "Money":
        """Return self - other; currencies must match."""
        self._check_currency(other)
        return Money(amount=self.amount - other.amount, currency=self.currency)

    def __add__(self, other: "Money") -> "Money":
        return self.add(other)

    def __sub__(self, other: "Money") -> "Money":
        return self.subtract(other)

    # ── Comparisons ───────────────────────────────────────────────────────────

    def __lt__(self, other: "Money") -> bool:  # type: ignore[override]
        self._check_currency(other)
        return self.amount < other.amount

    def __le__(self, other: "Money") -> bool:  # type: ignore[override]
        self._check_currency(other)
        return self.amount <= other.amount

    def __gt__(self, other: "Money") -> bool:  # type: ignore[override]
        self._check_currency(other)
        return self.amount > other.amount

    def __ge__(self, other: "Money") -> bool:  # type: ignore[override]
        self._check_currency(other)
        return self.amount >= other.amount

    # ── Predicates ───────────────────────────────────────────────────────────

    def is_zero(self) -> bool:
        return self.amount == Decimal("0.00")

    def is_positive(self) -> bool:
        return self.amount > Decimal("0.00")

    def is_negative(self) -> bool:
        return self.amount < Decimal("0.00")

    # ── Conversion ────────────────────────────────────────────────────────────

    def to_minor_units(self) -> int:
        return int((self.amount * 100).to_integral_value(rounding=ROUND_HALF_UP))

    def format(self) -> str:
        """Human-readable: ₹45,000.00 for INR, else USD 1,200.00."""
        if self.currency == "INR":
            return f"\u20b9{self.amount:,.2f}"
        return f"{self.currency} {self.amount:,.2f}"

    def __repr__(self) -> str:
        return f"Money({self.amount}, {self.currency!r})"
