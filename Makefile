.PHONY: dev build test type-check lint clean docker-up docker-down db-init generate ci deploy deploy-api deploy-web

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

type-check:
	pnpm type-check

lint:
	pnpm lint

clean:
	pnpm clean
	rm -rf apps/**/dist apps/**/.next

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

db-init:
	@echo "Creating database..."
	createdb platform 2>/dev/null || true
	psql -d platform -f infra/db/init/001-schema.sql
	psql -d platform -f infra/db/init/002-extensions.sql

generate:
	pnpm generate

ci:
	pnpm ci

deploy:
	railway up --detach

deploy-api:
	railway service -n api
	railway up --detach --service api

deploy-web:
	railway service -n web
	railway up --detach --service web

integration-test-up:
	docker compose -f docker-compose.test.yml up -d --wait

integration-test-down:
	docker compose -f docker-compose.test.yml down -v

integration-test:
	@echo "Running integration tests against Postgres on port 5433..."
	@DATABASE_URL="postgres://platform_test:platform_test@localhost:5433/platform_test" \
		pnpm --filter @platform/api exec vitest run --config vitest.config.integration.ts
