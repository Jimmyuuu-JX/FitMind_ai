import { Router } from "express";

import {
  deleteAssistantSavedInsightController,
  getAssistantSavedInsightController,
  listAssistantSavedInsightsController,
  postAssistantSavedInsightController,
} from "../controllers/assistant-saved-insights-controller.js";
import { getAssistantSessionMessagesController } from "../controllers/assistant-session-controller.js";
import {
  postAssistantStreamTurnController,
  postMockAssistantTurnController,
} from "../controllers/assistant-stream-controller.js";
import {
  aiRateLimitMiddleware,
  createAiRateLimitMiddleware,
} from "../middleware/ai-rate-limit-middleware.js";
import {
  createAssistantIpRateLimitMiddleware,
  getDefaultAssistantIpRateLimitMiddleware,
} from "../middleware/assistant-ip-rate-limit-middleware.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import type { AiRateLimiter } from "../services/assistant/ai-rate-limiter.js";

export interface AssistantRouterOptions {
  /** Per-user AI turn limiter; defaults to the process-wide limiter. */
  aiRateLimiter?: AiRateLimiter | undefined;
  /** Per-IP real-provider limiter; defaults to the process-wide limiter. */
  ipRateLimiter?: AiRateLimiter | undefined;
}

/**
 * Creates the assistant router. Without options it uses the process-wide
 * limiters, so every default router shares one set of counters.
 *
 * @param options - Optional limiter overrides for tests and the turn eval.
 * @returns Express router for `/api/assistant`.
 */
export function createAssistantRouter(options?: AssistantRouterOptions) {
  const assistantApiRouter = Router();
  const turnRateLimit =
    options?.aiRateLimiter === undefined
      ? aiRateLimitMiddleware
      : createAiRateLimitMiddleware(options.aiRateLimiter);
  const turnIpRateLimit =
    options?.ipRateLimiter === undefined
      ? getDefaultAssistantIpRateLimitMiddleware()
      : createAssistantIpRateLimitMiddleware({
          limiter: options.ipRateLimiter,
        });

  assistantApiRouter.use("/assistant", authMiddleware);

  assistantApiRouter.post(
    "/assistant/insights",
    postAssistantSavedInsightController,
  );
  assistantApiRouter.get(
    "/assistant/insights",
    listAssistantSavedInsightsController,
  );
  assistantApiRouter.get(
    "/assistant/insights/:id",
    getAssistantSavedInsightController,
  );
  assistantApiRouter.delete(
    "/assistant/insights/:id",
    deleteAssistantSavedInsightController,
  );
  assistantApiRouter.get(
    "/assistant/sessions/:id/messages",
    getAssistantSessionMessagesController,
  );
  assistantApiRouter.post(
    "/assistant/mock-turn",
    turnRateLimit,
    turnIpRateLimit,
    postMockAssistantTurnController,
  );
  assistantApiRouter.post(
    "/assistant/stream-turn",
    turnRateLimit,
    turnIpRateLimit,
    postAssistantStreamTurnController,
  );

  return assistantApiRouter;
}

export const assistantRouter = createAssistantRouter();
