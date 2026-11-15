.PHONY: dev test lint seed build clean

# Start both backend and frontend development servers
dev:
	@echo "Starting DuePing development servers..."
	@(trap 'kill 0' SIGINT; \
	  (cd backend && .venv/bin/uvicorn app.api.main:app --reload --port 8000) & \
	  (cd frontend && npm run dev) & \
	  wait)

# Run full test suite (backend pytest with coverage + frontend vitest)
test:
	@echo "Running backend test suite with coverage..."
	cd backend && PYTHONPATH=. .venv/bin/pytest tests/ --cov=app --cov-report=term-missing:skip-covered
	@echo "Running frontend test suite..."
	cd frontend && npm test -- --run

# Run linters and type checkers (ruff, mypy, tsc, eslint)
lint:
	@echo "Linting backend with ruff..."
	backend/.venv/bin/ruff check backend/app backend/tests
	@echo "Type-checking backend with mypy..."
	cd backend && .venv/bin/mypy app
	@echo "Type-checking frontend with tsc..."
	cd frontend && npx tsc --noEmit
	@echo "Linting frontend..."
	cd frontend && npm run lint

# Seed database with canonical demonstration records
seed:
	@echo "Seeding database..."
	cd backend && PYTHONPATH=. .venv/bin/python -m app.infrastructure.seed

# Build frontend production bundle
build:
	cd frontend && npm run build

# Clean temporary build and cache artifacts
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	rm -rf frontend/dist
