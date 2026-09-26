import { Router } from "express";
import { SettlementService } from "../services/SettlementService.js";
import { getDb } from "../db/connection.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { groupIdParamsSchema } from "../schemas/groupSchemas.js";

// mergeParams: true so this router can read :groupId from the parent
// (groupsRouter), which also applies requireAuth before mounting this.
export const settlementsRouter = Router({ mergeParams: true });

settlementsRouter.get(
  "/plan",
  validate(groupIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const settlementService = new SettlementService(getDb());
    const transactions = settlementService.getSettlementPlan(req.params.groupId, req.user!.id);
    res.status(200).json({ transactions });
  })
);
