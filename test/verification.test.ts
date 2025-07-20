import { TodoManager } from '../src/lib/TodoManager.js';
import { TodoPersistence } from '../src/lib/TodoPersistence.js';
import { Todo } from '../src/types.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Verification System', () => {
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

  describe('Todo Creation with Verification', () => {
    it('should create todo with verification method', async () => {
      const request = {
        title: 'Deploy website',
        description: 'Deploy the new website to production',
        tags: ['deployment', 'urgent'],
        groupId: 'project-1',
        verificationMethod: 'Check if website is accessible at production URL'
      };

      const todo = await todoManager.createTodo(request);

      expect(todo.title).toBe('Deploy website');
      expect(todo.description).toBe('Deploy the new website to production');
      expect(todo.tags).toEqual(['deployment', 'urgent']);
      expect(todo.groupId).toBe('project-1');
      expect(todo.verificationMethod).toBe('Check if website is accessible at production URL');
      expect(todo.completed).toBe(false);
      expect(todo.verificationStatus).toBeUndefined();
      expect(todo.verificationNotes).toBeUndefined();
    });

    it('should create todo without optional fields', async () => {
      const request = { title: 'Simple task' };
      const todo = await todoManager.createTodo(request);

      expect(todo.title).toBe('Simple task');
      expect(todo.description).toBeUndefined();
      expect(todo.tags).toBeUndefined();
      expect(todo.groupId).toBeUndefined();
      expect(todo.verificationMethod).toBeUndefined();
      expect(todo.verificationStatus).toBeUndefined();
      expect(todo.verificationNotes).toBeUndefined();
    });
  });

  describe('setVerificationMethod', () => {
    let todoId: string;

    beforeEach(async () => {
      const todo = await todoManager.createTodo({ title: 'Test task' });
      todoId = todo.id;
    });

    it('should set verification method and status to pending', async () => {
      const request = {
        todoId,
        method: 'Run integration tests and check all pass',
        notes: 'Focus on API endpoints'
      };

      const updatedTodo = await todoManager.setVerificationMethod(request);

      expect(updatedTodo.verificationMethod).toBe('Run integration tests and check all pass');
      expect(updatedTodo.verificationStatus).toBe('pending');
      expect(updatedTodo.verificationNotes).toBe('Focus on API endpoints');
    });

    it('should set verification method without notes', async () => {
      const request = {
        todoId,
        method: 'Manual testing of user interface'
      };

      const updatedTodo = await todoManager.setVerificationMethod(request);

      expect(updatedTodo.verificationMethod).toBe('Manual testing of user interface');
      expect(updatedTodo.verificationStatus).toBe('pending');
      expect(updatedTodo.verificationNotes).toBeUndefined();
    });

    it('should throw error for non-existent todo', async () => {
      const request = {
        todoId: 'nonexistent',
        method: 'Test method'
      };

      await expect(todoManager.setVerificationMethod(request))
        .rejects.toThrow('Todo with ID nonexistent not found');
    });
  });

  describe('updateVerificationStatus', () => {
    let todoId: string;

    beforeEach(async () => {
      const todo = await todoManager.createTodo({ title: 'Test task' });
      todoId = todo.id;
      await todoManager.setVerificationMethod({
        todoId,
        method: 'Test verification'
      });
    });

    it('should update verification status to verified', async () => {
      const request = {
        todoId,
        status: 'verified' as const,
        notes: 'All tests passed successfully'
      };

      const updatedTodo = await todoManager.updateVerificationStatus(request);

      expect(updatedTodo.verificationStatus).toBe('verified');
      expect(updatedTodo.verificationNotes).toBe('All tests passed successfully');
    });

    it('should update verification status to failed', async () => {
      const request = {
        todoId,
        status: 'failed' as const,
        notes: 'Integration tests failed'
      };

      const updatedTodo = await todoManager.updateVerificationStatus(request);

      expect(updatedTodo.verificationStatus).toBe('failed');
      expect(updatedTodo.verificationNotes).toBe('Integration tests failed');
    });

    it('should update verification status without notes', async () => {
      const request = {
        todoId,
        status: 'verified' as const
      };

      const updatedTodo = await todoManager.updateVerificationStatus(request);

      expect(updatedTodo.verificationStatus).toBe('verified');
      expect(updatedTodo.verificationNotes).toBeUndefined();
    });

    it('should throw error for non-existent todo', async () => {
      const request = {
        todoId: 'nonexistent',
        status: 'verified' as const
      };

      await expect(todoManager.updateVerificationStatus(request))
        .rejects.toThrow('Todo with ID nonexistent not found');
    });
  });

  describe('getTodosNeedingVerification', () => {
    beforeEach(async () => {
      // Create various todos for testing
      const todo1 = await todoManager.createTodo({ 
        title: 'Task 1', 
        groupId: 'group-1' 
      });
      await todoManager.setVerificationMethod({
        todoId: todo1.id,
        method: 'Verify task 1'
      });

      const todo2 = await todoManager.createTodo({ 
        title: 'Task 2', 
        groupId: 'group-1' 
      });
      await todoManager.setVerificationMethod({
        todoId: todo2.id,
        method: 'Verify task 2'
      });
      await todoManager.updateVerificationStatus({
        todoId: todo2.id,
        status: 'verified'
      });

      const todo3 = await todoManager.createTodo({ 
        title: 'Task 3', 
        groupId: 'group-2' 
      });
      await todoManager.setVerificationMethod({
        todoId: todo3.id,
        method: 'Verify task 3'
      });

      // Task 4 has no verification method
      await todoManager.createTodo({ 
        title: 'Task 4', 
        groupId: 'group-1' 
      });
    });

    it('should return todos with pending verification', async () => {
      const todos = todoManager.getTodosNeedingVerification({});

      expect(todos).toHaveLength(2);
      expect(todos.map(t => t.title)).toContain('Task 1');
      expect(todos.map(t => t.title)).toContain('Task 3');
      expect(todos.map(t => t.title)).not.toContain('Task 2'); // verified
      expect(todos.map(t => t.title)).not.toContain('Task 4'); // no verification method
    });

    it('should filter by group ID', async () => {
      const todos = todoManager.getTodosNeedingVerification({ groupId: 'group-1' });

      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Task 1');
    });

    it('should return empty array when no todos need verification', async () => {
      // Mark all remaining todos as verified
      const allTodos = todoManager.getAllTodos();
      for (const todo of allTodos) {
        if (todo.verificationMethod && todo.verificationStatus !== 'verified') {
          await todoManager.updateVerificationStatus({
            todoId: todo.id,
            status: 'verified'
          });
        }
      }

      const todos = todoManager.getTodosNeedingVerification({});
      expect(todos).toHaveLength(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle legacy todos without verification fields', async () => {
      // Create a legacy todo data structure
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
      
      // Initialize TodoManager with legacy data
      const persistence = new TodoPersistence(tempFilePath);
      const manager = new TodoManager(persistence);
      await manager.initialize();

      const todos = manager.getAllTodos();
      expect(todos).toHaveLength(1);
      
      const todo = todos[0];
      expect(todo.title).toBe('Legacy task');
      expect(todo.description).toBeUndefined();
      expect(todo.tags).toBeUndefined();
      expect(todo.groupId).toBeUndefined();
      expect(todo.verificationMethod).toBeUndefined();
      expect(todo.verificationStatus).toBeUndefined();
      expect(todo.verificationNotes).toBeUndefined();
    });

    it('should preserve verification fields when updating legacy todos', async () => {
      // Create legacy todo
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

      // Add verification to legacy todo
      await manager.setVerificationMethod({
        todoId: '1',
        method: 'Test the legacy task'
      });

      // Verify it was saved correctly
      const manager2 = new TodoManager(persistence);
      await manager2.initialize();
      
      const todo = manager2.getTodo('1');
      expect(todo?.verificationMethod).toBe('Test the legacy task');
      expect(todo?.verificationStatus).toBe('pending');
    });
  });
});