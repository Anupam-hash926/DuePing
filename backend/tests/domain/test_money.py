"""Tests for Money value object."""
import pytest
from decimal import Decimal

from app.domain.money import Money
from app.domain.exceptions import DomainValidationError


# ── Construction ──────────────────────────────────────────────────────────────

class TestMoneyConstruction:
    def test_of_int(self):
        m = Money.of(1000)
        assert m.amount == Decimal("1000.00")
        assert m.currency == "INR"

    def test_of_str(self):
        m = Money.of("450.50")
        assert m.amount == Decimal("450.50")

    def test_of_decimal(self):
        m = Money.of(Decimal("999.99"))
        assert m.amount == Decimal("999.99")

    def test_of_zero_int(self):
        m = Money.of(0)
        assert m.is_zero()

    def test_direct_constructor_int_raises(self):
        """Money(1.5, 'INR') raises TypeError — no float."""
        with pytest.raises(TypeError):
            Money(1.5, "INR")  # type: ignore

    def test_of_float_raises(self):
        with pytest.raises(TypeError):
            Money.of(1.5)  # type: ignore

    def test_of_invalid_string_raises(self):
        with pytest.raises(ValueError):
            Money.of("not-a-number")

    def test_direct_decimal_ok(self):
        m = Money(Decimal("1"), "INR")
        assert m.amount == Decimal("1.00")

    def test_currency_default_inr(self):
        assert Money.of(100).currency == "INR"

    def test_currency_usd(self):
        m = Money.of(100, "USD")
        assert m.currency == "USD"


# ── Rounding ──────────────────────────────────────────────────────────────────

class TestMoneyRounding:
    def test_round_half_up_at_midpoint(self):
        # "1.005" → "1.01" (ROUND_HALF_UP)
        m = Money.of("1.005")
        assert m.amount == Decimal("1.01")

    def test_round_down(self):
        m = Money.of("1.004")
        assert m.amount == Decimal("1.00")

    def test_round_up(self):
        m = Money.of("1.006")
        assert m.amount == Decimal("1.01")


# ── Arithmetic ────────────────────────────────────────────────────────────────

class TestMoneyArithmetic:
    def test_add(self):
        a = Money.of(100)
        b = Money.of(50)
        assert a.add(b) == Money.of(150)

    def test_subtract(self):
        a = Money.of(100)
        b = Money.of(30)
        assert a.subtract(b) == Money.of(70)

    def test_add_operator(self):
        assert Money.of(10) + Money.of(5) == Money.of(15)

    def test_sub_operator(self):
        assert Money.of(10) - Money.of(3) == Money.of(7)

    def test_subtract_to_zero(self):
        a = Money.of(100)
        assert a.subtract(a).is_zero()

    def test_subtract_to_negative(self):
        a = Money.of(10)
        b = Money.of(20)
        result = a.subtract(b)
        assert result.is_negative()

    def test_add_currency_mismatch(self):
        with pytest.raises(DomainValidationError):
            Money.of(100, "INR").add(Money.of(100, "USD"))

    def test_subtract_currency_mismatch(self):
        with pytest.raises(DomainValidationError):
            Money.of(100, "INR").subtract(Money.of(50, "USD"))


# ── Predicates ────────────────────────────────────────────────────────────────

class TestMoneyPredicates:
    def test_is_zero(self):
        assert Money.zero().is_zero()

    def test_is_zero_false(self):
        assert not Money.of(1).is_zero()

    def test_is_positive(self):
        assert Money.of(1).is_positive()

    def test_is_positive_false_zero(self):
        assert not Money.zero().is_positive()

    def test_is_negative(self):
        m = Money(Decimal("-1.00"), "INR")
        assert m.is_negative()

    def test_is_negative_false_positive(self):
        assert not Money.of(1).is_negative()


# ── Comparisons ───────────────────────────────────────────────────────────────

class TestMoneyComparisons:
    def test_lt(self):
        assert Money.of(10) < Money.of(20)

    def test_le_equal(self):
        assert Money.of(10) <= Money.of(10)

    def test_le_less(self):
        assert Money.of(5) <= Money.of(10)

    def test_gt(self):
        assert Money.of(20) > Money.of(10)

    def test_ge_equal(self):
        assert Money.of(10) >= Money.of(10)

    def test_ge_greater(self):
        assert Money.of(20) >= Money.of(10)

    def test_eq(self):
        assert Money.of(100) == Money.of(100)

    def test_ne(self):
        assert Money.of(100) != Money.of(200)

    def test_comparison_currency_mismatch(self):
        with pytest.raises(DomainValidationError):
            _ = Money.of(10, "INR") < Money.of(10, "USD")


# ── Conversion ────────────────────────────────────────────────────────────────

class TestMoneyConversion:
    def test_to_minor_units_1000_inr(self):
        m = Money.of(1000)
        assert m.to_minor_units() == 100_000  # 100000 paise = ₹1000.00

    def test_to_minor_units_fractional(self):
        m = Money.of("12.50")
        assert m.to_minor_units() == 1250

    def test_from_minor_units_roundtrip(self):
        original = Money.of(999)
        minor = original.to_minor_units()
        restored = Money.from_minor_units(minor)
        assert restored == original

    def test_from_minor_units_100_paise(self):
        m = Money.from_minor_units(100)
        assert m.amount == Decimal("1.00")


# ── Formatting ────────────────────────────────────────────────────────────────

class TestMoneyFormat:
    def test_format_inr(self):
        m = Money.of(45000)
        assert m.format() == "₹45,000.00"

    def test_format_usd(self):
        m = Money.of(1200, "USD")
        assert m.format() == "USD 1,200.00"

    def test_format_inr_zero(self):
        assert Money.zero("INR").format() == "₹0.00"


# ── Money.zero() ──────────────────────────────────────────────────────────────

class TestMoneyZero:
    def test_zero_is_zero(self):
        assert Money.zero().is_zero()

    def test_zero_default_currency(self):
        assert Money.zero().currency == "INR"

    def test_zero_usd(self):
        assert Money.zero("USD").currency == "USD"

    def test_zero_amount(self):
        assert Money.zero().amount == Decimal("0.00")
