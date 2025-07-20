import { z } from "zod";

export const CreateTodoSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
});

export const UpdateTodoSchema = z.object({
  id: z.string().min(1, "ID cannot be empty"),
  title: z.string().min(1, "Title cannot be empty").optional(),
  completed: z.boolean().optional(),
}).refine(
  (data) => data.title !== undefined || data.completed !== undefined,
  { message: "At least one field (title or completed) must be provided" }
);

export const DeleteTodoSchema = z.object({
  id: z.string().min(1, "ID cannot be empty"),
});

export const GetTodoSchema = z.object({
  id: z.string().min(1, "ID cannot be empty"),
});

export const ListTodosSchema = z.object({
  completed: z.boolean().optional(),
});