export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface CreateTodoRequest {
  title: string;
}

export interface UpdateTodoRequest {
  id: string;
  title?: string;
  completed?: boolean;
}

export interface DeleteTodoRequest {
  id: string;
}

export interface GetTodoRequest {
  id: string;
}

export interface ListTodosRequest {
  completed?: boolean;
}

export interface TodoStore {
  todos: Map<string, Todo>;
  nextId: number;
}