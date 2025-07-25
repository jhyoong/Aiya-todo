export { TodoManager } from "./TodoManager.js";
export { TodoPersistence } from "./TodoPersistence.js";
export { DependencyResolver } from "../utils/DependencyResolver.js";
export {
  CreateTodoSchema,
  UpdateTodoSchema,
  DeleteTodoSchema,
  GetTodoSchema,
  ListTodosSchema,
  SetVerificationMethodSchema,
  UpdateVerificationStatusSchema,
  GetTodosNeedingVerificationSchema,
} from "./schemas.js";

export * from "../types.js";

import { TodoManager } from "./TodoManager.js";
import { TodoPersistence } from "./TodoPersistence.js";

export function createTodoManager(filePath?: string): TodoManager {
  const persistence = new TodoPersistence(filePath);
  return new TodoManager(persistence);
}