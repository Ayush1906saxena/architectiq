I built an AI system design academy with a lip-synced avatar instructor and a live AI interviewer that catches your contradictions.

Most engineers prep for system design interviews by memorizing "use Redis for caching" without understanding why caches work, how eviction policies differ, or what happens when Redis crashes at 115K req/sec.

ArchitectIQ fixes this with three capabilities:

1. Voice-narrated lessons with a lip-synced avatar

174 lessons across 7 tiers (CPU fundamentals → ML system design). Each lesson is spoken by a neural TTS engine (Piper, running locally on ONNX). The audio feeds a real-time FFT analyzer → lip-sync engine → canvas-rendered avatar with mouth animation at 60fps and word-level text highlighting. Not a video. An interactive instructor.

2. A live AI interviewer (4-layer engine)

10 system design problems. 5 career levels (SDE2 → VP). The interviewer listens to what you said, assesses depth per concept (buzzword/surface/applied/deep), identifies gaps, and generates a follow-up targeting your weakest point.

Say "I'd use Kafka" and it asks: "Why Kafka over RabbitMQ? What's your partition strategy?"

Contradict yourself and it catches you: "Earlier you said eventual consistency is fine. But this design requires read-your-writes. Which is it?"

Under the hood: a deterministic strategist with 11 priority tiers decides what to do (probe/challenge/catch contradiction/redirect). The LLM only handles natural language — all evaluation logic is deterministic. 90-105 probes per problem across verify, deepen, challenge, and anti-BS categories.

3. The closed feedback loop

After each interview: an 8-dimension scorecard where the AI reads your full conversation and scores each dimension referencing your actual words. Weak on failure handling → directed to the replication module. Weak on caching → directed to the cache invalidation lesson.

Learn → Interview → Score → Close gaps → Repeat.

Stack: Next.js 14, FastAPI, Piper TTS, Web Audio API, Canvas 2D, Groq. $0/month to deploy. Open source.

github.com/Ayush1906saxena/architectiq

#SystemDesign #AI #OpenSource #SoftwareArchitecture #BuildInPublic
