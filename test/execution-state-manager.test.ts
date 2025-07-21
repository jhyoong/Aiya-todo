import { ExecutionStateManager } from '../src/utils/ExecutionStateManager.js';
import { Todo } from '../src/types.js';

describe('ExecutionStateManager', () => {
  let executionStateManager: ExecutionStateManager;
  let mockTodos: Map<string, Todo>;
  let nextId: number;

  const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
    id: (nextId++).toString(),
    title: 'Test Todo',
    completed: false,
    createdAt: new Date(),
    ...overrides
  });

  const mockUpdateTodoFn = async (todoId: string, updates: Partial<Todo>): Promise<Todo> => {
    const existingTodo = mockTodos.get(todoId);
    if (!existingTodo) {
      throw new Error(`Todo with ID ${todoId} not found`);
    }
    const updatedTodo = { ...existingTodo, ...updates };
    mockTodos.set(todoId, updatedTodo);
    return updatedTodo;
  };

  const mockGetAllTodosFn = (): Todo[] => {
    return Array.from(mockTodos.values());
  };

  beforeEach(() => {
    executionStateManager = new ExecutionStateManager();
    mockTodos = new Map();
    nextId = 1;
  });

  describe('State Transition Validation', () => {
    it('should allow valid state transitions', () => {
      expect(executionStateManager.isValidTransition('pending', 'ready')).toBe(true);
      expect(executionStateManager.isValidTransition('pending', 'running')).toBe(true);
      expect(executionStateManager.isValidTransition('ready', 'running')).toBe(true);
      expect(executionStateManager.isValidTransition('ready', 'pending')).toBe(true);
      expect(executionStateManager.isValidTransition('running', 'completed')).toBe(true);
      expect(executionStateManager.isValidTransition('running', 'failed')).toBe(true);
      expect(executionStateManager.isValidTransition('running', 'pending')).toBe(true);
      expect(executionStateManager.isValidTransition('failed', 'pending')).toBe(true);
    });

    it('should reject invalid state transitions', () => {
      expect(executionStateManager.isValidTransition('completed', 'pending')).toBe(false);
      expect(executionStateManager.isValidTransition('completed', 'running')).toBe(false);
      expect(executionStateManager.isValidTransition('pending', 'completed')).toBe(false);
      expect(executionStateManager.isValidTransition('ready', 'completed')).toBe(false);
      expect(executionStateManager.isValidTransition('failed', 'completed')).toBe(false);
      expect(executionStateManager.isValidTransition('failed', 'running')).toBe(false);
    });
  });

  describe('updateExecutionStatus', () => {
    it('should successfully update state with valid transition', async () => {
      const todo = createMockTodo({
        executionStatus: { state: 'pending' }
      });
      mockTodos.set(todo.id, todo);

      const result = await executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'running' },
        mockUpdateTodoFn
      );

      expect(result.success).toBe(true);
      expect(result.updatedTodo.executionStatus?.state).toBe('running');
      expect(result.updatedTodo.executionStatus?.attempts).toBe(1);
    });

    it('should reject invalid state transition', async () => {
      const todo = createMockTodo({
        executionStatus: { state: 'completed' }
      });
      mockTodos.set(todo.id, todo);

      const result = await executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'pending' },
        mockUpdateTodoFn
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid state transition');
    });

    it('should increment attempts when transitioning to running', async () => {
      const todo = createMockTodo({
        executionStatus: { state: 'pending', attempts: 2 }
      });
      mockTodos.set(todo.id, todo);

      const result = await executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'running' },
        mockUpdateTodoFn
      );

      expect(result.success).toBe(true);
      expect(result.updatedTodo.executionStatus?.attempts).toBe(3);
    });

    it('should increment attempts when retrying from failed', async () => {
      const todo = createMockTodo({
        executionStatus: { state: 'failed', attempts: 1 }
      });
      mockTodos.set(todo.id, todo);

      const result = await executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'pending' },
        mockUpdateTodoFn
      );

      expect(result.success).toBe(true);
      expect(result.updatedTodo.executionStatus?.attempts).toBe(2);
    });

    it('should store error messages on failure', async () => {
      const todo = createMockTodo({
        executionStatus: { state: 'running' }
      });
      mockTodos.set(todo.id, todo);

      const errorMessage = 'Connection timeout';
      const result = await executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'failed', error: errorMessage },
        mockUpdateTodoFn
      );

      expect(result.success).toBe(true);
      expect(result.updatedTodo.executionStatus?.lastError).toBe(errorMessage);
    });

    it('should clear error messages on successful completion', async () => {
      const todo = createMockTodo({
        executionStatus: { 
          state: 'running', 
          lastError: 'Previous error',
          attempts: 1 
        }
      });
      mockTodos.set(todo.id, todo);

      const result = await executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'completed' },
        mockUpdateTodoFn
      );

      expect(result.success).toBe(true);
      expect(result.updatedTodo.executionStatus?.lastError).toBeUndefined();
    });

    it('should clear error when retrying from failed state', async () => {
      const todo = createMockTodo({
        executionStatus: { 
          state: 'failed', 
          lastError: 'Some error',
          attempts: 1 
        }
      });
      mockTodos.set(todo.id, todo);

      const result = await executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'pending' },
        mockUpdateTodoFn
      );

      expect(result.success).toBe(true);
      expect(result.updatedTodo.executionStatus?.lastError).toBeUndefined();
    });

    it('should handle todos without existing execution status', async () => {
      const todo = createMockTodo();
      mockTodos.set(todo.id, todo);

      const result = await executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'running' },
        mockUpdateTodoFn
      );

      expect(result.success).toBe(true);
      expect(result.updatedTodo.executionStatus?.state).toBe('running');
      expect(result.updatedTodo.executionStatus?.attempts).toBe(1);
    });
  });

  describe('Thread Safety', () => {
    it('should prevent concurrent updates to the same todo', async () => {
      const todo = createMockTodo({
        executionStatus: { state: 'pending' }
      });
      mockTodos.set(todo.id, todo);

      // Start two concurrent updates
      const promise1 = executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'running' },
        mockUpdateTodoFn
      );

      const promise2 = executionStateManager.updateExecutionStatus(
        todo,
        { todoId: todo.id, newState: 'ready' },
        mockUpdateTodoFn
      );

      const results = await Promise.all([promise1, promise2]);

      // Both should return the same result (the first one should be processed)
      expect(results[0]).toEqual(results[1]);
    });
  });

  describe('checkAndCompleteMainTask', () => {
    it('should complete main task when all subtasks are completed', async () => {
      const groupId = 'test-group';
      
      // Create main task
      const mainTask = createMockTodo({
        groupId,
        executionOrder: 0,
        verificationMethod: 'manual check'
      });
      
      // Create completed subtasks
      const subtask1 = createMockTodo({
        groupId,
        executionOrder: 1,
        completed: true,
        executionStatus: { state: 'completed' }
      });
      
      const subtask2 = createMockTodo({
        groupId,
        executionOrder: 2,
        completed: true,
        executionStatus: { state: 'completed' }
      });

      mockTodos.set(mainTask.id, mainTask);
      mockTodos.set(subtask1.id, subtask1);
      mockTodos.set(subtask2.id, subtask2);

      const result = await executionStateManager.checkAndCompleteMainTask(
        groupId,
        mockGetAllTodosFn,
        mockUpdateTodoFn
      );

      expect(result.mainTaskCompleted).toBe(true);
      expect(result.mainTask?.completed).toBe(true);
      expect(result.mainTask?.executionStatus?.state).toBe('completed');
      expect(result.mainTask?.verificationStatus).toBe('verified');
    });

    it('should not complete main task when some subtasks are incomplete', async () => {
      const groupId = 'test-group';
      
      const mainTask = createMockTodo({
        groupId,
        executionOrder: 0
      });
      
      const subtask1 = createMockTodo({
        groupId,
        executionOrder: 1,
        completed: true
      });
      
      const subtask2 = createMockTodo({
        groupId,
        executionOrder: 2,
        completed: false // Not completed
      });

      mockTodos.set(mainTask.id, mainTask);
      mockTodos.set(subtask1.id, subtask1);
      mockTodos.set(subtask2.id, subtask2);

      const result = await executionStateManager.checkAndCompleteMainTask(
        groupId,
        mockGetAllTodosFn,
        mockUpdateTodoFn
      );

      expect(result.mainTaskCompleted).toBe(false);
      expect(result.mainTask?.completed).toBe(false);
    });

    it('should not complete already completed main task', async () => {
      const groupId = 'test-group';
      
      const mainTask = createMockTodo({
        groupId,
        executionOrder: 0,
        completed: true,
        executionStatus: { state: 'completed' }
      });

      mockTodos.set(mainTask.id, mainTask);

      const result = await executionStateManager.checkAndCompleteMainTask(
        groupId,
        mockGetAllTodosFn,
        mockUpdateTodoFn
      );

      expect(result.mainTaskCompleted).toBe(true);
      expect(result.mainTask).toEqual(mainTask);
    });

    it('should return false when group has no main task', async () => {
      const groupId = 'test-group';
      
      const subtask = createMockTodo({
        groupId,
        executionOrder: 1
      });

      mockTodos.set(subtask.id, subtask);

      const result = await executionStateManager.checkAndCompleteMainTask(
        groupId,
        mockGetAllTodosFn,
        mockUpdateTodoFn
      );

      expect(result.mainTaskCompleted).toBe(false);
    });
  });

  describe('getGroupExecutionStats', () => {
    it('should calculate correct execution statistics', () => {
      const groupId = 'test-group';
      
      const todos = [
        createMockTodo({ groupId, executionStatus: { state: 'pending' } }),
        createMockTodo({ groupId, executionStatus: { state: 'running' } }),
        createMockTodo({ groupId, completed: true }),
        createMockTodo({ groupId, executionStatus: { state: 'failed' } }),
        createMockTodo({ groupId, executionStatus: { state: 'ready' } }),
      ];

      todos.forEach(todo => mockTodos.set(todo.id, todo));

      const stats = executionStateManager.getGroupExecutionStats(
        groupId,
        mockGetAllTodosFn
      );

      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(1);
      expect(stats.running).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.ready).toBe(1);
    });

    it('should return empty stats for non-existent group', () => {
      const stats = executionStateManager.getGroupExecutionStats(
        'non-existent-group',
        mockGetAllTodosFn
      );

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.ready).toBe(0);
    });
  });

  describe('resetFailedTask', () => {
    it('should reset a failed task to pending state', async () => {
      const todo = createMockTodo({
        executionStatus: { 
          state: 'failed', 
          lastError: 'Some error',
          attempts: 3 
        }
      });
      mockTodos.set(todo.id, todo);

      const result = await executionStateManager.resetFailedTask(
        todo.id,
        false,
        mockGetAllTodosFn,
        mockUpdateTodoFn
      );

      expect(result.resetTasks).toHaveLength(1);
      expect(result.resetTasks[0].executionStatus?.state).toBe('pending');
      expect(result.resetTasks[0].executionStatus?.attempts).toBe(0);
      expect(result.resetTasks[0].executionStatus?.lastError).toBeUndefined();
    });

    it('should reset dependent tasks when resetDependents is true', async () => {
      const failedTask = createMockTodo({
        executionStatus: { state: 'failed' }
      });
      
      const dependentTask = createMockTodo({
        dependencies: [failedTask.id],
        completed: true
      });

      mockTodos.set(failedTask.id, failedTask);
      mockTodos.set(dependentTask.id, dependentTask);

      const result = await executionStateManager.resetFailedTask(
        failedTask.id,
        true,
        mockGetAllTodosFn,
        mockUpdateTodoFn
      );

      expect(result.resetTasks).toHaveLength(2);
      expect(result.resetTasks.find(t => t.id === dependentTask.id)?.completed).toBe(false);
    });

    it('should throw error when trying to reset non-failed task', async () => {
      const todo = createMockTodo({
        executionStatus: { state: 'completed' }
      });
      mockTodos.set(todo.id, todo);

      await expect(
        executionStateManager.resetFailedTask(
          todo.id,
          false,
          mockGetAllTodosFn,
          mockUpdateTodoFn
        )
      ).rejects.toThrow('is not in failed state');
    });

    it('should throw error when todo does not exist', async () => {
      await expect(
        executionStateManager.resetFailedTask(
          'non-existent-id',
          false,
          mockGetAllTodosFn,
          mockUpdateTodoFn
        )
      ).rejects.toThrow('not found');
    });
  });
});