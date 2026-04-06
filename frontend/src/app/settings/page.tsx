"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function SettingsPage() {
  const [model, setModel] = useState("llama3.2");
  const [voice, setVoice] = useState("en_US-lessac-medium");
  const [speed, setSpeed] = useState("1");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In a full implementation, this would POST to the backend
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure your learning experience.</p>
      </div>

      <div className="space-y-6">
        {/* Ollama Model */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-200 mb-1">Ollama Model</h2>
          <p className="text-xs text-gray-500 mb-3">
            Used for adaptive quizzes, design challenges, and Ask Prof. Arch.
          </p>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 w-full focus:outline-none focus:border-blue-500"
          >
            <option value="llama3.2">llama3.2 (3B — CPU friendly)</option>
            <option value="llama3.1:8b">llama3.1:8b (8B — Recommended)</option>
            <option value="qwen2.5:7b">qwen2.5:7b (7B — Good quality)</option>
            <option value="qwen2.5:14b">qwen2.5:14b (14B — Best quality)</option>
          </select>
        </div>

        {/* Voice */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-200 mb-1">TTS Voice</h2>
          <p className="text-xs text-gray-500 mb-3">
            Prof. Arch&apos;s voice for lesson narration.
          </p>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 w-full focus:outline-none focus:border-blue-500"
          >
            <option value="en_US-lessac-medium">Professor (en_US, warm)</option>
            <option value="en_US-ryan-high">Mentor (en_US, conversational)</option>
            <option value="en_GB-alan-medium">British Professor (en_GB, formal)</option>
          </select>
        </div>

        {/* Playback Speed */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-200 mb-1">Default Playback Speed</h2>
          <div className="flex gap-2 mt-3">
            {["0.75", "1", "1.25", "1.5"].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                  speed === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>Save Settings</Button>
          {saved && (
            <span className="text-sm text-green-400">Settings saved!</span>
          )}
        </div>
      </div>
    </div>
  );
}
