"""Tests for robust JSON extraction from LLM responses."""
import pytest

from services.ollama_client import extract_json


def test_plain_object():
    assert extract_json('{"a": 1, "b": "x"}') == {"a": 1, "b": "x"}


def test_array():
    assert extract_json("[1, 2, 3]") == [1, 2, 3]


def test_code_fence_json():
    raw = '```json\n{"score": 7}\n```'
    assert extract_json(raw) == {"score": 7}


def test_code_fence_plain():
    raw = '```\n{"score": 7}\n```'
    assert extract_json(raw) == {"score": 7}


def test_prose_wrapped():
    raw = 'Sure! Here is the analysis: {"concepts": []} Hope that helps.'
    assert extract_json(raw) == {"concepts": []}


def test_trailing_sentence():
    raw = '{"ok": true}\nLet me know if you need anything else.'
    assert extract_json(raw) == {"ok": True}


def test_empty_raises():
    with pytest.raises(ValueError):
        extract_json("")


def test_no_json_raises():
    with pytest.raises(ValueError):
        extract_json("I could not complete that request.")
