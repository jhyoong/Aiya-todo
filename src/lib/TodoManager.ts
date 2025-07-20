import { Todo, CreateTodoRequest, UpdateTodoRequest, DeleteTodoRequest, ListTodosRequest, TodoStore } from "../types.js";
import { TodoPersistence } from "./TodoPersistence.js";

export class TodoManager {
  private store: TodoStore = {
    todos: new Map(),
    nextId: 1,
  };
  private persistence: TodoPersistence;

  constructor(persistence?: TodoPersistence) {
    this.persistence = persistence || new TodoPersistence();
  }

  async initialize(): Promise<void> {
    try {
      const loaded = await this.persistence.loadTodos();
      this.store.todos = loaded.todos;
      this.store.nextId = loaded.nextId;
    } catch (error) {
      console.error("Failed to initialize TodoManager:", error);
      throw error;
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      await this.persistence.saveTodos(this.store.todos, this.store.nextId);
    } catch (error) {
      console.error("Failed to save todos:", error);
    }
  }

  async createTodo(request: CreateTodoRequest): Promise<Todo> {
    if (!request.title || request.title.trim().length === 0) {
      throw new Error("Todo title cannot be empty");
    }

    const todo: Todo = {
      id: this.store.nextId.toString(),
      title: request.title.trim(),
      completed: false,
      createdAt: new Date(),
    };

    this.store.todos.set(todo.id, todo);
    this.store.nextId++;
    
    await this.saveToFile();
    return todo;
  }

  getTodo(id: string): Todo | undefined {
    return this.store.todos.get(id);
  }

  getAllTodos(): Todo[] {
    return this.listTodos({});
  }

  listTodos(request: ListTodosRequest): Todo[] {
    const todos = Array.from(this.store.todos.values());
    
    if (request.completed !== undefined) {
      return todos.filter(todo => todo.completed === request.completed);
    }
    
    return todos;
  }

  async updateTodo(request: UpdateTodoRequest): Promise<Todo> {
    const existingTodo = this.store.todos.get(request.id);
    if (!existingTodo) {
      throw new Error(`Todo with ID ${request.id} not found`);
    }

    const updatedTodo: Todo = {
      ...existingTodo,
      ...(request.title !== undefined && { title: request.title.trim() }),
      ...(request.completed !== undefined && { completed: request.completed }),
    };

    if (request.title !== undefined && request.title.trim().length === 0) {
      throw new Error("Todo title cannot be empty");
    }

    this.store.todos.set(request.id, updatedTodo);
    await this.saveToFile();
    return updatedTodo;
  }

  async deleteTodo(request: DeleteTodoRequest): Promise<boolean> {
    const exists = this.store.todos.has(request.id);
    if (!exists) {
      throw new Error(`Todo with ID ${request.id} not found`);
    }
    
    const result = this.store.todos.delete(request.id);
    await this.saveToFile();
    return result;
  }
}