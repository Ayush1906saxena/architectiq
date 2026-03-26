.PHONY: dev setup frontend-dev backend-dev clean

dev:
	docker compose up --build

setup:
	docker compose build
	@echo "Setup complete. Run 'make dev' to start."

frontend-dev:
	cd frontend && npm run dev

backend-dev:
	cd backend && uvicorn main:app --reload --port 8000

clean:
	docker compose down -v
	rm -rf data/architectiq.db data/tts_cache
