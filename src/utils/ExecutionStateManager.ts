import { Todo } from "../types.js";

export type ExecutionState = 'pending' | 'ready' | 'running' | 'completed' | 'failed';

export interface StateTransitionRequest {
  todoId: string;
  newState: ExecutionState;
  error?: string;
}

export interface StateTransitionResult {
  success: boolean;
  updatedTodo: Todo;
  message: string;
}

export class ExecutionStateManager {
  private static readonly VALID_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
    'pending': ['ready', 'running'],
    'ready': ['running', 'pending'],
    'running': ['completed', 'failed', 'pending'],
    'completed': [], // completed is final
    'failed': ['pending'], // can retry
  };

  private pendingUpdates = new Map<string, Promise<StateTransitionResult>>();

  /**
   * Validates if a state transition is allowed
   */
  public isValidTransition(currentState: ExecutionState, newState: ExecutionState): boolean {
    const allowedStates = ExecutionStateManager.VALID_TRANSITIONS[currentState];
    return allowedStates.includes(newState);
  }

  /**
   * Updates the execution status of a todo with proper state validation
   */
  public async updateExecutionStatus(
    todo: Todo,
    request: StateTransitionRequest,
    updateTodoFn: (todoId: string, updates: Partial<Todo>) => Promise<Todo>
  ): Promise<StateTransitionResult> {
    // Ensure thread safety by preventing concurrent updates to the same todo
    const existingUpdate = this.pendingUpdates.get(request.todoId);
    if (existingUpdate) {
      return existingUpdate;
    }

    const updatePromise = this.performStateTransition(todo, request, updateTodoFn);
    this.pendingUpdates.set(request.todoId, updatePromise);

    try {
      const result = await updatePromise;
      return result;
    } finally {
      this.pendingUpdates.delete(request.todoId);
    }
  }

  private async performStateTransition(
    todo: Todo,
    request: StateTransitionRequest,
    updateTodoFn: (todoId: string, updates: Partial<Todo>) => Promise<Todo>
  ): Promise<StateTransitionResult> {
    const currentState = todo.executionStatus?.state || 'pending';
    const newState = request.newState;

    // Validate state transition
    if (!this.isValidTransition(currentState, newState)) {
      return {
        success: false,
        updatedTodo: todo,
        message: `Invalid state transition from ${currentState} to ${newState}`
      };
    }

    // Prepare new execution status
    const currentStatus = todo.executionStatus || { state: 'pending' };
    let newAttempts = currentStatus.attempts || 0;
    let errorMessage = currentStatus.lastError;

    // Handle attempt counting and error management
    if (newState === 'running' || (currentState === 'failed' && newState === 'pending')) {
      // Increment attempts when starting execution or retrying from failed
      newAttempts++;
    }

    if (request.error !== undefined) {
      // Set or update error message
      errorMessage = request.error;
    } else if (newState === 'completed') {
      // Clear error on successful completion
      errorMessage = undefined;
    } else if (currentState === 'failed' && newState === 'pending') {
      // Clear error when retrying from failed state
      errorMessage = undefined;
    }

    // Update the todo
    const executionStatus: any = {
      state: newState,
      attempts: newAttempts,
    };
    if (errorMessage !== undefined) {
      executionStatus.lastError = errorMessage;
    }

    const updatedTodo = await updateTodoFn(request.todoId, {
      executionStatus,
    });

    return {
      success: true,
      updatedTodo,
      message: `Execution status updated: ${currentState} → ${newState} (attempts: ${newAttempts})`
    };
  }

  /**
   * Checks if all subtasks in a group are completed and updates main task accordingly
   */
  public async checkAndCompleteMainTask(
    groupId: string,
    getAllTodosFn: () => Todo[],
    updateTodoFn: (todoId: string, updates: Partial<Todo>) => Promise<Todo>
  ): Promise<{ mainTaskCompleted: boolean; mainTask?: Todo }> {
    const allTodos = getAllTodosFn();
    const groupTasks = allTodos.filter(todo => todo.groupId === groupId);
    
    if (groupTasks.length === 0) {
      return { mainTaskCompleted: false };
    }

    // Find the main task (executionOrder = 0)
    const mainTask = groupTasks.find(todo => todo.executionOrder === 0);
    if (!mainTask) {
      return { mainTaskCompleted: false };
    }

    // Check if main task is already completed
    if (mainTask.completed || mainTask.executionStatus?.state === 'completed') {
      return { mainTaskCompleted: true, mainTask };
    }

    // Get all subtasks (executionOrder > 0)
    const subtasks = groupTasks.filter(todo => todo.executionOrder !== undefined && todo.executionOrder > 0);
    
    if (subtasks.length === 0) {
      return { mainTaskCompleted: false, mainTask };
    }

    // Check if all subtasks are completed
    const allSubtasksCompleted = subtasks.every(task => 
      task.completed || task.executionStatus?.state === 'completed'
    );

    if (allSubtasksCompleted) {
      // Complete the main task
      const completedMainTask = await updateTodoFn(mainTask.id, {
        completed: true,
        executionStatus: {
          ...mainTask.executionStatus,
          state: 'completed' as ExecutionState,
        },
        // Auto-verify if it has a verification method
        ...(mainTask.verificationMethod && { verificationStatus: 'verified' as const })
      });

      return { mainTaskCompleted: true, mainTask: completedMainTask };
    }

    return { mainTaskCompleted: false, mainTask };
  }

  /**
   * Gets execution statistics for a group
   */
  public getGroupExecutionStats(groupId: string, getAllTodosFn: () => Todo[]) {
    const allTodos = getAllTodosFn();
    const groupTasks = allTodos.filter(todo => todo.groupId === groupId);

    const stats = {
      total: groupTasks.length,
      pending: 0,
      ready: 0,
      running: 0,
      completed: 0,
      failed: 0
    };

    groupTasks.forEach(todo => {
      const state = todo.executionStatus?.state || 'pending';
      if (todo.completed) {
        stats.completed++;
      } else {
        stats[state]++;
      }
    });

    return stats;
  }

  /**
   * Resets execution state for failed tasks
   */
  public async resetFailedTask(
    todoId: string,
    resetDependents: boolean,
    getAllTodosFn: () => Todo[],
    updateTodoFn: (todoId: string, updates: Partial<Todo>) => Promise<Todo>
  ): Promise<{ resetTasks: Todo[] }> {
    const todo = getAllTodosFn().find(t => t.id === todoId);
    if (!todo) {
      throw new Error(`Todo with ID ${todoId} not found`);
    }

    if (todo.executionStatus?.state !== 'failed') {
      throw new Error(`Todo ${todoId} is not in failed state`);
    }

    const resetTasks: Todo[] = [];

    // Reset the failed task
    const resetTodo = await updateTodoFn(todoId, {
      executionStatus: {
        state: 'pending',
        attempts: 0,
      },
    });
    resetTasks.push(resetTodo);

    // Reset dependent tasks if requested
    if (resetDependents) {
      const allTodos = getAllTodosFn();
      const dependentTasks = allTodos.filter(t => 
        t.dependencies?.includes(todoId) && 
        (t.executionStatus?.state === 'failed' || t.completed)
      );

      for (const dependent of dependentTasks) {
        const resetDependent = await updateTodoFn(dependent.id, {
          completed: false,
          executionStatus: {
            state: 'pending',
            attempts: 0,
          },
        });
        resetTasks.push(resetDependent);
      }
    }

    return { resetTasks };
  }
}