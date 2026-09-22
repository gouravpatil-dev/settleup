import { Router } from "express";
import { BalanceService } from "../services/BalanceService.js";
import { getDb } from "../db/connection.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { groupIdParamsSchema } from "../schemas/groupSchemas.js";

// mergeParams: true so this router can read :groupId from the parent
// (groupsRouter), which also applies requireAuth before mounting this.
export const balancesRouter = Router({ mergeParams: true });

balancesRouter.get(
  "/",
  validate(groupIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const balanceService = new BalanceService(getDb());
    const balances = balanceService.getGroupBalances(req.params.groupId, req.user!.id);
    res.status(200).json({ balances });
  })
);
