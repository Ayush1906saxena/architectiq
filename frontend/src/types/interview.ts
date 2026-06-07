export interface InterviewState {
  phase: string;
  exchange_count: number;
  phase_exchanges: number;
  elapsed_minutes: number;
  total_minutes: number;
  effective_difficulty: number;
  level: string;
  concepts_covered: number;
  concepts_total: number;
  rubric_scores: Record<string, number>;
  deep_dive_target: string | null;
  contradictions_found: number;
}

export interface ScorecardRecommendation {
  reason: string;
  topic: string;
  lesson: string;
  title: string;
}

export interface Scorecard {
  overall_score: number;
  passed: boolean;
  pass_threshold: number;
  badge: string;
  badge_label: string;
  level_attempted: string;
  level_assessed: string;
  dimension_scores: Record<string, number>;
  dimension_reasons: Record<string, string>;
  dimension_weights: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  recommendations: ScorecardRecommendation[];
  depth_summary: Record<string, unknown>;
  stats: Record<string, number>;
}

export interface InterviewProblem {
  id: string;
  title: string;
  description: string;
}

export interface StartInterviewResponse {
  session_id: string;
  opening_message: string;
  problem_id: string;
  problem_title: string;
  state: InterviewState;
}

export interface InterviewMessageResponse {
  reply: string;
  state: InterviewState;
  action_type?: string;
  is_complete: boolean;
  scorecard: Scorecard | null;
}
