import type { Request, Response } from "express";
import { z } from "zod";

import { getAssistantSessionMessages } from "../services/assistant-session-service.js";
import { createSuccessResponse } from "../utils/api-response.js";

type AuthLocals = {
  userId: string;
};

const assistantSessionParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * `GET /api/assistant/sessions/:id/messages` — read back one owned session.
 *
 * @param req - Express request carrying the session id path parameter.
 * @param res - Express response with the authenticated user id in locals.
 * @returns The JSON response.
 */
export async function getAssistantSessionMessagesController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = assistantSessionParamsSchema.parse(req.params);
  const result = await getAssistantSessionMessages({
    sessionId: params.id,
    userId: res.locals.userId,
  });

  return res.status(200).json(createSuccessResponse(result));
}
