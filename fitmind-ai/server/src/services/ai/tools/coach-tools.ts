import { z } from "zod";

import { retrieveKnowledgeChunks } from "../../rag/knowledge-retriever.js";
import { searchDictionaryExercises } from "../../training/dictionary-service.js";
import { matchExercise } from "../../training/exercise-matching-service.js";
import {
  getUserMuscleLoad,
  type MuscleLoadResponseData,
} from "../../training/muscle-load-service.js";
import { getUserTrainingSummary } from "../../training/training-summary-service.js";
import { isValidDateOnly, type AiToolDefinition } from "./tool-types.js";

/** How far back "exercises you train" looks when ranking exercise matches. */
const RECENT_TRAINING_LOOKBACK_DAYS = 180;
const KNOWLEDGE_RESULT_LIMIT = 3;

const findExercisesArgsSchema = z
  .object({ query: z.string().trim().min(1).max(60) })
  .strict();

const dateRangeArgsSchema = z
  .object({
    start_date: z
      .string()
      .refine(isValidDateOnly, "start_date must use YYYY-MM-DD."),
    end_date: z
      .string()
      .refine(isValidDateOnly, "end_date must use YYYY-MM-DD."),
  })
  .strict()
  .refine((value) => value.start_date <= value.end_date, {
    path: ["end_date"],
    message: "end_date must be on or after start_date.",
  });

const knowledgeArgsSchema = z
  .object({ query: z.string().trim().min(1).max(200) })
  .strict();

export interface FindExercisesResult {
  query: string;
  /** Dictionary matches, exercises the user trained recently first. */
  candidates: Array<{
    exercise_id: string;
    exercise_name: string;
    trained_recently: boolean;
    recent_set_count: number;
  }>;
}

export interface TrainingKnowledgeResult {
  query: string;
  sources: Array<{
    id: string;
    title: string;
    category: string;
    chunk_text: string;
    source_type: "seed" | "imported";
    tags: string[];
  }>;
}

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function findExercises(
  userId: string,
  query: string,
): Promise<FindExercisesResult> {
  const [dictionary, recent] = await Promise.all([
    searchDictionaryExercises({}),
    getUserTrainingSummary(userId, {
      start_date: isoDateDaysAgo(RECENT_TRAINING_LOOKBACK_DAYS),
      end_date: isoDateDaysAgo(0),
    }),
  ]);
  const recentSets = new Map(
    recent.by_exercise.map((exercise) => [
      exercise.exercise_id,
      exercise.set_count,
    ]),
  );
  const match = matchExercise(query, dictionary.items);
  const candidates = match.candidate_exercises.map((candidate) => ({
    exercise_id: candidate.exercise_id,
    exercise_name: candidate.exercise_name,
    trained_recently: recentSets.has(candidate.exercise_id),
    recent_set_count: recentSets.get(candidate.exercise_id) ?? 0,
  }));

  candidates.sort((a, b) => b.recent_set_count - a.recent_set_count);

  return { query, candidates };
}

/**
 * Read-only tools the model-led coach uses besides the training tools:
 * resolving an exercise name to ids, muscle-group load, and the training
 * knowledge base. All of them only read the authenticated user's data or
 * shared reference data.
 */
export const coachAiTools = [
  {
    name: "find_exercises",
    description:
      "Resolve an exercise name to dictionary exercise ids, marking the ones the user trained recently.",
    inputSchema: findExercisesArgsSchema,
    execute: (context, args) => findExercises(context.userId, args.query),
  } satisfies AiToolDefinition<
    z.infer<typeof findExercisesArgsSchema>,
    FindExercisesResult
  >,
  {
    name: "get_muscle_load",
    description:
      "Return the user's training load per muscle group for one inclusive YYYY-MM-DD date range.",
    inputSchema: dateRangeArgsSchema,
    execute: (context, args) => getUserMuscleLoad(context.userId, args),
  } satisfies AiToolDefinition<
    z.infer<typeof dateRangeArgsSchema>,
    MuscleLoadResponseData
  >,
  {
    name: "search_training_knowledge",
    description:
      "Search the training knowledge base for technique and programming guidance.",
    inputSchema: knowledgeArgsSchema,
    execute: async (_context, args) => {
      const chunks = await retrieveKnowledgeChunks(
        args.query,
        KNOWLEDGE_RESULT_LIMIT,
      );

      return {
        query: args.query,
        sources: chunks.map((chunk) => ({
          id: chunk.id,
          title: chunk.title,
          category: chunk.category,
          chunk_text: chunk.chunk_text,
          source_type: chunk.source_type,
          tags: chunk.tags,
        })),
      };
    },
  } satisfies AiToolDefinition<
    z.infer<typeof knowledgeArgsSchema>,
    TrainingKnowledgeResult
  >,
] as const;
