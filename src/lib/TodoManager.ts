import { Todo, CreateTodoRequest, UpdateTodoRequest, DeleteTodoRequest, ListTodosRequest, TodoStore, SetVerificationMethodRequest, UpdateVerificationStatusRequest, GetTodosNeedingVerificationRequest } from "../types.js";
import { TodoPersistence } from "./TodoPersistence.js";
import { DependencyResolver } from "../utils/DependencyResolver.js";

export class TodoManager {
  private store: TodoStore = {
    todos: new Map(),
    nextId: 1,
  };
  private persistence: TodoPersistence;
  private dependencyResolver: DependencyResolver;
  private saveQueue: (() => void)[] = [];
  private isSaving: boolean = false;

  constructor(persistence?: TodoPersistence) {
    this.persistence = persistence || new TodoPersistence();
    this.dependencyResolver = new DependencyResolver();
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

    // Validate dependencies if provided
    if (request.dependencies && request.dependencies.length > 0) {
      const allTodos = this.getAllTodos();
      this.dependencyResolver.validateDependencies(
        this.store.nextId.toString(),
        request.dependencies,
        allTodos
      );
    }

    const todo: Todo = {
      id: this.store.nextId.toString(),
      title: request.title.trim(),
      completed: false,
      createdAt: new Date(),
      ...(request.description && { description: request.description }),
      ...(request.tags && { tags: request.tags }),
      ...(request.groupId && { groupId: request.groupId }),
      ...(request.verificationMethod && { verificationMethod: request.verificationMethod }),
      ...(request.dependencies && { dependencies: request.dependencies }),
      ...(request.executionOrder !== undefined && { executionOrder: request.executionOrder }),
      ...(request.executionConfig && { executionConfig: request.executionConfig }),
      ...(request.executionStatus && { executionStatus: request.executionStatus }),
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

    if (request.title !== undefined && request.title.trim().length === 0) {
      throw new Error("Todo title cannot be empty");
    }

    // Validate dependencies if they are being updated
    if (request.dependencies !== undefined && request.dependencies.length > 0) {
      const allTodos = this.getAllTodos();
      this.dependencyResolver.validateDependencies(
        request.id,
        request.dependencies,
        allTodos
      );
    }

    const updatedTodo: Todo = {
      ...existingTodo,
      ...(request.title !== undefined && { title: request.title.trim() }),
      ...(request.description !== undefined && { description: request.description }),
      ...(request.completed !== undefined && { completed: request.completed }),
      ...(request.tags !== undefined && { tags: request.tags }),
      ...(request.groupId !== undefined && { groupId: request.groupId }),
      ...(request.verificationMethod !== undefined && { verificationMethod: request.verificationMethod }),
      ...(request.verificationStatus !== undefined && { verificationStatus: request.verificationStatus }),
      ...(request.verificationNotes !== undefined && { verificationNotes: request.verificationNotes }),
      ...(request.dependencies !== undefined && { dependencies: request.dependencies }),
      ...(request.executionOrder !== undefined && { executionOrder: request.executionOrder }),
      ...(request.executionConfig !== undefined && { executionConfig: request.executionConfig }),
      ...(request.executionStatus !== undefined && { executionStatus: request.executionStatus }),
    };

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

  async setVerificationMethod(request: SetVerificationMethodRequest): Promise<Todo> {
    const existingTodo = this.store.todos.get(request.todoId);
    if (!existingTodo) {
      throw new Error(`Todo with ID ${request.todoId} not found`);
    }

    const updatedTodo: Todo = {
      ...existingTodo,
      verificationMethod: request.method,
      verificationStatus: 'pending',
      ...(request.notes && { verificationNotes: request.notes }),
    };

    this.store.todos.set(request.todoId, updatedTodo);
    await this.saveToFile();
    return updatedTodo;
  }

  async updateVerificationStatus(request: UpdateVerificationStatusRequest): Promise<Todo> {
    const existingTodo = this.store.todos.get(request.todoId);
    if (!existingTodo) {
      throw new Error(`Todo with ID ${request.todoId} not found`);
    }

    const updatedTodo: Todo = {
      ...existingTodo,
      verificationStatus: request.status,
      ...(request.notes !== undefined && { verificationNotes: request.notes }),
    };

    this.store.todos.set(request.todoId, updatedTodo);
    await this.saveToFile();
    return updatedTodo;
  }

  getTodosNeedingVerification(request: GetTodosNeedingVerificationRequest): Todo[] {
    const todos = Array.from(this.store.todos.values());
    
    const needingVerification = todos.filter(todo => {
      const hasVerificationMethod = todo.verificationMethod !== undefined;
      const isPending = todo.verificationStatus === 'pending' || todo.verificationStatus === undefined;
      const matchesGroup = request.groupId === undefined || todo.groupId === request.groupId;
      
      return hasVerificationMethod && isPending && matchesGroup;
    });
    
    return needingVerification;
  }

  getReadyTasks(groupId?: string): Todo[] {
    const allTodos = this.getAllTodos();
    const readyTasks = this.dependencyResolver.getReadyTasks(allTodos);
    
    if (groupId !== undefined) {
      return readyTasks.filter(todo => todo.groupId === groupId);
    }
    
    return readyTasks;
  }
}