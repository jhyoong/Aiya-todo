import { promises as fs } from "fs";
import { Todo } from "../types.js";

export class TodoPersistence {
  private filePath: string;

  constructor(filePath: string = "./todos.json") {
    this.filePath = filePath;
  }

  async saveTodos(todos: Map<string, Todo>, nextId: number): Promise<void> {
    const data = {
      todos: Array.from(todos.entries()).map(([_, todo]) => ({
        ...todo,
        createdAt: todo.createdAt.toISOString(),
      })),
      nextId,
    };

    try {
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save todos:", error);
      throw new Error("Failed to save todos to file");
    }
  }

  async loadTodos(): Promise<{ todos: Map<string, Todo>; nextId: number }> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(data);
      
      const todos = new Map<string, Todo>();
      parsed.todos.forEach((item: any) => {
        const todo: Todo = {
          id: item.id,
          title: item.title,
          completed: item.completed,
          createdAt: new Date(item.createdAt),
        };
        todos.set(item.id, todo);
      });

      return {
        todos,
        nextId: parsed.nextId || 1,
      };
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return { todos: new Map(), nextId: 1 };
      }
      console.error("Failed to load todos:", error);
      throw new Error("Failed to load todos from file");
    }
  }
}