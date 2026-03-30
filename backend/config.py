from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    content_dir: str = str(Path(__file__).parent.parent / "content")
    tts_model: str = "en_US-lessac-medium"
    tts_cache_dir: str = str(Path(__file__).parent.parent / "data" / "tts_cache")
    db_path: str = str(Path(__file__).parent.parent / "data" / "architectiq.db")

    # LLM provider: "groq" (cloud, free) or "ollama" (local)
    llm_provider: str = "groq"
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    cors_origins: list[str] = [
        "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
        "http://localhost:3003", "http://localhost:3004", "http://localhost:3005",
    ]

    class Config:
        env_file = ".env"


settings = Settings()
