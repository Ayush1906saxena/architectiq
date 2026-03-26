import hashlib
import io
import wave
from pathlib import Path

from config import settings
from models.lesson import WordTiming


class TTSService:
    def __init__(self):
        self._voice = None

    def _get_voice(self):
        if self._voice is None:
            try:
                from piper import PiperVoice

                # Try model path directly, then look in data/piper-models/
                model_name = settings.tts_model
                model_path = Path(model_name)

                if not model_path.exists():
                    # Look in standard locations
                    data_dir = Path(__file__).parent.parent.parent / "data" / "piper-models"
                    for candidate in [
                        data_dir / f"{model_name}.onnx",
                        data_dir / model_name,
                    ]:
                        if candidate.exists():
                            model_path = candidate
                            break

                if model_path.exists():
                    config_path = Path(str(model_path) + ".json")
                    if config_path.exists():
                        self._voice = PiperVoice.load(str(model_path), config_path=str(config_path))
                    else:
                        self._voice = PiperVoice.load(str(model_path))
                    print(f"[TTS] Loaded voice model: {model_path}")
                else:
                    print(f"[TTS] Voice model not found: {model_name}")
                    self._voice = None
            except Exception as e:
                print(f"[TTS] Failed to load voice: {e}")
                self._voice = None
        return self._voice

    def _get_cache_path(self, topic_id: str, lesson_id: str, segment_id: str) -> Path:
        cache_dir = Path(settings.tts_cache_dir) / topic_id / lesson_id
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir / f"{segment_id}.wav"

    def _estimate_word_timings(self, text: str, duration_ms: int) -> list[WordTiming]:
        """Estimate word timings proportionally based on character count."""
        words = text.split()
        if not words:
            return []

        total_chars = sum(len(w) for w in words)
        if total_chars == 0:
            return []

        current_ms = 0
        timings = []
        for word in words:
            word_duration = int((len(word) / total_chars) * duration_ms)
            timings.append(
                WordTiming(
                    word=word,
                    start_ms=current_ms,
                    end_ms=current_ms + word_duration,
                )
            )
            current_ms += word_duration

        return timings

    def _get_wav_duration_ms(self, wav_path: Path) -> int:
        with wave.open(str(wav_path), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return int((frames / rate) * 1000)

    async def generate(
        self, text: str, topic_id: str, lesson_id: str, segment_id: str
    ) -> tuple[Path, int, list[WordTiming]]:
        """Generate TTS audio. Returns (audio_path, duration_ms, word_timings)."""
        cache_path = self._get_cache_path(topic_id, lesson_id, segment_id)

        if cache_path.exists():
            duration_ms = self._get_wav_duration_ms(cache_path)
            timings = self._estimate_word_timings(text, duration_ms)
            return cache_path, duration_ms, timings

        voice = self._get_voice()
        if voice is None:
            # Fallback: generate a silent WAV file for development without Piper
            duration_ms = max(len(text.split()) * 400, 2000)  # ~400ms per word
            self._generate_silent_wav(cache_path, duration_ms)
            timings = self._estimate_word_timings(text, duration_ms)
            return cache_path, duration_ms, timings

        # Generate with Piper
        with wave.open(str(cache_path), "wb") as wav_file:
            voice.synthesize_wav(text, wav_file)
        duration_ms = self._get_wav_duration_ms(cache_path)
        timings = self._estimate_word_timings(text, duration_ms)

        return cache_path, duration_ms, timings

    def _generate_silent_wav(self, path: Path, duration_ms: int):
        """Generate a silent WAV file for development/testing."""
        sample_rate = 22050
        num_frames = int(sample_rate * duration_ms / 1000)
        with wave.open(str(path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(b"\x00\x00" * num_frames)


tts_service = TTSService()
