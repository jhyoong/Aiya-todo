import { Todo, CreateTodoRequest, UpdateTodoRequest, DeleteTodoRequest, ListTodosRequest, TodoStore } from "../types.js";
import { TodoPersistence } from "./TodoPersistence.js";

export class TodoManager {
  private store: TodoStore = {
    todos: new Map(),
    nextId: 1,
  };
  private persistence: TodoPersistence;
  private saveQueue: (() => void)[] = [];
  private isSaving: boolean = false;

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

  private async processQueue(): Promise<void> {
    if (this.isSaving || this.saveQueue.length === 0) {
      return;
    }

    this.isSaving = true;
    
    try {
      await this.persistence.saveTodos(this.store.todos, this.store.nextId);
      
      // Resolve all pending promises
      const resolvers = [...this.saveQueue];
      this.saveQueue = [];
      resolvers.forEach(resolve => resolve());
    } catch (error) {
      console.error("Failed to save todos:", error);
      // Reject all pending promises
      const resolvers = [...this.saveQueue];
      this.saveQueue = [];
      resolvers.forEach(resolve => resolve());
    } finally {
      this.isSaving = false;
      
      // Process any new items that were added while saving
      if (this.saveQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  private async saveToFile(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.saveQueue.push(resolve);
      setImmediate(() => this.processQueue());
    });
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