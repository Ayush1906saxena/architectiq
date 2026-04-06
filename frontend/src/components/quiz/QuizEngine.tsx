"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuizStore } from "@/store/useQuizStore";
import { fetchQuiz, submitQuizAnswer, fetchAdaptiveQuestion } from "@/lib/api";
import MCQCard from "./MCQCard";
import DifficultyMeter from "./DifficultyMeter";
import ExplanationCard from "./ExplanationCard";
import QuizResults from "./QuizResults";

interface QuizEngineProps {
  topicId: string;
}

export default function QuizEngine({ topicId }: QuizEngineProps) {
  const {
    questions,
    currentIndex,
    selectedAnswer,
    answers,
    currentResult,
    showExplanation,
    isSubmitting,
    difficulty,
    isComplete,
    setQuestions,
    selectAnswer,
    setResult,
    showExplanationPanel,
    nextQuestion,
    setSubmitting,
    setDifficulty,
    addAdaptiveQuestion,
    reset,
  } = useQuizStore();

  const questionStartTime = useRef<number>(Date.now());
  const consecutiveCorrect = useRef<number>(0);

  useEffect(() => {
    reset();
    fetchQuiz(topicId)
      .then((bank) => {
        setQuestions(bank.questions);
      })
      .catch((err) => console.error("Failed to load quiz:", err));
  }, [topicId, reset, setQuestions]);

  useEffect(() => {
    questionStartTime.current = Date.now();
  }, [currentIndex]);

  const handleSelect = useCallback(
    async (index: number) => {
      if (isSubmitting || currentResult) return;

      selectAnswer(index);
      setSubmitting(true);

      const timeTaken = Date.now() - questionStartTime.current;
      const currentQ = questions[currentIndex];

      try {
        const result = await submitQuizAnswer({
          topic_id: topicId,
          question_id: currentQ.id,
          selected_answer: index,
          time_taken_ms: timeTaken,
        });

        setResult(result);

        if (result.mastery_update.difficulty_change !== 0) {
          setDifficulty(difficulty + result.mastery_update.difficulty_change);
        }

        if (result.is_correct) {
          consecutiveCorrect.current += 1;
        } else {
          consecutiveCorrect.current = 0;
        }

        // Adaptive: after 3 correct in a row, try to fetch a harder question
        if (consecutiveCorrect.current >= 3 && currentIndex >= questions.length - 2) {
          try {
            const adaptiveQ = await fetchAdaptiveQuestion(
              topicId,
              difficulty,
              currentQ.question
            );
            addAdaptiveQuestion(adaptiveQ);
          } catch {
            // Adaptive fetch is optional; ignore failures
          }
        }

        showExplanationPanel();
      } catch (err) {
        console.error("Submission error:", err);
      } finally {
        setSubmitting(false);
      }
    },
    [
      isSubmitting,
      currentResult,
      selectAnswer,
      setSubmitting,
      questions,
      currentIndex,
      topicId,
      setResult,
      setDifficulty,
      difficulty,
      addAdaptiveQuestion,
      showExplanationPanel,
    ]
  );

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg animate-pulse">
          Loading quiz...
        </div>
      </div>
    );
  }

  if (isComplete) {
    return <QuizResults answers={answers} questions={questions} topicId={topicId} />;
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Question{" "}
            <span className="text-gray-200 font-semibold">
              {currentIndex + 1}
            </span>
            /{questions.length}
          </span>
          <DifficultyMeter difficulty={difficulty} />
        </div>
        {isSubmitting && (
          <span className="text-sm text-blue-400 animate-pulse">
            Submitting...
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-500"
          initial={false}
          animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question card */}
      <MCQCard
        question={currentQuestion}
        selectedAnswer={selectedAnswer}
        result={currentResult}
        onSelect={handleSelect}
      />

      {/* Explanation */}
      <ExplanationCard
        show={showExplanation}
        isCorrect={currentResult?.is_correct ?? false}
        explanation={currentResult?.explanation ?? ""}
        onContinue={nextQuestion}
      />
    </div>
  );
}
