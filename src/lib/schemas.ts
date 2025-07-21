import { z } from "zod";

export const CreateTodoSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  groupId: z.string().optional(),
  verificationMethod: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  executionOrder: z.number().optional(),
  executionConfig: z.object({
    toolsRequired: z.array(z.string()).optional(),
    params: z.record(z.any()).optional(),
    retryOnFailure: z.boolean().optional(),
  }).optional(),
  executionStatus: z.object({
    state: z.enum(['pending', 'ready', 'running', 'completed', 'failed']),
    lastError: z.string().optional(),
    attempts: z.number().optional(),
  }).optional(),
});

export const UpdateTodoSchema = z.object({
  id: z.string().min(1, "ID cannot be empty"),
  title: z.string().min(1, "Title cannot be empty").optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  groupId: z.string().optional(),
  verificationMethod: z.string().optional(),
  verificationStatus: z.enum(['pending', 'verified', 'failed']).optional(),
  verificationNotes: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  executionOrder: z.number().optional(),
  executionConfig: z.object({
    toolsRequired: z.array(z.string()).optional(),
    params: z.record(z.any()).optional(),
    retryOnFailure: z.boolean().optional(),
  }).optional(),
  executionStatus: z.object({
    state: z.enum(['pending', 'ready', 'running', 'completed', 'failed']),
    lastError: z.string().optional(),
    attempts: z.number().optional(),
  }).optional(),
}).refine(
  (data) => Object.keys(data).some(key => key !== 'id' && data[key as keyof typeof data] !== undefined),
  { message: "At least one field must be provided for update" }
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

export const SetVerificationMethodSchema = z.object({
  todoId: z.string().min(1, "Todo ID cannot be empty"),
  method: z.string().min(1, "Verification method cannot be empty"),
  notes: z.string().optional(),
});

export const UpdateVerificationStatusSchema = z.object({
  todoId: z.string().min(1, "Todo ID cannot be empty"),
  status: z.enum(['pending', 'verified', 'failed']),
  notes: z.string().optional(),
});

export const GetTodosNeedingVerificationSchema = z.object({
  groupId: z.string().optional(),
});