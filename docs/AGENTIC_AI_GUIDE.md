# Agentic AI Guide for Aiya Todo MCP

This guide provides some documentation for using aiya-todo-mcp's basic agentic AI capabilities to build simple task execution workflows.

## Table of Contents

1. [Conceptual Overview](#conceptual-overview)
2. [Advanced Usage Patterns](#advanced-usage-patterns)
3. [Performance Considerations](#performance-considerations)
4. [Integration Patterns](#integration-patterns)
5. [Debugging and Monitoring](#debugging-and-monitoring)
6. [Best Practices](#best-practices)

## Conceptual Overview

### What is Agentic AI Task Management?

Agentic AI task management enables autonomous agents (LLMs) to:

- **Plan** simple multi-step workflows with dependencies
- **Execute** tasks in the correct order based on completion status
- **Track** progress and handle failures with retry logic
- **Coordinate** multiple related tasks automatically

### Core Concepts

#### Task Groups
A **task group** consists of:
- **Main Task** (`executionOrder: 0`) - The primary objective
- **Subtasks** (`executionOrder: 1, 2, 3...`) - Steps to complete the main task
- **Dependencies** - Which tasks must complete before others can start

#### Execution States
Tasks progress through these states:
```
pending → ready → running → completed
            ↓
          failed → pending (retry)
```

#### Dependency Resolution
The system automatically determines which tasks are ready to execute based on:
- Completion status of dependency tasks
- Current execution state
- Circular dependency detection

## Advanced Usage Patterns

### 1. Sequential Workflow
Execute tasks one after another in a specific order.

```javascript
const { groupId } = await createTaskGroup({
  mainTask: {
    title: "Complete Data Pipeline",
    description: "Process customer data end-to-end"
  },
  subtasks: [
    { title: "Extract data from API", dependencies: [] },
    { title: "Transform data format", dependencies: [0] },
    { title: "Validate data quality", dependencies: [1] },
    { title: "Load into database", dependencies: [2] },
    { title: "Generate reports", dependencies: [3] }
  ]
});

// Execute tasks in order
while (true) {
  const ready = await getExecutableTasks({ groupId, limit: 1 });
  if (ready.length === 0) break;
  
  const task = ready[0];
  await updateExecutionStatus({ todoId: task.id, state: "running" });
  
  try {
    // Execute your task logic here
    await executeTask(task);
    await updateExecutionStatus({ todoId: task.id, state: "completed" });
  } catch (error) {
    await updateExecutionStatus({ 
      todoId: task.id, 
      state: "failed", 
      error: error.message 
    });
  }
}
```

### 2. Parallel Execution with Convergence
Execute independent tasks in parallel, then converge for final steps.

```javascript
const { groupId } = await createTaskGroup({
  mainTask: {
    title: "Deploy Multi-Service Application",
    description: "Deploy frontend, backend, and database services"
  },
  subtasks: [
    // Parallel preparation tasks
    { title: "Build frontend", dependencies: [] },
    { title: "Build backend", dependencies: [] },
    { title: "Prepare database", dependencies: [] },
    
    // Convergence point - depends on all builds
    { title: "Deploy to staging", dependencies: [0, 1, 2] },
    { title: "Run integration tests", dependencies: [3] },
    { title: "Deploy to production", dependencies: [4] }
  ]
});

// Execute with concurrency
const maxConcurrent = 3;
const executing = new Set();

while (true) {
  // Get ready tasks up to concurrency limit
  const available = maxConcurrent - executing.size;
  if (available <= 0) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    continue;
  }
  
  const ready = await getExecutableTasks({ groupId, limit: available });
  if (ready.length === 0 && executing.size === 0) break;
  
  // Start ready tasks
  for (const task of ready) {
    executing.add(task.id);
    executeTaskAsync(task).finally(() => executing.delete(task.id));
  }
}
```

### 3. Conditional Execution
Use verification status to control task execution flow.

```javascript
const { groupId } = await createTaskGroup({
  mainTask: {
    title: "Conditional Deployment Pipeline",
    description: "Deploy only if tests pass"
  },
  subtasks: [
    { title: "Run unit tests", dependencies: [] },
    { title: "Run integration tests", dependencies: [0] },
    { title: "Deploy to production", dependencies: [1] }
  ]
});

// Execute with conditional logic
const ready = await getExecutableTasks({ groupId });
for (const task of ready) {
  await updateExecutionStatus({ todoId: task.id, state: "running" });
  
  if (task.title.includes("Deploy to production")) {
    // Check if previous tests passed
    const testTasks = await listTodos({ 
      groupId, 
      completed: true 
    });
    
    const testsPassedVerification = testTasks.every(t => 
      t.verificationStatus === 'verified'
    );
    
    if (!testsPassedVerification) {
      await updateExecutionStatus({
        todoId: task.id,
        state: "failed",
        error: "Prerequisites failed verification"
      });
      continue;
    }
  }
  
  // Execute task...
}
```

### 4. Dynamic Task Creation
Add new tasks to existing groups based on runtime conditions.

```javascript
// Start with basic workflow
const { groupId } = await createTaskGroup({
  mainTask: { title: "Process Customer Orders" },
  subtasks: [
    { title: "Validate orders", dependencies: [] },
    { title: "Calculate pricing", dependencies: [0] }
  ]
});

// During execution, add conditional tasks
const orderValidation = await getExecutableTasks({ groupId });
// ... execute validation ...

if (hasInternationalOrders) {
  // Add new task for currency conversion
  const currencyTask = await createTodo({
    title: "Convert international currencies",
    groupId,
    dependencies: [pricingTaskId],
    executionOrder: 3,
    executionStatus: { state: "pending" }
  });
}
```

## Performance Considerations

### Large Task Groups (1000+ Tasks)

For very large task groups, consider these optimizations:

#### Don't. Your LLMs will probably screw up partway through. But if you insist,

#### Batch Processing
```javascript
// Process tasks in batches to avoid memory issues
const batchSize = 50;
let processed = 0;

while (processed < totalTasks) {
  const ready = await getExecutableTasks({ 
    groupId, 
    limit: batchSize 
  });
  
  if (ready.length === 0) break;
  
  await Promise.all(ready.map(executeTask));
  processed += ready.length;
}
```

#### Hierarchical Task Groups
```javascript
// Break large workflows into smaller groups
const phases = [
  { name: "Data Collection", tasks: 200 },
  { name: "Data Processing", tasks: 500 },
  { name: "Data Analysis", tasks: 300 }
];

for (const phase of phases) {
  const { groupId: phaseGroupId } = await createTaskGroup({
    mainTask: { title: phase.name },
    subtasks: phase.tasks
  });
  
  await executePhase(phaseGroupId);
}
```

### Dependency Graph Complexity

Monitor and optimize complex dependency relationships:

```javascript
// Check for circular dependencies before execution
import { DependencyResolver } from 'aiya-todo-mcp';

const resolver = new DependencyResolver();
const allTasks = await listTodos({ groupId });
const cycles = resolver.detectCircularDependencies(allTasks);

if (cycles.length > 0) {
  console.warn(`Found ${cycles.length} circular dependencies:`, cycles);
  // Handle or fix circular dependencies
}
```

### Memory Management

```javascript
// For long-running processes, periodically clean up completed tasks
const completedTasks = await listTodos({ 
  groupId, 
  completed: true 
});

// Archive completed tasks if group is getting large
if (completedTasks.length > 1000) {
  await archiveCompletedTasks(completedTasks);
}
```

## Integration Patterns

### 1. MCP Client Integration

```javascript
// Example MCP client using aiya-todo-mcp
class AgenticMCPClient {
  constructor(todoManager) {
    this.todoManager = todoManager;
    this.toolRegistry = new Map();
  }
  
  async planAndExecute(objective, availableTools) {
    // Create task group for objective
    const { groupId } = await this.createExecutionPlan(objective);
    
    // Execute with available MCP tools
    await this.executeWithTools(groupId, availableTools);
  }
  
  async executeWithTools(groupId, tools) {
    while (true) {
      const ready = await getExecutableTasks({ groupId });
      if (ready.length === 0) break;
      
      for (const task of ready) {
        const requiredTools = task.executionConfig?.toolsRequired || [];
        
        // Verify required tools are available
        const hasAllTools = requiredTools.every(tool => 
          tools.has(tool)
        );
        
        if (!hasAllTools) {
          await updateExecutionStatus({
            todoId: task.id,
            state: "failed",
            error: `Missing required tools: ${requiredTools.join(', ')}`
          });
          continue;
        }
        
        await this.executeTaskWithTools(task, tools);
      }
    }
  }
}
```

### 2. Event-Driven Architecture

```javascript
// Integrate with event systems for reactive task execution
class EventDrivenTaskManager {
  constructor(todoManager, eventEmitter) {
    this.todoManager = todoManager;
    this.events = eventEmitter;
    
    // React to external events
    this.events.on('dataReady', this.handleDataReady.bind(this));
    this.events.on('taskFailed', this.handleTaskFailure.bind(this));
  }
  
  async handleDataReady(dataId) {
    // Find tasks waiting for this data
    const waitingTasks = await listTodos({
      executionStatus: { state: 'pending' },
      executionConfig: { params: { waitingFor: dataId } }
    });
    
    // Mark them as ready
    for (const task of waitingTasks) {
      await updateExecutionStatus({
        todoId: task.id,
        state: 'ready'
      });
    }
  }
  
  async handleTaskFailure(taskId, error) {
    // Implement smart retry logic
    const task = await getTodo(taskId);
    const attempts = task.executionStatus?.attempts || 0;
    
    if (attempts < 3) {
      // Retry with exponential backoff
      const delay = Math.pow(2, attempts) * 1000;
      setTimeout(async () => {
        await updateExecutionStatus({
          todoId: taskId,
          state: 'pending'
        });
      }, delay);
    } else {
      // Escalate to manual intervention
      await this.escalateFailure(taskId, error);
    }
  }
}
```

## Debugging and Monitoring

### 1. Execution Monitoring

```javascript
// Monitor task group execution progress
async function monitorExecution(groupId) {
  const status = await getTaskGroupStatus({ groupId });
  
  console.log(`Group ${groupId} Status:`);
  console.log(`- Total: ${status.stats.total}`);
  console.log(`- Completed: ${status.stats.completed}`);
  console.log(`- Running: ${status.stats.running}`);
  console.log(`- Failed: ${status.stats.failed}`);
  console.log(`- Pending: ${status.stats.pending}`);
  
  // Show problematic tasks
  const failedTasks = status.tasks.filter(t => 
    t.executionStatus?.state === 'failed'
  );
  
  if (failedTasks.length > 0) {
    console.log('\nFailed Tasks:');
    failedTasks.forEach(task => {
      console.log(`- ${task.title}: ${task.executionStatus.lastError}`);
    });
  }
}
```

### 2. Dependency Visualization

```javascript
// Generate dependency graph for debugging
async function visualizeDependencies(groupId) {
  const tasks = await listTodos({ groupId });
  
  console.log('Dependency Graph:');
  tasks.forEach(task => {
    const deps = task.dependencies || [];
    const depTitles = deps.map(id => {
      const depTask = tasks.find(t => t.id === id);
      return depTask ? depTask.title : `Unknown(${id})`;
    });
    
    console.log(`${task.title} depends on: [${depTitles.join(', ')}]`);
  });
}
```

### 3. Performance Metrics

```javascript
// Track execution performance
class ExecutionMetrics {
  constructor() {
    this.startTimes = new Map();
    this.durations = new Map();
  }
  
  startTask(taskId) {
    this.startTimes.set(taskId, Date.now());
  }
  
  endTask(taskId) {
    const start = this.startTimes.get(taskId);
    if (start) {
      const duration = Date.now() - start;
      this.durations.set(taskId, duration);
      this.startTimes.delete(taskId);
    }
  }
  
  getAverageExecutionTime() {
    const durations = Array.from(this.durations.values());
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }
  
  getSlowestTasks(count = 5) {
    return Array.from(this.durations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count);
  }
}
```

## Best Practices

### 1. Task Group Design

- **Keep groups focused**: Each group should represent a cohesive workflow
- **Limit tasks**: Aim for 10-20 tasks at most
- **Use clear titles**: Task titles should clearly describe the action
- **Define atomic tasks**: Each task should be a single, well-defined operation

### 2. Dependency Management

- **Minimize dependencies**: Only add dependencies that are truly required
- **Avoid deep chains**: Long dependency chains can reduce parallelism
- **Test for cycles**: Always validate dependency graphs before execution
- **Document relationships**: Use task descriptions to explain dependencies

### 3. Error Handling

- **Set retry limits**: Configure appropriate retry counts for different task types
- **Provide detailed errors**: Include context in error messages for debugging
- **Implement graceful degradation**: Design workflows to handle partial failures
- **Use verification**: Leverage the verification system for quality gates

### 4. State Management

- **Use proper transitions**: Always follow the valid state transition rules
- **Handle concurrency**: Be aware that multiple agents might update the same task
- **Monitor progress**: Regularly check task group status during execution
- **Clean up resources**: Archive or delete completed task groups when no longer needed

### 5. Integration Guidelines

- **Tool compatibility**: Ensure required MCP tools are available before execution
- **Resource management**: Monitor system resources during large task execution
- **Logging**: Implement comprehensive logging for debugging and auditing
- **Testing**: Test task groups thoroughly before production deployment