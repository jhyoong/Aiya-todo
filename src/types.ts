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
  dependencies?: string[];
  executionOrder?: number;
  executionConfig?: {
    toolsRequired?: string[];
    params?: Record<string, any>;
    retryOnFailure?: boolean;
  };
  executionStatus?: {
    state: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
    lastError?: string;
    attempts?: number;
  };
}

export interface CreateTodoRequest {
  title: string;
  description?: string;
  tags?: string[];
  groupId?: string;
  verificationMethod?: string;
  dependencies?: string[];
  executionOrder?: number;
  executionConfig?: {
    toolsRequired?: string[];
    params?: Record<string, any>;
    retryOnFailure?: boolean;
  };
  executionStatus?: {
    state: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
    lastError?: string;
    attempts?: number;
  };
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
  dependencies?: string[];
  executionOrder?: number;
  executionConfig?: {
    toolsRequired?: string[];
    params?: Record<string, any>;
    retryOnFailure?: boolean;
  };
  executionStatus?: {
    state: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
    lastError?: string;
    attempts?: number;
  };
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

export interface CreateTaskGroupRequest {
  mainTask: {
    title: string;
    description?: string;
    tags?: string[];
  };
  subtasks: {
    title: string;
    description?: string;
    dependencies?: number[];
    executionConfig?: {
      toolsRequired?: string[];
      params?: Record<string, any>;
      retryOnFailure?: boolean;
    };
  }[];
  groupId?: string;
}

export interface GetExecutableTasksRequest {
  groupId?: string;
  limit?: number;
}

export interface UpdateExecutionStatusRequest {
  todoId: string;
  state: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface TodoStore {
  todos: Map<string, Todo>;
  nextId: number;
}