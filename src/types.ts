export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  tags?: string[];
  groupId?: string;
  verificationMethod?: string;
  verificationStatus?: 'pending' | 'verified' | 'failed';
  verificationNotes?: string;
}

export interface CreateTodoRequest {
  title: string;
  description?: string;
  tags?: string[];
  groupId?: string;
  verificationMethod?: string;
}

export interface UpdateTodoRequest {
  id: string;
  title?: string;
  description?: string;
  completed?: boolean;
  tags?: string[];
  groupId?: string;
  verificationMethod?: string;
  verificationStatus?: 'pending' | 'verified' | 'failed';
  verificationNotes?: string;
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

export interface SetVerificationMethodRequest {
  todoId: string;
  method: string;
  notes?: string;
}

export interface UpdateVerificationStatusRequest {
  todoId: string;
  status: 'pending' | 'verified' | 'failed';
  notes?: string;
}

export interface GetTodosNeedingVerificationRequest {
  groupId?: string;
}

export interface TodoStore {
  todos: Map<string, Todo>;
  nextId: number;
}