/**
 * Agentic AI Execution Examples for aiya-todo-mcp
 * 
 * This file demonstrates practical usage patterns for agentic AI task execution
 * using the aiya-todo-mcp package. Each example shows different scenarios
 * that LLMs and autonomous agents commonly encounter.
 */

const { createTodoManager } = require('aiya-todo-mcp');

// Example 1: Simple Sequential Task Execution
async function example1_sequentialExecution() {
  console.log('\n=== Example 1: Sequential Task Execution ===\n');
  
  const todoManager = createTodoManager('./examples-todos.json');
  await todoManager.initialize();
  
  // Create a sequential workflow
  const taskGroup = await todoManager.createTaskGroup({
    mainTask: {
      title: "Deploy Web Application",
      description: "Complete deployment pipeline from testing to production"
    },
    subtasks: [
      { title: "Run unit tests", dependencies: [] },
      { title: "Run integration tests", dependencies: [0] },
      { title: "Build application", dependencies: [1] },
      { title: "Deploy to staging", dependencies: [2] },
      { title: "Run smoke tests", dependencies: [3] },
      { title: "Deploy to production", dependencies: [4] }
    ]
  });
  
  console.log(`Created task group: ${taskGroup.groupId}`);
  console.log(`Main task: ${taskGroup.mainTask.title}`);
  console.log(`Subtasks: ${taskGroup.subtasks.length}`);
  
  // Execute tasks in dependency order
  let iteration = 1;
  while (true) {
    console.log(`\n--- Iteration ${iteration} ---`);
    
    const readyTasks = await todoManager.getExecutableTasks({ 
      groupId: taskGroup.groupId 
    });
    
    if (readyTasks.length === 0) {
      console.log('No more tasks ready for execution');
      break;
    }
    
    console.log(`Ready tasks: ${readyTasks.map(t => t.title).join(', ')}`);
    
    // Execute first ready task
    const task = readyTasks[0];
    console.log(`Executing: ${task.title}`);
    
    await todoManager.updateExecutionStatus({
      todoId: task.id,
      state: 'running'
    });
    
    // Simulate task execution
    await sleep(500);
    
    // Mark as completed
    await todoManager.updateExecutionStatus({
      todoId: task.id,
      state: 'completed'
    });
    
    console.log(`Completed: ${task.title}`);
    iteration++;
  }
  
  // Check final status
  const status = await todoManager.getTaskGroupStatus({ 
    groupId: taskGroup.groupId 
  });
  console.log(`\nFinal status: ${status.stats.completed}/${status.stats.total} completed`);
}

// Example 2: Parallel Execution with Dependencies
async function example2_parallelExecution() {
  console.log('\n=== Example 2: Parallel Execution with Dependencies ===\n');
  
  const todoManager = createTodoManager('./examples-todos.json');
  await todoManager.initialize();
  
  // Create workflow with parallel and convergence points
  const taskGroup = await todoManager.createTaskGroup({
    mainTask: {
      title: "Build and Deploy Multi-Service App",
      description: "Build frontend, backend, and database, then deploy together"
    },
    subtasks: [
      // Parallel build tasks
      { title: "Build frontend service", dependencies: [] },
      { title: "Build backend service", dependencies: [] },
      { title: "Setup database", dependencies: [] },
      
      // Convergence point
      { title: "Deploy all services", dependencies: [0, 1, 2] },
      { title: "Run end-to-end tests", dependencies: [3] },
      { title: "Enable load balancer", dependencies: [4] }
    ]
  });
  
  console.log(`Created parallel workflow: ${taskGroup.groupId}`);
  
  // Execute with concurrency
  const maxConcurrent = 3;
  const executingTasks = new Set();
  
  let iteration = 1;
  while (true) {
    console.log(`\n--- Iteration ${iteration} ---`);
    
    // Check how many slots are available
    const availableSlots = maxConcurrent - executingTasks.size;
    if (availableSlots <= 0) {
      console.log('All execution slots busy, waiting...');
      await sleep(1000);
      continue;
    }
    
    // Get ready tasks up to available slots
    const readyTasks = await todoManager.getExecutableTasks({ 
      groupId: taskGroup.groupId,
      limit: availableSlots
    });
    
    if (readyTasks.length === 0 && executingTasks.size === 0) {
      console.log('All tasks completed');
      break;
    }
    
    if (readyTasks.length === 0) {
      console.log('No ready tasks, waiting for executing tasks to complete...');
      await sleep(1000);
      continue;
    }
    
    console.log(`Starting ${readyTasks.length} tasks in parallel`);
    
    // Start tasks concurrently
    for (const task of readyTasks) {
      executingTasks.add(task.id);
      console.log(`Starting: ${task.title}`);
      
      // Execute task asynchronously
      executeTaskAsync(todoManager, task).finally(() => {
        executingTasks.delete(task.id);
        console.log(`Finished: ${task.title}`);
      });
    }
    
    iteration++;
  }
  
  console.log('\nParallel execution completed successfully!');
}

// Example 3: Error Handling and Retry Logic
async function example3_errorHandling() {
  console.log('\n=== Example 3: Error Handling and Retry Logic ===\n');
  
  const todoManager = createTodoManager('./examples-todos.json');
  await todoManager.initialize();
  
  // Create workflow that may encounter failures
  const taskGroup = await todoManager.createTaskGroup({
    mainTask: {
      title: "Unreliable Data Processing Pipeline",
      description: "Process data with potential network and validation failures"
    },
    subtasks: [
      { title: "Download data from API", dependencies: [] },
      { title: "Validate data format", dependencies: [0] },
      { title: "Transform data", dependencies: [1] },
      { title: "Upload to storage", dependencies: [2] }
    ]
  });
  
  console.log(`Created error-prone workflow: ${taskGroup.groupId}`);
  
  let iteration = 1;
  while (true) {
    console.log(`\n--- Iteration ${iteration} ---`);
    
    const readyTasks = await todoManager.getExecutableTasks({ 
      groupId: taskGroup.groupId 
    });
    
    if (readyTasks.length === 0) {
      console.log('No more ready tasks');
      break;
    }
    
    for (const task of readyTasks) {
      console.log(`Executing: ${task.title}`);
      
      await todoManager.updateExecutionStatus({
        todoId: task.id,
        state: 'running'
      });
      
      try {
        // Simulate task that might fail
        const success = await simulateUnreliableTask(task.title);
        
        if (success) {
          await todoManager.updateExecutionStatus({
            todoId: task.id,
            state: 'completed'
          });
          console.log(`✓ Completed: ${task.title}`);
        } else {
          throw new Error(`${task.title} failed due to network timeout`);
        }
        
      } catch (error) {
        console.log(`✗ Failed: ${task.title} - ${error.message}`);
        
        await todoManager.updateExecutionStatus({
          todoId: task.id,
          state: 'failed',
          error: error.message
        });
        
        // Check retry attempts
        const updatedTask = await todoManager.getTodo(task.id);
        const attempts = updatedTask.executionStatus?.attempts || 0;
        
        if (attempts < 3) {
          console.log(`  Retrying... (attempt ${attempts + 1}/3)`);
          await sleep(1000); // Wait before retry
          
          await todoManager.updateExecutionStatus({
            todoId: task.id,
            state: 'pending' // This will increment attempt count
          });
        } else {
          console.log(`  Max retries exceeded for: ${task.title}`);
        }
      }
    }
    
    iteration++;
  }
  
  // Show final status with any failures
  const status = await todoManager.getTaskGroupStatus({ 
    groupId: taskGroup.groupId 
  });
  
  console.log(`\nFinal Results:`);
  console.log(`- Completed: ${status.stats.completed}`);
  console.log(`- Failed: ${status.stats.failed}`);
  console.log(`- Total: ${status.stats.total}`);
  
  if (status.stats.failed > 0) {
    console.log('\nFailed tasks can be reset and retried:');
    const failedTasks = status.tasks.filter(t => 
      t.executionStatus?.state === 'failed'
    );
    
    for (const task of failedTasks) {
      console.log(`- ${task.title}: ${task.executionStatus.lastError}`);
    }
  }
}

// Example 4: Integration with MCP Tools
async function example4_mcpIntegration() {
  console.log('\n=== Example 4: Integration with MCP Tools ===\n');
  
  const todoManager = createTodoManager('./examples-todos.json');
  await todoManager.initialize();
  
  // Create workflow that requires specific MCP tools
  const taskGroup = await todoManager.createTaskGroup({
    mainTask: {
      title: "Automated Code Review Pipeline",
      description: "Review, test, and merge code changes using MCP tools"
    },
    subtasks: [
      { 
        title: "Analyze code changes",
        dependencies: [],
        executionConfig: {
          toolsRequired: ['git', 'codeAnalyzer'],
          params: { repository: 'main', branch: 'feature-123' }
        }
      },
      { 
        title: "Run automated tests",
        dependencies: [0],
        executionConfig: {
          toolsRequired: ['testRunner', 'coverage'],
          params: { testSuite: 'full' }
        }
      },
      { 
        title: "Generate review report",
        dependencies: [1],
        executionConfig: {
          toolsRequired: ['reportGenerator', 'slack'],
          params: { channel: '#code-review' }
        }
      },
      { 
        title: "Merge if approved",
        dependencies: [2],
        executionConfig: {
          toolsRequired: ['git', 'github'],
          params: { requiresApproval: true }
        }
      }
    ]
  });
  
  console.log(`Created MCP-integrated workflow: ${taskGroup.groupId}`);
  
  // Simulate available MCP tools
  const availableTools = new Set(['git', 'codeAnalyzer', 'testRunner', 'reportGenerator']);
  console.log(`Available MCP tools: ${Array.from(availableTools).join(', ')}`);
  
  let iteration = 1;
  while (true) {
    console.log(`\n--- Iteration ${iteration} ---`);
    
    const readyTasks = await todoManager.getExecutableTasks({ 
      groupId: taskGroup.groupId 
    });
    
    if (readyTasks.length === 0) break;
    
    for (const task of readyTasks) {
      const requiredTools = task.executionConfig?.toolsRequired || [];
      console.log(`Checking ${task.title}`);
      console.log(`  Required tools: ${requiredTools.join(', ')}`);
      
      // Verify all required tools are available
      const missingTools = requiredTools.filter(tool => !availableTools.has(tool));
      
      if (missingTools.length > 0) {
        console.log(`  ✗ Missing tools: ${missingTools.join(', ')}`);
        await todoManager.updateExecutionStatus({
          todoId: task.id,
          state: 'failed',
          error: `Missing required MCP tools: ${missingTools.join(', ')}`
        });
        continue;
      }
      
      console.log(`  ✓ All tools available, executing...`);
      
      await todoManager.updateExecutionStatus({
        todoId: task.id,
        state: 'running'
      });
      
      // Simulate MCP tool execution
      await sleep(800);
      
      await todoManager.updateExecutionStatus({
        todoId: task.id,
        state: 'completed'
      });
      
      console.log(`  ✓ Completed: ${task.title}`);
    }
    
    iteration++;
  }
  
  console.log('\nMCP-integrated workflow completed!');
}

// Example 5: Monitoring and Recovery
async function example5_monitoringRecovery() {
  console.log('\n=== Example 5: Monitoring and Recovery ===\n');
  
  const todoManager = createTodoManager('./examples-todos.json');
  await todoManager.initialize();
  
  // Create a workflow to monitor
  const taskGroup = await todoManager.createTaskGroup({
    mainTask: {
      title: "Long-Running Data Processing Job",
      description: "Process large dataset with monitoring and recovery"
    },
    subtasks: [
      { title: "Initialize processing", dependencies: [] },
      { title: "Process batch 1", dependencies: [0] },
      { title: "Process batch 2", dependencies: [0] }, // Can run in parallel with batch 1
      { title: "Process batch 3", dependencies: [0] },
      { title: "Merge results", dependencies: [1, 2, 3] },
      { title: "Generate summary", dependencies: [4] }
    ]
  });
  
  console.log(`Created monitored workflow: ${taskGroup.groupId}`);
  
  // Start execution with monitoring
  const monitor = setInterval(async () => {
    const status = await todoManager.getTaskGroupStatus({ 
      groupId: taskGroup.groupId 
    });
    
    console.log(`\n📊 Status Update:`);
    console.log(`   Pending: ${status.stats.pending}`);
    console.log(`   Running: ${status.stats.running}`);
    console.log(`   Completed: ${status.stats.completed}/${status.stats.total}`);
    console.log(`   Failed: ${status.stats.failed}`);
    
    // Check for stuck tasks (running too long)
    const runningTasks = status.tasks.filter(t => 
      t.executionStatus?.state === 'running'
    );
    
    for (const task of runningTasks) {
      // Simulate detecting stuck task (in real scenario, check timestamps)
      if (Math.random() < 0.1) { // 10% chance of detecting stuck task
        console.log(`   ⚠️  Detected stuck task: ${task.title}`);
        
        // Reset stuck task
        await todoManager.resetTaskExecution({
          todoId: task.id,
          resetDependents: false
        });
        
        console.log(`   🔄 Reset task: ${task.title}`);
      }
    }
    
    // Auto-retry failed tasks
    const failedTasks = status.tasks.filter(t => 
      t.executionStatus?.state === 'failed'
    );
    
    for (const task of failedTasks) {
      const attempts = task.executionStatus?.attempts || 0;
      if (attempts < 2) { // Allow 2 retries
        console.log(`   🔄 Auto-retrying failed task: ${task.title}`);
        await todoManager.updateExecutionStatus({
          todoId: task.id,
          state: 'pending'
        });
      }
    }
    
    // Stop monitoring when complete
    if (status.stats.completed + status.stats.failed === status.stats.total) {
      clearInterval(monitor);
      console.log('\n✅ Monitoring complete');
    }
  }, 2000);
  
  // Execute tasks
  let iteration = 1;
  while (true) {
    const readyTasks = await todoManager.getExecutableTasks({ 
      groupId: taskGroup.groupId 
    });
    
    if (readyTasks.length === 0) {
      await sleep(1000);
      // Check if really done
      const status = await todoManager.getTaskGroupStatus({ 
        groupId: taskGroup.groupId 
      });
      if (status.stats.running === 0 && status.stats.pending === 0) {
        break;
      }
      continue;
    }
    
    // Execute up to 2 tasks concurrently
    const tasksToExecute = readyTasks.slice(0, 2);
    
    for (const task of tasksToExecute) {
      // Execute async without waiting
      executeTaskWithFailures(todoManager, task);
    }
    
    await sleep(1000);
    iteration++;
  }
  
  clearInterval(monitor);
  console.log('\nLong-running job completed with monitoring!');
}

// Helper Functions

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeTaskAsync(todoManager, task) {
  await todoManager.updateExecutionStatus({
    todoId: task.id,
    state: 'running'
  });
  
  // Simulate work
  await sleep(Math.random() * 2000 + 500);
  
  await todoManager.updateExecutionStatus({
    todoId: task.id,
    state: 'completed'
  });
}

async function executeTaskWithFailures(todoManager, task) {
  await todoManager.updateExecutionStatus({
    todoId: task.id,
    state: 'running'
  });
  
  // Simulate work with possible failure
  await sleep(Math.random() * 1500 + 500);
  
  // 20% chance of failure
  if (Math.random() < 0.2) {
    await todoManager.updateExecutionStatus({
      todoId: task.id,
      state: 'failed',
      error: 'Random processing error'
    });
  } else {
    await todoManager.updateExecutionStatus({
      todoId: task.id,
      state: 'completed'
    });
  }
}

async function simulateUnreliableTask(taskTitle) {
  // Simulate network/processing failures
  const failureRate = taskTitle.includes('API') ? 0.4 : 0.2;
  return Math.random() > failureRate;
}

// Main execution
async function runAllExamples() {
  console.log('🚀 Agentic AI Execution Examples\n');
  console.log('This demonstrates practical patterns for autonomous task execution\n');
  
  try {
    await example1_sequentialExecution();
    await example2_parallelExecution();
    await example3_errorHandling();
    await example4_mcpIntegration();
    await example5_monitoringRecovery();
    
    console.log('\n🎉 All examples completed successfully!');
    console.log('\nThese patterns can be adapted for your specific agentic AI use cases.');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error.message);
    console.error(error.stack);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

module.exports = {
  example1_sequentialExecution,
  example2_parallelExecution,
  example3_errorHandling,
  example4_mcpIntegration,
  example5_monitoringRecovery,
  runAllExamples
};