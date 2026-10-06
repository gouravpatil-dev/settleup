import { Router } from "express";
import { SettlementService } from "../services/SettlementService.js";
import { getDb } from "../db/connection.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { groupIdParamsSchema } from "../schemas/groupSchemas.js";
import { recordSettlementSchema, settlementIdParamsSchema } from "../schemas/settlementSchemas.js";

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

settlementsRouter.get(
  "/explanation",
  validate(groupIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const settlementService = new SettlementService(getDb());
    const explanation = settlementService.getSettlementExplanation(
      req.params.groupId,
      req.user!.id
    );
    res.status(200).json(explanation);
  })
);

settlementsRouter.get(
  "/",
  validate(groupIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const settlementService = new SettlementService(getDb());
    const settlements = settlementService.listSettlementHistory(req.params.groupId, req.user!.id);
    res.status(200).json({ settlements });
  })
);

settlementsRouter.post(
  "/",
  validate(groupIdParamsSchema, "params"),
  validate(recordSettlementSchema),
  asyncHandler(async (req, res) => {
    const settlementService = new SettlementService(getDb());
    const settlement = settlementService.recordSettlement(
      req.params.groupId,
      req.user!.id,
      req.body
    );
    res.status(201).json({ settlement });
  })
);

settlementsRouter.delete(
  "/:settlementId",
  validate(settlementIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const settlementService = new SettlementService(getDb());
    settlementService.deleteSettlement(req.params.groupId, req.user!.id, req.params.settlementId);
    res.status(204).send();
  })
);
