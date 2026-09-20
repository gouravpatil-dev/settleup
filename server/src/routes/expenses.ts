import { Router } from "express";
import { ExpenseService } from "../services/ExpenseService.js";
import { getDb } from "../db/connection.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createExpenseSchema, expenseIdParamsSchema } from "../schemas/expenseSchemas.js";
import { groupIdParamsSchema } from "../schemas/groupSchemas.js";

// mergeParams: true so this router can read :groupId from the parent
// (groupsRouter), which also applies requireAuth before mounting this.
export const expensesRouter = Router({ mergeParams: true });

expensesRouter.post(
  "/",
  validate(groupIdParamsSchema, "params"),
  validate(createExpenseSchema),
  asyncHandler(async (req, res) => {
    const expenseService = new ExpenseService(getDb());
    const { splitType, participants, ...rest } = req.body;

    const expense = expenseService.createExpense(req.params.groupId, req.user!.id, {
      ...rest,
      split: { splitType, participants },
    });

    res.status(201).json({ expense });
  })
);

expensesRouter.get(
  "/",
  validate(groupIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const expenseService = new ExpenseService(getDb());
    const expenses = expenseService.listExpensesForGroup(req.params.groupId, req.user!.id);
    res.status(200).json({ expenses });
  })
);

expensesRouter.get(
  "/:expenseId",
  validate(expenseIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const expenseService = new ExpenseService(getDb());
    const expense = expenseService.getExpense(
      req.params.groupId,
      req.params.expenseId,
      req.user!.id
    );
    res.status(200).json({ expense });
  })
);
