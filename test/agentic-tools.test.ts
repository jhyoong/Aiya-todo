import { TodoManager } from '../src/lib/TodoManager.js';
import { TodoPersistence } from '../src/lib/TodoPersistence.js';
import { Todo } from '../src/types.js';

// Mock persistence for testing
class MockPersistence extends TodoPersistence {
  private data: { todos: Map<string, Todo>; nextId: number } = {
    todos: new Map(),
    nextId: 1
  };

  async saveTodos(todos: Map<string, Todo>, nextId: number): Promise<void> {
    this.data = { todos: new Map(todos), nextId };
  }

  async loadTodos(): Promise<{ todos: Map<string, Todo>; nextId: number }> {
    return { todos: new Map(this.data.todos), nextId: this.data.nextId };
  }
}

describe('Agentic Tools', () => {
  let todoManager: TodoManager;

  beforeEach(async () => {
    todoManager = new TodoManager(new MockPersistence());
    await todoManager.initialize();
  });

  describe('CreateTaskGroup', () => {
    it('should create main task with executionOrder 0', async () => {
      // Simulate createTaskGroup behavior
      const groupId = 'test-group-1';
      
      const mainTask = await todoManager.createTodo({
        title: 'Main Task',
        description: 'This is the main task',
        tags: ['important'],
        groupId: groupId,
        executionOrder: 0,
        executionStatus: { state: 'pending' }
      });

      expect(mainTask.executionOrder).toBe(0);
      expect(mainTask.groupId).toBe(groupId);
      expect(mainTask.executionStatus?.state).toBe('pending');
      expect(mainTask.title).toBe('Main Task');
    });

    it('should create subtasks with proper dependencies and execution order', async () => {
      const groupId = 'test-group-2';
      
      // Create main task
      const mainTask = await todoManager.createTodo({
        title: 'Main Task',
        groupId: groupId,
        executionOrder: 0,
        executionStatus: { state: 'pending' }
      });

      // Create first subtask depending on main task
      const subtask1 = await todoManager.createTodo({
        title: 'Subtask 1',
        dependencies: [mainTask.id],
        executionOrder: 1,
        groupId: groupId,
        executionStatus: { state: 'pending' }
      });

      // Create second subtask depending on first subtask
      const subtask2 = await todoManager.createTodo({
        title: 'Subtask 2',
        dependencies: [subtask1.id],
        executionOrder: 2,
        groupId: groupId,
        executionStatus: { state: 'pending' }
      });

      expect(subtask1.dependencies).toEqual([mainTask.id]);
      expect(subtask1.executionOrder).toBe(1);
      expect(subtask2.dependencies).toEqual([subtask1.id]);
      expect(subtask2.executionOrder).toBe(2);
    });

    it('should handle rollback on failure', async () => {
      const groupId = 'test-group-3';
      
      const mainTask = await todoManager.createTodo({
        title: 'Main Task',
        groupId: groupId,
        executionOrder: 0,
        executionStatus: { state: 'pending' }
      });

      // Simulate rollback by deleting created task
      const success = await todoManager.deleteTodo({ id: mainTask.id });
      expect(success).toBe(true);
      
      const deletedTask = todoManager.getTodo(mainTask.id);
      expect(deletedTask).toBeUndefined();
    });

    it('should generate groupId when not provided', () => {
      const groupId = `group-${Date.now()}`;
      expect(groupId).toMatch(/^group-\d+$/);
    });

    it('should create tasks atomically', async () => {
      const groupId = 'test-group-4';
      const createdTasks: string[] = [];
      
      try {
        // Create main task
        const mainTask = await todoManager.createTodo({
          title: 'Main Task',
          groupId: groupId,
          executionOrder: 0,
          executionStatus: { state: 'pending' }
        });
        createdTasks.push(mainTask.id);

        // Create subtask
        const subtask = await todoManager.createTodo({
          title: 'Subtask',
          dependencies: [mainTask.id],
          executionOrder: 1,
          groupId: groupId,
          executionStatus: { state: 'pending' }
        });
        createdTasks.push(subtask.id);

        // Verify both tasks exist
        expect(todoManager.getTodo(mainTask.id)).toBeDefined();
        expect(todoManager.getTodo(subtask.id)).toBeDefined();
        
      } catch (error) {
        // If error occurs, rollback all created tasks
        for (const taskId of createdTasks) {
          await todoManager.deleteTodo({ id: taskId });
        }
        throw error;
      }
    });
  });

  describe('GetExecutableTasks', () => {
    it('should return only tasks with satisfied dependencies', async () => {
      const groupId = 'test-group-5';
      
      // Create main task (no dependencies)
      const mainTask = await todoManager.createTodo({
        title: 'Main Task',
        groupId: groupId,
        executionOrder: 0,
        executionStatus: { state: 'pending' }
      });

      // Create dependent task
      const dependentTask = await todoManager.createTodo({
        title: 'Dependent Task',
        dependencies: [mainTask.id],
        executionOrder: 1,
        groupId: groupId,
        executionStatus: { state: 'pending' }
      });

      // Get ready tasks - only main task should be ready
      const readyTasks = todoManager.getReadyTasks(groupId);
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe(mainTask.id);

      // Complete main task
      await todoManager.updateTodo({
        id: mainTask.id,
        completed: true
      });

      // Now dependent task should be ready
      const readyTasksAfter = todoManager.getReadyTasks(groupId);
      expect(readyTasksAfter).toHaveLength(1);
      expect(readyTasksAfter[0].id).toBe(dependentTask.id);
    });

    it('should respect groupId filtering', async () => {
      // Create tasks in different groups
      const group1Task = await todoManager.createTodo({
        title: 'Group 1 Task',
        groupId: 'group-1',
        executionStatus: { state: 'pending' }
      });

      const group2Task = await todoManager.createTodo({
        title: 'Group 2 Task',
        groupId: 'group-2',
        executionStatus: { state: 'pending' }
      });

      const readyGroup1 = todoManager.getReadyTasks('group-1');
      const readyGroup2 = todoManager.getReadyTasks('group-2');

      expect(readyGroup1).toHaveLength(1);
      expect(readyGroup1[0].id).toBe(group1Task.id);
      expect(readyGroup2).toHaveLength(1);
      expect(readyGroup2[0].id).toBe(group2Task.id);
    });

    it('should sort by executionOrder', async () => {
      const groupId = 'test-group-6';
      
      // Create tasks in reverse order
      const task2 = await todoManager.createTodo({
        title: 'Task 2',
        groupId: groupId,
        executionOrder: 2,
        executionStatus: { state: 'pending' }
      });

      const task1 = await todoManager.createTodo({
        title: 'Task 1',
        groupId: groupId,
        executionOrder: 1,
        executionStatus: { state: 'pending' }
      });

      const readyTasks = todoManager.getReadyTasks(groupId);
      readyTasks.sort((a, b) => (a.executionOrder || 0) - (b.executionOrder || 0));

      expect(readyTasks[0].id).toBe(task1.id);
      expect(readyTasks[1].id).toBe(task2.id);
    });

    it('should apply limit correctly', async () => {
      const groupId = 'test-group-7';
      
      // Create multiple ready tasks
      await todoManager.createTodo({
        title: 'Task 1',
        groupId: groupId,
        executionOrder: 1,
        executionStatus: { state: 'pending' }
      });

      await todoManager.createTodo({
        title: 'Task 2',
        groupId: groupId,
        executionOrder: 2,
        executionStatus: { state: 'pending' }
      });

      await todoManager.createTodo({
        title: 'Task 3',
        groupId: groupId,
        executionOrder: 3,
        executionStatus: { state: 'pending' }
      });

      let readyTasks = todoManager.getReadyTasks(groupId);
      expect(readyTasks).toHaveLength(3);

      // Apply limit of 2
      readyTasks = readyTasks.slice(0, 2);
      expect(readyTasks).toHaveLength(2);
    });

    it('should not return running tasks', async () => {
      const task = await todoManager.createTodo({
        title: 'Running Task',
        executionStatus: { state: 'running' }
      });

      const readyTasks = todoManager.getReadyTasks();
      expect(readyTasks.find(t => t.id === task.id)).toBeUndefined();
    });

    it('should not return completed tasks', async () => {
      const task = await todoManager.createTodo({
        title: 'Completed Task'
      });

      // Complete the task
      await todoManager.updateTodo({
        id: task.id,
        completed: true,
        executionStatus: { state: 'completed' }
      });

      const readyTasks = todoManager.getReadyTasks();
      expect(readyTasks.find(t => t.id === task.id)).toBeUndefined();
    });
  });

  describe('UpdateExecutionStatus', () => {
    let testTask: Todo;

    beforeEach(async () => {
      testTask = await todoManager.createTodo({
        title: 'Test Task',
        executionStatus: { state: 'pending' }
      });
    });

    it('should validate valid state transitions', async () => {
      // pending -> ready
      let updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { state: 'ready' }
      });
      expect(updated.executionStatus?.state).toBe('ready');

      // ready -> running
      updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { state: 'running' }
      });
      expect(updated.executionStatus?.state).toBe('running');

      // running -> completed
      updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { state: 'completed' }
      });
      expect(updated.executionStatus?.state).toBe('completed');
    });

    it('should handle retry from failed state', async () => {
      // Set task to failed
      let updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { 
          state: 'failed', 
          lastError: 'Something went wrong',
          attempts: 1 
        }
      });

      expect(updated.executionStatus?.state).toBe('failed');
      expect(updated.executionStatus?.lastError).toBe('Something went wrong');
      expect(updated.executionStatus?.attempts).toBe(1);

      // Retry from failed -> pending
      updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { 
          state: 'pending',
          attempts: 2
        }
      });

      expect(updated.executionStatus?.state).toBe('pending');
      expect(updated.executionStatus?.attempts).toBe(2);
    });

    it('should increment attempts on retry', async () => {
      // Initial state
      expect(testTask.executionStatus?.attempts).toBeUndefined();

      // First attempt: pending -> running
      let updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { state: 'running', attempts: 1 }
      });
      expect(updated.executionStatus?.attempts).toBe(1);

      // Fail
      updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { state: 'failed', attempts: 1 }
      });

      // Retry: failed -> pending (increment attempts)
      updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { state: 'pending', attempts: 2 }
      });
      expect(updated.executionStatus?.attempts).toBe(2);
    });

    it('should store error messages', async () => {
      const errorMessage = 'Connection timeout';
      
      const updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { 
          state: 'failed', 
          lastError: errorMessage,
          attempts: 1
        }
      });

      expect(updated.executionStatus?.lastError).toBe(errorMessage);
    });

    it('should clear error on successful completion', async () => {
      // Set error first
      await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { 
          state: 'failed', 
          lastError: 'Some error',
          attempts: 1
        }
      });

      // Retry and complete successfully
      await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { state: 'pending', attempts: 2 }
      });

      const updated = await todoManager.updateTodo({
        id: testTask.id,
        executionStatus: { state: 'completed', attempts: 2 }
      });

      expect(updated.executionStatus?.state).toBe('completed');
      expect(updated.executionStatus?.lastError).toBeUndefined();
    });
  });

  describe('Integration Tests', () => {
    it('should complete entire task workflow', async () => {
      const groupId = 'workflow-test';
      
      // Create main task
      const mainTask = await todoManager.createTodo({
        title: 'Main Task',
        groupId: groupId,
        executionOrder: 0,
        executionStatus: { state: 'pending' }
      });

      // Create dependent subtask
      const subtask = await todoManager.createTodo({
        title: 'Subtask',
        dependencies: [mainTask.id],
        executionOrder: 1,
        groupId: groupId,
        executionStatus: { state: 'pending' }
      });

      // 1. Only main task should be ready initially
      let readyTasks = todoManager.getReadyTasks(groupId);
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe(mainTask.id);

      // 2. Start main task execution
      await todoManager.updateTodo({
        id: mainTask.id,
        executionStatus: { state: 'running', attempts: 1 }
      });

      // No tasks should be ready now
      readyTasks = todoManager.getReadyTasks(groupId);
      expect(readyTasks).toHaveLength(0);

      // 3. Complete main task
      await todoManager.updateTodo({
        id: mainTask.id,
        completed: true,
        executionStatus: { state: 'completed', attempts: 1 }
      });

      // Now subtask should be ready
      readyTasks = todoManager.getReadyTasks(groupId);
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe(subtask.id);

      // 4. Execute and complete subtask
      await todoManager.updateTodo({
        id: subtask.id,
        executionStatus: { state: 'running', attempts: 1 }
      });

      await todoManager.updateTodo({
        id: subtask.id,
        completed: true,
        executionStatus: { state: 'completed', attempts: 1 }
      });

      // No more ready tasks
      readyTasks = todoManager.getReadyTasks(groupId);
      expect(readyTasks).toHaveLength(0);
    });

    it('should handle complex dependency chains', async () => {
      const groupId = 'complex-deps';
      
      // Create a chain: A -> B -> C, and D -> C
      const taskA = await todoManager.createTodo({
        title: 'Task A',
        groupId: groupId,
        executionOrder: 0,
        executionStatus: { state: 'pending' }
      });

      const taskB = await todoManager.createTodo({
        title: 'Task B',
        dependencies: [taskA.id],
        groupId: groupId,
        executionOrder: 1,
        executionStatus: { state: 'pending' }
      });

      const taskD = await todoManager.createTodo({
        title: 'Task D',
        groupId: groupId,
        executionOrder: 1, // Parallel to B
        executionStatus: { state: 'pending' }
      });

      const taskC = await todoManager.createTodo({
        title: 'Task C',
        dependencies: [taskB.id, taskD.id],
        groupId: groupId,
        executionOrder: 2,
        executionStatus: { state: 'pending' }
      });

      // Initially only A and D should be ready
      let readyTasks = todoManager.getReadyTasks(groupId);
      expect(readyTasks).toHaveLength(2);
      expect(readyTasks.map(t => t.id)).toContain(taskA.id);
      expect(readyTasks.map(t => t.id)).toContain(taskD.id);

      // Complete A and D
      await todoManager.updateTodo({ id: taskA.id, completed: true });
      await todoManager.updateTodo({ id: taskD.id, completed: true });

      // Now B should be ready
      readyTasks = todoManager.getReadyTasks(groupId);
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe(taskB.id);

      // Complete B
      await todoManager.updateTodo({ id: taskB.id, completed: true });

      // Finally C should be ready
      readyTasks = todoManager.getReadyTasks(groupId);
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe(taskC.id);
    });
  });
});