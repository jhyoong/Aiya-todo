# Aiya Todo MCP

A Model Context Protocol (MCP) server for managing TODO tasks with agentic AI capabilities. This package enables LLMs to plan, execute, and track complex multi-step tasks with dependencies, state management, and automated workflows.

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

**Basic Todo Management:**
- `createTodo` - Create a new todo item
- `listTodos` - List all todos with optional filtering
- `getTodo` - Get a specific todo by ID
- `updateTodo` - Update a todo's properties
- `deleteTodo` - Delete a todo by ID

**Verification System:**
- `setVerificationMethod` - Set verification method for a todo
- `updateVerificationStatus` - Update verification status (pending/verified/failed)
- `getTodosNeedingVerification` - Get todos that need verification

**Agentic AI Tools:**
- `createTaskGroup` - Create coordinated task groups with dependencies for complex workflows
- `getExecutableTasks` - Find tasks ready for execution based on dependency satisfaction
- `updateExecutionStatus` - Manage execution states with validation and auto-completion
- `getTaskGroupStatus` - Get execution status summary for task groups
- `resetTaskExecution` - Reset failed tasks with optional dependent task reset

## Agentic AI Capabilities

### Task Groups with Dependencies
```typescript
// Create a multi-step project with dependencies
await createTaskGroup({
  mainTask: {
    title: "Deploy Web Application",
    description: "Complete deployment pipeline"
  },
  subtasks: [
    { title: "Run tests", dependencies: [] },
    { title: "Build application", dependencies: [0] }, // depends on tests
    { title: "Deploy to staging", dependencies: [1] },
    { title: "Run smoke tests", dependencies: [2] },
    { title: "Deploy to production", dependencies: [3] }
  ]
});
```

### Execution Tracking
```typescript
// Get tasks ready to execute
const readyTasks = await getExecutableTasks({ groupId: "deploy-123" });

// Update execution status with state transitions
await updateExecutionStatus({
  todoId: "task-456",
  state: "running"
});

// Handle failures with retry logic
await updateExecutionStatus({
  todoId: "task-456", 
  state: "failed",
  error: "Connection timeout"
});

// Retry failed task (automatically increments attempt count)
await updateExecutionStatus({
  todoId: "task-456",
  state: "pending" // Will retry with attempt count++
});
```

### Automatic Workflow Completion
- Main tasks automatically complete when all subtasks finish
- Dependency chains resolve automatically
- Failed tasks can be retried with attempt tracking
- Thread-safe concurrent execution support

## As a Library

Import and use the todo management functionality in your own projects:

```typescript
import { createTodoManager, Todo } from 'aiya-todo-mcp';

// Create a todo manager with custom file path
const todoManager = createTodoManager('./my-todos.json');

// Initialize (loads existing todos from file)
await todoManager.initialize();

// Create a new todo with execution tracking
const todo = await todoManager.createTodo({ 
  title: 'Process data pipeline',
  executionConfig: {
    toolsRequired: ['dataProcessor', 'validator'],
    retryOnFailure: true
  }
});

// Create task with dependencies
const dependentTask = await todoManager.createTodo({
  title: 'Generate report',
  dependencies: [todo.id], // Depends on data pipeline
  executionStatus: { state: 'pending' }
});

// Get ready tasks (respects dependencies)
const readyTasks = todoManager.getReadyTasks();
console.log(`${readyTasks.length} tasks ready for execution`);
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
import { 
  CreateTodoSchema, 
  SetVerificationMethodSchema,
  UpdateVerificationStatusSchema 
} from 'aiya-todo-mcp';

const result = CreateTodoSchema.parse({ 
  title: 'Valid todo',
  verificationMethod: 'manual-check'
});
const todo = await manager.createTodo(result);

// Set verification method for existing todo
const verificationResult = SetVerificationMethodSchema.parse({
  todoId: todo.id,
  method: 'automated-test',
  notes: 'Run unit tests'
});
await manager.setVerificationMethod(verificationResult);

// Update verification status
const statusUpdate = UpdateVerificationStatusSchema.parse({
  todoId: todo.id,
  status: 'verified',
  notes: 'Tests passed successfully'
});
await manager.updateVerificationStatus(statusUpdate);
```

## API Reference

### Types

```typescript
interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  tags?: string[];
  groupId?: string;
  
  // Verification system
  verificationMethod?: string;
  verificationStatus?: 'pending' | 'verified' | 'failed';
  verificationNotes?: string;
  
  // Agentic AI capabilities
  dependencies?: string[];              // Task dependencies by ID
  executionOrder?: number;              // Order within group (0 = main task)
  executionConfig?: {                   // Configuration for execution
    toolsRequired?: string[];           // MCP tools needed
    params?: Record<string, any>;       // Parameters for execution
    retryOnFailure?: boolean;           // Whether to retry (default: true)
  };
  executionStatus?: {                   // Current execution state
    state: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
    lastError?: string;                 // Error message if failed
    attempts?: number;                  // Number of execution attempts
  };
}

interface CreateTodoRequest {
  title: string;
  description?: string;
  tags?: string[];
  groupId?: string;
  verificationMethod?: string;
}

interface UpdateTodoRequest {
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
```

### Classes

#### `TodoManager`
**Basic Operations:**
- `initialize()` - Load todos from persistence
- `createTodo(request)` - Create a new todo
- `getTodo(id)` - Get todo by ID
- `getAllTodos()` - Get all todos
- `listTodos(request)` - List todos with filtering
- `updateTodo(request)` - Update a todo
- `deleteTodo(request)` - Delete a todo

**Verification System:**
- `setVerificationMethod(request)` - Set verification method for a todo
- `updateVerificationStatus(request)` - Update verification status
- `getTodosNeedingVerification(request)` - Get todos that need verification

**Agentic AI Methods:**
- `getReadyTasks(groupId?)` - Get tasks ready for execution based on dependencies

#### `ExecutionStateManager`
- `updateExecutionStatus(todo, request, updateFn)` - Update execution state with validation
- `checkAndCompleteMainTask(groupId, getAllTodos, updateTodo)` - Auto-complete main tasks
- `getGroupExecutionStats(groupId, getAllTodos)` - Get execution statistics
- `resetFailedTask(todoId, resetDependents, getAllTodos, updateTodo)` - Reset failed tasks

#### `DependencyResolver`
- `isTaskReady(todo, allTodos)` - Check if task dependencies are satisfied
- `getReadyTasks(todos)` - Filter tasks ready for execution
- `detectCircularDependencies(todos)` - Detect circular dependency chains
- `validateDependencies(todoId, dependencies, allTodos)` - Validate dependency IDs

#### `TodoPersistence`
- `saveTodos(todos, nextId)` - Save todos to file
- `loadTodos()` - Load todos from file

### Validation Schemas

Zod schemas for request validation:

**Basic Operations:**
- `CreateTodoSchema` - Validate todo creation requests
- `UpdateTodoSchema` - Validate todo update requests  
- `DeleteTodoSchema` - Validate todo deletion requests
- `GetTodoSchema` - Validate get todo requests
- `ListTodosSchema` - Validate list todos requests

**Verification System:**
- `SetVerificationMethodSchema` - Validate verification method requests
- `UpdateVerificationStatusSchema` - Validate verification status updates
- `GetTodosNeedingVerificationSchema` - Validate verification queries

**Agentic AI Tools:**
- `CreateTaskGroupSchema` - Validate task group creation
- `GetExecutableTasksSchema` - Validate executable task queries
- `UpdateExecutionStatusSchema` - Validate execution status updates

## Key Features

Purpose-built for LLM task planning and execution with dependency management and state tracking. Tasks can be organized into groups with dependencies, automatically execute in the correct order, and retry on failure. Main tasks complete automatically when all subtasks finish.

## Troubleshooting

### Common Issues

**Tasks stuck in "pending" state:**
- Check if dependencies are satisfied using `getExecutableTasks`
- Verify dependency IDs exist and are valid
- Look for circular dependencies in task chains

**Execution status updates failing:**
- Ensure valid state transitions: pending → ready → running → completed/failed
- Use "pending" state to retry failed tasks
- Check for concurrent status updates on the same task

**Main task not auto-completing:**
- Verify all subtasks have `executionStatus.state: "completed"`
- Check that subtasks share the same `groupId` as main task
- Ensure main task has `executionOrder: 0`

**Memory usage with large task groups:**
- Use `limit` parameter in `getExecutableTasks` for batch processing
- Consider breaking very large groups (1000+ tasks) into smaller groups
- Monitor dependency graph complexity to avoid performance issues

## Changelog

### v0.4.0 - Enhanced Agentic Tools
- **New**: `getTaskGroupStatus` tool - Get execution status summary for task groups
- **New**: `resetTaskExecution` tool - Reset failed tasks with optional dependent reset
- **Enhanced**: ExecutionStateManager with group statistics and reset capabilities
- **Added**: More execution monitoring and recovery tools
- **Improved**: Better error handling and state transition validation

### v0.3.0 - Full Agentic AI Capabilities
- **New**: Agentic AI system with dependency management and execution tracking
- **New**: `createTaskGroup` tool - Create coordinated task workflows with dependencies
- **New**: `getExecutableTasks` tool - Find tasks ready for execution based on dependencies  
- **New**: `updateExecutionStatus` tool - Manage execution states with validation
- **New**: `ExecutionStateManager` class - State transitions and auto-completion
- **New**: `DependencyResolver` class - Dependency validation and circular detection
- **Enhanced**: Todo model with execution config, status, and dependency fields
- **Added**: Automatic main task completion when all subtasks finish
- **Added**: Retry logic with attempt counting and error tracking
- **Added**: Thread-safe(?) concurrent execution state updates

### v0.2.1
- **Added**: Verification system for todos with verification metadata
- **Added**: New MCP tools: `setVerificationMethod`, `updateVerificationStatus`, `getTodosNeedingVerification`
- **Enhanced**: Todo model with verification fields (method, status, notes)
- **Added**: Extended validation schemas for verification operations
- **Added**: Comprehensive test coverage for verification functionality

### v0.1.1
- **Fixed**: Race condition in concurrent todo operations that could cause data loss and ID collisions
- **Improved**: Added write queue mechanism to serialize file save operations

## License

MIT
