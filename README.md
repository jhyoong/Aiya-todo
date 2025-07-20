# Aiya Todo MCP

A Model Context Protocol (MCP) server for managing TODO tasks. This package provides both a standalone MCP server and a library for integrating todo functionality into your own projects.

## Installation

```bash
npm install aiya-todo-mcp
```

## Usage

### As an MCP Server

Run the server directly:
```bash
npx aiya-todo-mcp
```

Or add it to your MCP client configuration. The server provides these tools:
- `createTodo` - Create a new todo item
- `listTodos` - List all todos with optional filtering
- `getTodo` - Get a specific todo by ID
- `updateTodo` - Update a todo's title or completion status
- `deleteTodo` - Delete a todo by ID

### As a Library

Import and use the todo management functionality in your own projects:

```typescript
import { createTodoManager, Todo } from 'aiya-todo-mcp';

// Create a todo manager with custom file path
const todoManager = createTodoManager('./my-todos.json');

// Initialize (loads existing todos from file)
await todoManager.initialize();

// Create a new todo
const todo = await todoManager.createTodo({ title: 'Learn MCP' });
console.log(`Created todo: ${todo.title} (ID: ${todo.id})`);

// List all todos
const todos = todoManager.getAllTodos();
console.log(`Total todos: ${todos.length}`);

// Update a todo
const updated = await todoManager.updateTodo({
  id: todo.id,
  completed: true
});

// Delete a todo
await todoManager.deleteTodo({ id: todo.id });
```

### Advanced Usage

For more control, use the individual classes:

```typescript
import { TodoManager, TodoPersistence } from 'aiya-todo-mcp';

// Custom persistence layer
const persistence = new TodoPersistence('./custom-path.json');
const manager = new TodoManager(persistence);

await manager.initialize();

// Use validation schemas
import { CreateTodoSchema } from 'aiya-todo-mcp';

const result = CreateTodoSchema.parse({ title: 'Valid todo' });
const todo = await manager.createTodo(result);
```

## API Reference

### Types

```typescript
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

interface CreateTodoRequest {
  title: string;
}

interface UpdateTodoRequest {
  id: string;
  title?: string;
  completed?: boolean;
}
```

### Classes

#### `TodoManager`
- `initialize()` - Load todos from persistence
- `createTodo(request)` - Create a new todo
- `getTodo(id)` - Get todo by ID
- `getAllTodos()` - Get all todos
- `listTodos(request)` - List todos with filtering
- `updateTodo(request)` - Update a todo
- `deleteTodo(request)` - Delete a todo

#### `TodoPersistence`
- `saveTodos(todos, nextId)` - Save todos to file
- `loadTodos()` - Load todos from file

### Validation Schemas

Zod schemas for request validation:
- `CreateTodoSchema`
- `UpdateTodoSchema`
- `DeleteTodoSchema`
- `GetTodoSchema`
- `ListTodosSchema`

## Changelog

### v0.1.1
- **Fixed**: Race condition in concurrent todo operations that could cause data loss and ID collisions
- **Improved**: Added write queue mechanism to serialize file save operations

## License

MIT
