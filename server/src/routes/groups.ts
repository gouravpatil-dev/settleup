import { Router } from "express";
import { GroupService } from "../services/GroupService.js";
import { getDb } from "../db/connection.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { expensesRouter } from "./expenses.js";
import {
  createGroupSchema,
  renameGroupSchema,
  addMemberSchema,
  groupIdParamsSchema,
  groupMemberParamsSchema,
} from "../schemas/groupSchemas.js";

export const groupsRouter = Router();

// Every route below requires a valid session.
groupsRouter.use(requireAuth);

groupsRouter.use("/:groupId/expenses", expensesRouter);

groupsRouter.post(
  "/",
  validate(createGroupSchema),
  asyncHandler(async (req, res) => {
    const groupService = new GroupService(getDb());
    const group = groupService.createGroup({ name: req.body.name, ownerId: req.user!.id });
    res.status(201).json({ group });
  })
);

groupsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const groupService = new GroupService(getDb());
    const groups = groupService.listGroupsForUser(req.user!.id);
    res.status(200).json({ groups });
  })
);

groupsRouter.get(
  "/:groupId",
  validate(groupIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const groupService = new GroupService(getDb());
    const group = groupService.getGroupForMember(req.params.groupId, req.user!.id);
    res.status(200).json({ group });
  })
);

groupsRouter.patch(
  "/:groupId",
  validate(groupIdParamsSchema, "params"),
  validate(renameGroupSchema),
  asyncHandler(async (req, res) => {
    const groupService = new GroupService(getDb());
    const group = groupService.renameGroup(req.params.groupId, req.user!.id, req.body.name);
    res.status(200).json({ group });
  })
);

groupsRouter.delete(
  "/:groupId",
  validate(groupIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const groupService = new GroupService(getDb());
    groupService.deleteGroup(req.params.groupId, req.user!.id);
    res.status(204).send();
  })
);

groupsRouter.get(
  "/:groupId/members",
  validate(groupIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const groupService = new GroupService(getDb());
    const members = groupService.listMembers(req.params.groupId, req.user!.id);
    res.status(200).json({ members });
  })
);

groupsRouter.post(
  "/:groupId/members",
  validate(groupIdParamsSchema, "params"),
  validate(addMemberSchema),
  asyncHandler(async (req, res) => {
    const groupService = new GroupService(getDb());
    const member = groupService.addMember(req.params.groupId, req.user!.id, req.body.email);
    res.status(201).json({ member });
  })
);

groupsRouter.delete(
  "/:groupId/members/:userId",
  validate(groupMemberParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const groupService = new GroupService(getDb());
    groupService.removeMember(req.params.groupId, req.user!.id, req.params.userId);
    res.status(204).send();
  })
);
