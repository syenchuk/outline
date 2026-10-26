up:
	docker compose up -d redis postgres
	yarn install --immutable
	yarn dev:watch

build:
	docker build -f Dockerfile.base -t outlinewiki/outline-base .
	docker build -t outlinewiki/outline .

test:
	docker compose up -d postgres
	NODE_ENV=test yarn sequelize db:drop
	NODE_ENV=test yarn sequelize db:create
	NODE_ENV=test yarn sequelize db:migrate
	yarn test

watch:
	docker compose up -d redis postgres
	NODE_ENV=test yarn sequelize db:drop
	NODE_ENV=test yarn sequelize db:create
	NODE_ENV=test yarn sequelize db:migrate
	yarn test:watch

destroy:
	docker compose stop
	docker compose rm -f

.PHONY: up build destroy test watch # let's go to reserve rules names
