import { Todo } from "../types.js";

export class DependencyResolver {
  isTaskReady(todo: Todo, allTodos: Todo[]): boolean {
    if (!todo.dependencies || todo.dependencies.length === 0) {
      return true;
    }
    
    return todo.dependencies.every(depId => {
      const dep = allTodos.find(t => t.id === depId);
      if (!dep) {
        return false;
      }
      return dep.completed || dep.executionStatus?.state === 'completed';
    });
  }

  getReadyTasks(todos: Todo[]): Todo[] {
    return todos.filter(todo => 
      !todo.completed && 
      todo.executionStatus?.state !== 'running' &&
      this.isTaskReady(todo, todos)
    );
  }

  detectCircularDependencies(todos: Todo[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (todoId: string, path: string[]): void => {
      if (recursionStack.has(todoId)) {
        // Found a back edge - this indicates a cycle
        const cycleStart = path.indexOf(todoId);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), todoId]);
        } else {
          // If todoId is not in path, add the full cycle
          cycles.push([...path, todoId]);
        }
        return;
      }

      if (visited.has(todoId)) {
        return;
      }

      visited.add(todoId);
      recursionStack.add(todoId);
      const currentPath = [...path, todoId];

      const todo = todos.find(t => t.id === todoId);
      if (todo?.dependencies) {
        for (const depId of todo.dependencies) {
          dfs(depId, currentPath);
        }
      }

      recursionStack.delete(todoId);
    };

    for (const todo of todos) {
      if (!visited.has(todo.id)) {
        dfs(todo.id, []);
      }
    }

    return cycles;
  }

  validateDependencies(todoId: string, dependencies: string[], allTodos: Todo[]): void {
    if (!dependencies || dependencies.length === 0) {
      return;
    }

    for (const depId of dependencies) {
      const dependencyExists = allTodos.some(t => t.id === depId);
      if (!dependencyExists) {
        throw new Error(`Dependency with ID ${depId} not found`);
      }
    }

    // Create a modified list where we either add the new todo or update an existing one
    const existingTodoIndex = allTodos.findIndex(t => t.id === todoId);
    let todosForCycleCheck: Todo[];
    
    if (existingTodoIndex >= 0) {
      // Update existing todo with new dependencies
      todosForCycleCheck = [...allTodos];
      todosForCycleCheck[existingTodoIndex] = {
        ...allTodos[existingTodoIndex],
        dependencies
      };
    } else {
      // Add new todo
      const tempTodo: Todo = {
        id: todoId,
        title: 'temp',
        completed: false,
        createdAt: new Date(),
        dependencies
      };
      todosForCycleCheck = [...allTodos, tempTodo];
    }
    
    const cycles = this.detectCircularDependencies(todosForCycleCheck);
    
    if (cycles.length > 0) {
      const cyclesWithTodoId = cycles.filter(cycle => cycle.includes(todoId));
      if (cyclesWithTodoId.length > 0) {
        throw new Error(`Circular dependency detected: ${cyclesWithTodoId[0].join(' -> ')}`);
      }
    }
  }
}