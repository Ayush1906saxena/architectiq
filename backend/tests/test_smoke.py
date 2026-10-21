"""The API's main paths work end to end on the real content, with no model available."""
from services.ollama_client import FALLBACK_REPLIES


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["database"] is True
    assert body["content_dir"] is True


def test_curriculum_has_every_tier_and_lesson(client):
    tiers = client.get("/api/curriculum").json()["tiers"]
    assert [t["id"] for t in tiers] == [f"tier-{i}" for i in range(7)]
    modules = [m for t in tiers for m in t["modules"]]
    lessons = [lesson for m in modules for lesson in m["lessons"]]
    assert len(modules) >= 40
    assert len(lessons) >= 170


def test_a_lesson_loads(client):
    tiers = client.get("/api/curriculum").json()["tiers"]
    module = tiers[0]["modules"][0]
    lesson = module["lessons"][0]
    r = client.get(f"/api/lessons/{module['slug']}/{lesson['id']}")
    if r.status_code == 404:  # some builds key lessons by module id
        r = client.get(f"/api/lessons/{module['id']}/{lesson['id']}")
    assert r.status_code == 200, r.text


def test_interview_problems(client):
    problems = client.get("/api/interview/problems").json()
    assert len(problems) >= 10
    assert all({"id", "title", "description"} <= set(p) for p in problems)


def test_interview_opens_in_plain_words_without_a_model(client):
    problems = client.get("/api/interview/problems").json()
    r = client.post("/api/interview/start", json={"problem_id": problems[0]["id"], "career_level": "sde2"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["opening_message"] not in FALLBACK_REPLIES
    assert "requirements" in body["opening_message"].lower()
    assert body["state"]["level"] == "sde2"


def test_invalid_career_level_is_refused(client):
    r = client.post("/api/interview/start", json={"problem_id": "url-shortener", "career_level": "intern"})
    assert r.status_code in (400, 422)
