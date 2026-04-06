"use client";

import { useState, useCallback } from "react";
import { askProfArch } from "@/lib/api";
import { ChatMessage } from "@/types/challenge";
import ChatInterface from "@/components/challenge/ChatInterface";

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm Prof. Arch. Ask me anything about system design — from basic concepts like 'what is a load balancer' to deep questions like 'how does Raft handle split-brain scenarios'. I'm here to help you build real understanding.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = { role: "user", content };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const response = await askProfArch({
          question: content,
        });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response.answer },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I'm having trouble connecting to my brain (Ollama). Make sure Ollama is running locally on port 11434.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 min-h-0">
        <ChatInterface
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          title="Ask Prof. Arch"
          placeholder="Ask about any system design concept..."
        />
      </div>
    </div>
  );
}
