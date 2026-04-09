"""
TTS Service — uses gTTS (Google Text-to-Speech) for cross-platform audio generation.
Falls back to silent WAV when offline or gTTS fails.
"""
import hashlib
import wave
from pathlib import Path

from config import settings
from models.lesson import WordTiming


class TTSService:
    def _get_cache_path(self, topic_id: str, lesson_id: str, segment_id: str) -> Path:
        cache_dir = Path(settings.tts_cache_dir) / topic_id / lesson_id
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir / f"{segment_id}.mp3"

    def _get_wav_cache_path(self, topic_id: str, lesson_id: str, segment_id: str) -> Path:
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

    def _estimate_mp3_duration_ms(self, mp3_path: Path) -> int:
        """Estimate MP3 duration from file size (rough: ~16KB/s for gTTS output)."""
        size_bytes = mp3_path.stat().st_size
        # gTTS typically outputs ~16KB per second at default quality
        return max(int((size_bytes / 16000) * 1000), 500)

    def _get_wav_duration_ms(self, wav_path: Path) -> int:
        with wave.open(str(wav_path), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return int((frames / rate) * 1000)

    async def generate(
        self, text: str, topic_id: str, lesson_id: str, segment_id: str
    ) -> tuple[Path, int, list[WordTiming]]:
        """Generate TTS audio. Returns (audio_path, duration_ms, word_timings)."""
        mp3_path = self._get_cache_path(topic_id, lesson_id, segment_id)

        if mp3_path.exists():
            duration_ms = self._estimate_mp3_duration_ms(mp3_path)
            timings = self._estimate_word_timings(text, duration_ms)
            return mp3_path, duration_ms, timings

        try:
            from gtts import gTTS

            tts = gTTS(text=text, lang="en", slow=False)
            tts.save(str(mp3_path))
            duration_ms = self._estimate_mp3_duration_ms(mp3_path)
            timings = self._estimate_word_timings(text, duration_ms)
            print(f"[TTS] Generated: {mp3_path}")
            return mp3_path, duration_ms, timings

        except Exception as e:
            print(f"[TTS] gTTS failed ({e}), generating silent fallback")
            # Fallback: generate a silent WAV file
            wav_path = self._get_wav_cache_path(topic_id, lesson_id, segment_id)
            duration_ms = max(len(text.split()) * 400, 2000)
            self._generate_silent_wav(wav_path, duration_ms)
            timings = self._estimate_word_timings(text, duration_ms)
            return wav_path, duration_ms, timings

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
