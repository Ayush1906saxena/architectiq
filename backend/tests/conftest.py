"""Test setup: a throwaway database and data folder, the repository's real content, and no model at all
(the Ollama address points nowhere), so every test runs offline and proves the fallbacks too."""
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_tmp = tempfile.mkdtemp(prefix="architectiq-test-")
os.environ.setdefault("CONTENT_DIR", str(ROOT / "content"))
os.environ.setdefault("DB_PATH", str(Path(_tmp) / "test.db"))
os.environ.setdefault("TTS_CACHE_DIR", str(Path(_tmp) / "tts"))
os.environ.setdefault("LLM_PROVIDER", "ollama")
os.environ.setdefault("OLLAMA_URL", "http://127.0.0.1:9")  # nothing listens here
os.environ.setdefault("GROQ_API_KEY", "")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from main import app

    with TestClient(app) as c:
        yield c
