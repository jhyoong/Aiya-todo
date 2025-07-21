import { DependencyResolver } from '../src/utils/DependencyResolver.js';
import { Todo } from '../src/types.js';

describe('Dependency Resolution', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  describe('isTaskReady', () => {
    it('should identify tasks with no dependencies as ready', () => {
      const todo: Todo = {
        id: '1',
        title: 'No dependencies task',
        completed: false,
        createdAt: new Date()
      };
      const allTodos = [todo];

      const result = resolver.isTaskReady(todo, allTodos);

      expect(result).toBe(true);
    });

    it('should identify tasks with empty dependencies as ready', () => {
      const todo: Todo = {
        id: '1',
        title: 'Empty dependencies task',
        completed: false,
        createdAt: new Date(),
        dependencies: []
      };
      const allTodos = [todo];

      const result = resolver.isTaskReady(todo, allTodos);

      expect(result).toBe(true);
    });

    it('should identify tasks with completed dependencies as ready', () => {
      const dep1: Todo = {
        id: '1',
        title: 'Dependency 1',
        completed: true,
        createdAt: new Date()
      };
      const dep2: Todo = {
        id: '2',
        title: 'Dependency 2',
        completed: false,
        createdAt: new Date(),
        executionStatus: { state: 'completed', attempts: 1 }
      };
      const todo: Todo = {
        id: '3',
        title: 'Main task',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1', '2']
      };
      const allTodos = [dep1, dep2, todo];

      const result = resolver.isTaskReady(todo, allTodos);

      expect(result).toBe(true);
    });

    it('should not mark tasks with incomplete dependencies as ready', () => {
      const dep1: Todo = {
        id: '1',
        title: 'Completed dependency',
        completed: true,
        createdAt: new Date()
      };
      const dep2: Todo = {
        id: '2',
        title: 'Incomplete dependency',
        completed: false,
        createdAt: new Date(),
        executionStatus: { state: 'pending', attempts: 0 }
      };
      const todo: Todo = {
        id: '3',
        title: 'Main task',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1', '2']
      };
      const allTodos = [dep1, dep2, todo];

      const result = resolver.isTaskReady(todo, allTodos);

      expect(result).toBe(false);
    });

    it('should handle missing dependency IDs gracefully', () => {
      const todo: Todo = {
        id: '1',
        title: 'Task with missing dependency',
        completed: false,
        createdAt: new Date(),
        dependencies: ['missing-id']
      };
      const allTodos = [todo];

      const result = resolver.isTaskReady(todo, allTodos);

      expect(result).toBe(false);
    });

    it('should handle tasks with mixed dependency states', () => {
      const dep1: Todo = {
        id: '1',
        title: 'Completed dependency',
        completed: true,
        createdAt: new Date()
      };
      const dep2: Todo = {
        id: '2',
        title: 'Running dependency',
        completed: false,
        createdAt: new Date(),
        executionStatus: { state: 'running', attempts: 1 }
      };
      const dep3: Todo = {
        id: '3',
        title: 'Failed dependency',
        completed: false,
        createdAt: new Date(),
        executionStatus: { state: 'failed', attempts: 3, lastError: 'Network error' }
      };
      const todo: Todo = {
        id: '4',
        title: 'Main task',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1', '2', '3']
      };
      const allTodos = [dep1, dep2, dep3, todo];

      const result = resolver.isTaskReady(todo, allTodos);

      expect(result).toBe(false);
    });
  });

  describe('getReadyTasks', () => {
    it('should return tasks that are ready to execute', () => {
      const readyTask: Todo = {
        id: '1',
        title: 'Ready task',
        completed: false,
        createdAt: new Date()
      };
      const blockedTask: Todo = {
        id: '2',
        title: 'Blocked task',
        completed: false,
        createdAt: new Date(),
        dependencies: ['3']
      };
      const missingDep: Todo = {
        id: '3',
        title: 'Missing dependency',
        completed: false,
        createdAt: new Date()
      };
      const allTodos = [readyTask, blockedTask, missingDep];

      const result = resolver.getReadyTasks(allTodos);

      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toContain('1');
      expect(result.map(t => t.id)).toContain('3');
      expect(result.map(t => t.id)).not.toContain('2');
    });

    it('should exclude completed tasks', () => {
      const completedTask: Todo = {
        id: '1',
        title: 'Completed task',
        completed: true,
        createdAt: new Date()
      };
      const readyTask: Todo = {
        id: '2',
        title: 'Ready task',
        completed: false,
        createdAt: new Date()
      };
      const allTodos = [completedTask, readyTask];

      const result = resolver.getReadyTasks(allTodos);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should exclude running tasks', () => {
      const runningTask: Todo = {
        id: '1',
        title: 'Running task',
        completed: false,
        createdAt: new Date(),
        executionStatus: { state: 'running', attempts: 1 }
      };
      const readyTask: Todo = {
        id: '2',
        title: 'Ready task',
        completed: false,
        createdAt: new Date()
      };
      const allTodos = [runningTask, readyTask];

      const result = resolver.getReadyTasks(allTodos);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should handle complex dependency chains', () => {
      const task1: Todo = {
        id: '1',
        title: 'Root task',
        completed: false,
        createdAt: new Date()
      };
      const task2: Todo = {
        id: '2',
        title: 'Depends on 1',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1']
      };
      const task3: Todo = {
        id: '3',
        title: 'Depends on 1 and 2',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1', '2']
      };
      const allTodos = [task1, task2, task3];

      const result = resolver.getReadyTasks(allTodos);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array when no tasks are ready', () => {
      const task1: Todo = {
        id: '1',
        title: 'Blocked task',
        completed: false,
        createdAt: new Date(),
        dependencies: ['2']
      };
      const task2: Todo = {
        id: '2',
        title: 'Also blocked task',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1']
      };
      const allTodos = [task1, task2];

      const result = resolver.getReadyTasks(allTodos);

      expect(result).toHaveLength(0);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect simple circular dependency', () => {
      const task1: Todo = {
        id: '1',
        title: 'Task 1',
        completed: false,
        createdAt: new Date(),
        dependencies: ['2']
      };
      const task2: Todo = {
        id: '2',
        title: 'Task 2',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1']
      };
      const allTodos = [task1, task2];

      const result = resolver.detectCircularDependencies(allTodos);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('1');
      expect(result[0]).toContain('2');
    });

    it('should detect complex circular dependency', () => {
      const task1: Todo = {
        id: '1',
        title: 'Task 1',
        completed: false,
        createdAt: new Date(),
        dependencies: ['2']
      };
      const task2: Todo = {
        id: '2',
        title: 'Task 2',
        completed: false,
        createdAt: new Date(),
        dependencies: ['3']
      };
      const task3: Todo = {
        id: '3',
        title: 'Task 3',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1']
      };
      const allTodos = [task1, task2, task3];

      const result = resolver.detectCircularDependencies(allTodos);

      expect(result).toHaveLength(1);
      expect(result[0].length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array when no circular dependencies exist', () => {
      const task1: Todo = {
        id: '1',
        title: 'Root task',
        completed: false,
        createdAt: new Date()
      };
      const task2: Todo = {
        id: '2',
        title: 'Depends on 1',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1']
      };
      const task3: Todo = {
        id: '3',
        title: 'Depends on 2',
        completed: false,
        createdAt: new Date(),
        dependencies: ['2']
      };
      const allTodos = [task1, task2, task3];

      const result = resolver.detectCircularDependencies(allTodos);

      expect(result).toHaveLength(0);
    });

    it('should handle self-referencing dependencies', () => {
      const task1: Todo = {
        id: '1',
        title: 'Self-referencing task',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1']
      };
      const allTodos = [task1];

      const result = resolver.detectCircularDependencies(allTodos);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('1');
    });

    it('should detect multiple separate cycles', () => {
      const task1: Todo = {
        id: '1',
        title: 'Task 1',
        completed: false,
        createdAt: new Date(),
        dependencies: ['2']
      };
      const task2: Todo = {
        id: '2',
        title: 'Task 2',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1']
      };
      const task3: Todo = {
        id: '3',
        title: 'Task 3',
        completed: false,
        createdAt: new Date(),
        dependencies: ['4']
      };
      const task4: Todo = {
        id: '4',
        title: 'Task 4',
        completed: false,
        createdAt: new Date(),
        dependencies: ['3']
      };
      const allTodos = [task1, task2, task3, task4];

      const result = resolver.detectCircularDependencies(allTodos);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateDependencies', () => {
    it('should pass validation for valid dependencies', () => {
      const dep1: Todo = {
        id: '1',
        title: 'Dependency 1',
        completed: false,
        createdAt: new Date()
      };
      const dep2: Todo = {
        id: '2',
        title: 'Dependency 2',
        completed: false,
        createdAt: new Date()
      };
      const allTodos = [dep1, dep2];

      expect(() => {
        resolver.validateDependencies('3', ['1', '2'], allTodos);
      }).not.toThrow();
    });

    it('should throw error for missing dependency', () => {
      const dep1: Todo = {
        id: '1',
        title: 'Existing dependency',
        completed: false,
        createdAt: new Date()
      };
      const allTodos = [dep1];

      expect(() => {
        resolver.validateDependencies('2', ['1', 'missing'], allTodos);
      }).toThrow('Dependency with ID missing not found');
    });

    it('should throw error for circular dependency', () => {
      const task1: Todo = {
        id: '1',
        title: 'Task 1',
        completed: false,
        createdAt: new Date(),
        dependencies: ['2']
      };
      const task2: Todo = {
        id: '2',
        title: 'Task 2',
        completed: false,
        createdAt: new Date()
      };
      const allTodos = [task1, task2];

      expect(() => {
        resolver.validateDependencies('2', ['1'], allTodos);
      }).toThrow('Circular dependency detected');
    });

    it('should handle empty dependencies without error', () => {
      const allTodos: Todo[] = [];

      expect(() => {
        resolver.validateDependencies('1', [], allTodos);
      }).not.toThrow();

      expect(() => {
        resolver.validateDependencies('1', undefined as any, allTodos);
      }).not.toThrow();
    });

    it('should detect complex circular dependency chains', () => {
      const task1: Todo = {
        id: '1',
        title: 'Task 1',
        completed: false,
        createdAt: new Date(),
        dependencies: ['2']
      };
      const task2: Todo = {
        id: '2',
        title: 'Task 2',
        completed: false,
        createdAt: new Date(),
        dependencies: ['3']
      };
      const task3: Todo = {
        id: '3',
        title: 'Task 3',
        completed: false,
        createdAt: new Date()
      };
      const allTodos = [task1, task2, task3];

      expect(() => {
        resolver.validateDependencies('3', ['1'], allTodos);
      }).toThrow('Circular dependency detected');
    });
  });

  describe('Performance', () => {
    it('should handle large dependency graphs efficiently', () => {
      const todos: Todo[] = [];
      
      // Create 100 sequential tasks
      for (let i = 1; i <= 100; i++) {
        const dependencies = i > 1 ? [(i - 1).toString()] : undefined;
        todos.push({
          id: i.toString(),
          title: `Task ${i}`,
          completed: false,
          createdAt: new Date(),
          dependencies
        });
      }

      const start = Date.now();
      const readyTasks = resolver.getReadyTasks(todos);
      const end = Date.now();

      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe('1');
      expect(end - start).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should detect circular dependencies efficiently in large graphs', () => {
      const todos: Todo[] = [];
      
      // Create 50 tasks in a chain, then create a cycle by making task 1 depend on task 50
      for (let i = 1; i <= 50; i++) {
        const dependencies = i === 1 ? ['50'] : i > 1 ? [(i - 1).toString()] : undefined;
        todos.push({
          id: i.toString(),
          title: `Task ${i}`,
          completed: false,
          createdAt: new Date(),
          dependencies
        });
      }

      const start = Date.now();
      const cycles = resolver.detectCircularDependencies(todos);
      const end = Date.now();

      expect(cycles.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(100); // Should complete in less than 100ms
    });
  });

  describe('Edge Cases', () => {
    it('should handle todos with null or undefined dependencies', () => {
      const todo1: Todo = {
        id: '1',
        title: 'Task with null deps',
        completed: false,
        createdAt: new Date(),
        dependencies: null as any
      };
      const todo2: Todo = {
        id: '2',
        title: 'Task with undefined deps',
        completed: false,
        createdAt: new Date(),
        dependencies: undefined
      };
      const allTodos = [todo1, todo2];

      expect(resolver.isTaskReady(todo1, allTodos)).toBe(true);
      expect(resolver.isTaskReady(todo2, allTodos)).toBe(true);
      
      const readyTasks = resolver.getReadyTasks(allTodos);
      expect(readyTasks).toHaveLength(2);
    });

    it('should handle empty todos array', () => {
      const readyTasks = resolver.getReadyTasks([]);
      const cycles = resolver.detectCircularDependencies([]);

      expect(readyTasks).toHaveLength(0);
      expect(cycles).toHaveLength(0);
    });

    it('should handle duplicate dependency IDs', () => {
      const dep: Todo = {
        id: '1',
        title: 'Dependency',
        completed: true,
        createdAt: new Date()
      };
      const todo: Todo = {
        id: '2',
        title: 'Task with duplicate deps',
        completed: false,
        createdAt: new Date(),
        dependencies: ['1', '1', '1']
      };
      const allTodos = [dep, todo];

      expect(resolver.isTaskReady(todo, allTodos)).toBe(true);
    });
  });
});