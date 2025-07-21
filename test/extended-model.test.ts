import { TodoManager } from '../src/lib/TodoManager.js';
import { TodoPersistence } from '../src/lib/TodoPersistence.js';
import { Todo } from '../src/types.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Extended Todo Model', () => {
  let todoManager: TodoManager;
  let tempFilePath: string;

  beforeEach(async () => {
    // Create a temporary file for each test
    tempFilePath = join(tmpdir(), `test-todos-${Date.now()}-${Math.random()}.json`);
    const persistence = new TodoPersistence(tempFilePath);
    todoManager = new TodoManager(persistence);
    await todoManager.initialize();
  });

  afterEach(async () => {
    // Clean up temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // File might not exist, ignore
    }
  });

  describe('Todo Creation with Execution Config', () => {
    it('should create todo with execution config', async () => {
      const request = {
        title: 'Deploy application',
        description: 'Deploy the web application to production',
        tags: ['deployment'],
        groupId: 'project-1',
        executionConfig: {
          toolsRequired: ['docker', 'kubectl'],
          params: { environment: 'production', replicas: 3 },
          retryOnFailure: true
        },
        executionStatus: {
          state: 'pending' as const,
          attempts: 0
        }
      };

      const todo = await todoManager.createTodo(request);

      expect(todo.title).toBe('Deploy application');
      expect(todo.executionConfig).toEqual({
        toolsRequired: ['docker', 'kubectl'],
        params: { environment: 'production', replicas: 3 },
        retryOnFailure: true
      });
      expect(todo.executionStatus?.state).toBe('pending');
      expect(todo.executionStatus?.attempts).toBe(0);
    });

    it('should create todo with dependencies', async () => {
      // Create dependency todos first
      const dep1 = await todoManager.createTodo({ title: 'Setup database' });
      const dep2 = await todoManager.createTodo({ title: 'Configure networking' });

      const request = {
        title: 'Deploy application',
        dependencies: [dep1.id, dep2.id],
        executionOrder: 1,
      };

      const todo = await todoManager.createTodo(request);

      expect(todo.dependencies).toEqual([dep1.id, dep2.id]);
      expect(todo.executionOrder).toBe(1);
    });

    it('should create todo with all new fields', async () => {
      // Create dependency todos first
      const dep1 = await todoManager.createTodo({ title: 'Dependency 1' });
      const dep2 = await todoManager.createTodo({ title: 'Dependency 2' });

      const request = {
        title: 'Complex task',
        dependencies: [dep1.id, dep2.id],
        executionOrder: 5,
        executionConfig: {
          toolsRequired: ['git', 'npm'],
          params: { branch: 'main' },
          retryOnFailure: false
        },
        executionStatus: {
          state: 'ready' as const,
          lastError: null,
          attempts: 1
        }
      };

      const todo = await todoManager.createTodo(request);

      expect(todo.dependencies).toEqual([dep1.id, dep2.id]);
      expect(todo.executionOrder).toBe(5);
      expect(todo.executionConfig?.toolsRequired).toEqual(['git', 'npm']);
      expect(todo.executionConfig?.params).toEqual({ branch: 'main' });
      expect(todo.executionConfig?.retryOnFailure).toBe(false);
      expect(todo.executionStatus?.state).toBe('ready');
      expect(todo.executionStatus?.attempts).toBe(1);
    });

    it('should handle todos without new fields (backward compatibility)', async () => {
      const request = { title: 'Simple task' };
      const todo = await todoManager.createTodo(request);

      expect(todo.title).toBe('Simple task');
      expect(todo.dependencies).toBeUndefined();
      expect(todo.executionOrder).toBeUndefined();
      expect(todo.executionConfig).toBeUndefined();
      expect(todo.executionStatus).toBeUndefined();
    });
  });

  describe('Todo Updates with New Fields', () => {
    let todoId: string;

    beforeEach(async () => {
      const todo = await todoManager.createTodo({ title: 'Test task' });
      todoId = todo.id;
    });

    it('should update todo with execution config', async () => {
      const updateRequest = {
        id: todoId,
        executionConfig: {
          toolsRequired: ['jest', 'cypress'],
          params: { testSuite: 'integration' },
          retryOnFailure: true
        }
      };

      const updatedTodo = await todoManager.updateTodo(updateRequest);

      expect(updatedTodo.executionConfig?.toolsRequired).toEqual(['jest', 'cypress']);
      expect(updatedTodo.executionConfig?.params).toEqual({ testSuite: 'integration' });
      expect(updatedTodo.executionConfig?.retryOnFailure).toBe(true);
    });

    it('should update todo with execution status', async () => {
      const updateRequest = {
        id: todoId,
        executionStatus: {
          state: 'running' as const,
          attempts: 2,
          lastError: 'Network timeout'
        }
      };

      const updatedTodo = await todoManager.updateTodo(updateRequest);

      expect(updatedTodo.executionStatus?.state).toBe('running');
      expect(updatedTodo.executionStatus?.attempts).toBe(2);
      expect(updatedTodo.executionStatus?.lastError).toBe('Network timeout');
    });

    it('should update dependencies and execution order', async () => {
      // Create dependency todos first
      const dep1 = await todoManager.createTodo({ title: 'Dependency 1' });
      const dep2 = await todoManager.createTodo({ title: 'Dependency 2' });
      const dep3 = await todoManager.createTodo({ title: 'Dependency 3' });

      const updateRequest = {
        id: todoId,
        dependencies: [dep1.id, dep2.id, dep3.id],
        executionOrder: 10
      };

      const updatedTodo = await todoManager.updateTodo(updateRequest);

      expect(updatedTodo.dependencies).toEqual([dep1.id, dep2.id, dep3.id]);
      expect(updatedTodo.executionOrder).toBe(10);
    });
  });

  describe('Persistence and Loading', () => {
    it('should persist and load new fields correctly', async () => {
      // Create dependency todo first
      const dep1 = await todoManager.createTodo({ title: 'Dependency 1' });

      const originalTodo = await todoManager.createTodo({
        title: 'Persistent task',
        dependencies: [dep1.id],
        executionOrder: 3,
        executionConfig: {
          toolsRequired: ['webpack'],
          params: { mode: 'production' },
          retryOnFailure: true
        },
        executionStatus: {
          state: 'completed' as const,
          attempts: 1
        }
      });

      // Create new manager instance to test loading
      const persistence = new TodoPersistence(tempFilePath);
      const newManager = new TodoManager(persistence);
      await newManager.initialize();

      const loadedTodo = newManager.getTodo(originalTodo.id);

      expect(loadedTodo?.dependencies).toEqual([dep1.id]);
      expect(loadedTodo?.executionOrder).toBe(3);
      expect(loadedTodo?.executionConfig?.toolsRequired).toEqual(['webpack']);
      expect(loadedTodo?.executionConfig?.params).toEqual({ mode: 'production' });
      expect(loadedTodo?.executionConfig?.retryOnFailure).toBe(true);
      expect(loadedTodo?.executionStatus?.state).toBe('completed');
      expect(loadedTodo?.executionStatus?.attempts).toBe(1);
    });

    it('should handle legacy data without new fields', async () => {
      // Create legacy data structure
      const legacyData = {
        todos: [
          {
            id: '1',
            title: 'Legacy task',
            description: 'Old style task',
            completed: false,
            createdAt: new Date().toISOString(),
            tags: ['legacy'],
            groupId: 'old-group'
          }
        ],
        nextId: 2
      };

      await fs.writeFile(tempFilePath, JSON.stringify(legacyData));
      
      // Load with new manager
      const persistence = new TodoPersistence(tempFilePath);
      const manager = new TodoManager(persistence);
      await manager.initialize();

      const todos = manager.getAllTodos();
      expect(todos).toHaveLength(1);
      
      const todo = todos[0];
      expect(todo.title).toBe('Legacy task');
      expect(todo.dependencies).toBeUndefined();
      expect(todo.executionOrder).toBeUndefined();
      expect(todo.executionConfig).toBeUndefined();
      expect(todo.executionStatus).toBeUndefined();
      
      // Existing fields should still work
      expect(todo.description).toBe('Old style task');
      expect(todo.tags).toEqual(['legacy']);
      expect(todo.groupId).toBe('old-group');
    });

    it('should preserve new fields when updating legacy todos', async () => {
      // Create legacy data
      const legacyData = {
        todos: [
          {
            id: '1',
            title: 'Legacy task',
            completed: false,
            createdAt: new Date().toISOString()
          }
        ],
        nextId: 2
      };

      await fs.writeFile(tempFilePath, JSON.stringify(legacyData));
      
      const persistence = new TodoPersistence(tempFilePath);
      const manager = new TodoManager(persistence);
      await manager.initialize();

      // Add new fields to legacy todo
      const updatedTodo = await manager.updateTodo({
        id: '1',
        executionConfig: {
          toolsRequired: ['npm'],
          retryOnFailure: true
        },
        executionStatus: {
          state: 'pending' as const,
          attempts: 0
        }
      });

      expect(updatedTodo.executionConfig?.toolsRequired).toEqual(['npm']);
      expect(updatedTodo.executionStatus?.state).toBe('pending');

      // Verify persistence
      const manager2 = new TodoManager(persistence);
      await manager2.initialize();
      
      const persistedTodo = manager2.getTodo('1');
      expect(persistedTodo?.executionConfig?.toolsRequired).toEqual(['npm']);
      expect(persistedTodo?.executionStatus?.state).toBe('pending');
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle empty dependencies array', async () => {
      const todo = await todoManager.createTodo({
        title: 'Task with empty deps',
        dependencies: []
      });

      expect(todo.dependencies).toEqual([]);
    });

    it('should handle zero execution order', async () => {
      const todo = await todoManager.createTodo({
        title: 'Main task',
        executionOrder: 0
      });

      expect(todo.executionOrder).toBe(0);
    });

    it('should handle partial execution config', async () => {
      const todo = await todoManager.createTodo({
        title: 'Partial config task',
        executionConfig: {
          toolsRequired: ['git']
          // No params or retryOnFailure
        }
      });

      expect(todo.executionConfig?.toolsRequired).toEqual(['git']);
      expect(todo.executionConfig?.params).toBeUndefined();
      expect(todo.executionConfig?.retryOnFailure).toBeUndefined();
    });

    it('should handle partial execution status', async () => {
      const todo = await todoManager.createTodo({
        title: 'Partial status task',
        executionStatus: {
          state: 'failed' as const
          // No lastError or attempts
        }
      });

      expect(todo.executionStatus?.state).toBe('failed');
      expect(todo.executionStatus?.lastError).toBeUndefined();
      expect(todo.executionStatus?.attempts).toBeUndefined();
    });
  });

  describe('Mixed Field Operations', () => {
    it('should handle todos with both old and new fields', async () => {
      // Create dependency todo first
      const dep1 = await todoManager.createTodo({ title: 'Dependency 1' });

      const todo = await todoManager.createTodo({
        title: 'Mixed field task',
        description: 'Task with both old and new fields',
        tags: ['mixed', 'test'],
        groupId: 'mixed-group',
        verificationMethod: 'Check output',
        dependencies: [dep1.id],
        executionOrder: 2,
        executionConfig: {
          toolsRequired: ['node'],
          retryOnFailure: true
        }
      });

      // Old fields
      expect(todo.description).toBe('Task with both old and new fields');
      expect(todo.tags).toEqual(['mixed', 'test']);
      expect(todo.groupId).toBe('mixed-group');
      expect(todo.verificationMethod).toBe('Check output');

      // New fields
      expect(todo.dependencies).toEqual([dep1.id]);
      expect(todo.executionOrder).toBe(2);
      expect(todo.executionConfig?.toolsRequired).toEqual(['node']);
      expect(todo.executionConfig?.retryOnFailure).toBe(true);
    });

    it('should update mixed fields correctly', async () => {
      const todo = await todoManager.createTodo({
        title: 'Original task',
        tags: ['original'],
        executionOrder: 1
      });

      const updated = await todoManager.updateTodo({
        id: todo.id,
        tags: ['updated'],
        executionOrder: 5,
        executionStatus: {
          state: 'running' as const,
          attempts: 3
        }
      });

      expect(updated.tags).toEqual(['updated']);
      expect(updated.executionOrder).toBe(5);
      expect(updated.executionStatus?.state).toBe('running');
      expect(updated.executionStatus?.attempts).toBe(3);
    });
  });
});