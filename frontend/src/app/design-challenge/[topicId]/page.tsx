"use client";

import { useState, useCallback } from "react";
import { sendDesignChallengeMessage } from "@/lib/api";
import { ChatMessage } from "@/types/challenge";
import ChatInterface from "@/components/challenge/ChatInterface";

const CHALLENGE_INTROS: Record<string, string> = {
  "url-shortener": "Let's design a URL shortening service like bit.ly. Before we dive in, what questions do you have about requirements?",
  "twitter-feed": "Let's design the news feed for a social media platform like Twitter. What would you like to clarify about the requirements?",
  "chat-system": "Let's design a real-time chat system like WhatsApp or Slack. What requirements questions do you have?",
};

interface DesignChallengePageProps {
  params: { topicId: string };
}

export default function DesignChallengePage({ params }: DesignChallengePageProps) {
  const { topicId } = params;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: CHALLENGE_INTROS[topicId] || `Let's design a system for: ${topicId.replace(/-/g, " ")}. What questions do you have?`,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSend = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = { role: "user", content };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setIsLoading(true);

      try {
        const response = await sendDesignChallengeMessage({
          topic_id: topicId,
          challenge_id: topicId,
          messages: newMessages,
        });

        setMessages([
          ...newMessages,
          { role: "assistant", content: response.reply },
        ]);

        if (response.is_complete) {
          setScore(response.score);
          setFeedback(response.feedback);
        }
      } catch (err) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: "Sorry, I'm having trouble connecting. Is Ollama running?",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, topicId]
  );

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-800">
        <a href="/" className="text-gray-400 hover:text-gray-200 text-sm">
          &larr; Back
        </a>
        <h1 className="text-sm font-medium text-gray-300 font-mono">
          Design Challenge: {topicId.replace(/-/g, " ")}
        </h1>
        <span className="ml-auto text-[10px] text-gray-500 font-mono">
          {messages.filter((m) => m.role === "user").length}/10 turns
        </span>
      </header>

      <div className="flex-1 min-h-0">
        <ChatInterface
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          title={`Design: ${topicId.replace(/-/g, " ")}`}
          placeholder="Describe your design approach..."
          score={score}
          feedback={feedback}
        />
      </div>
    </div>
  );
}
