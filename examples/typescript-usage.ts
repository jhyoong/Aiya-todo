/**
 * TypeScript Usage Examples for aiya-todo-mcp
 * 
 * This file demonstrates type-safe usage of aiya-todo-mcp with full TypeScript support.
 * Shows proper typing for all agentic AI features and integration patterns.
 */

import { 
  createTodoManager,
  TodoManager,
  Todo,
  CreateTaskGroupRequest,
  GetExecutableTasksRequest,
  UpdateExecutionStatusRequest,
  GetTaskGroupStatusRequest,
  ResetTaskExecutionRequest,
  CreateTodoRequest,
  UpdateTodoRequest,
  TaskGroupResponse,
  TaskGroupStatusResponse,
  ExecutionState,
  VerificationStatus
} from 'aiya-todo-mcp';

// Type-safe task execution interface
interface TaskExecutor {
  execute(task: Todo): Promise<void>;
  canExecute(task: Todo): boolean;
  getRequiredTools(): string[];
}

// Example executor implementation
class TypeSafeTaskExecutor implements TaskExecutor {
  private readonly availableTools: Set<string>;
  
  constructor(availableTools: string[]) {
    this.availableTools = new Set(availableTools);
  }
  
  canExecute(task: Todo): boolean {
    const requiredTools = task.executionConfig?.toolsRequired || [];
    return requiredTools.every(tool => this.availableTools.has(tool));
  }
  
  getRequiredTools(): string[] {
    return Array.from(this.availableTools);
  }
  
  async execute(task: Todo): Promise<void> {
    if (!this.canExecute(task)) {
      throw new Error(`Missing required tools for task: ${task.title}`);
    }
    
    // Type-safe access to execution config
    const config = task.executionConfig;
    const toolsRequired = config?.toolsRequired || [];
    const params = config?.params || {};
    
    console.log(`Executing ${task.title} with tools: ${toolsRequired.join(', ')}`);
    
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Type-safe workflow manager
class TypeSafeWorkflowManager {
  private todoManager: TodoManager;
  private executor: TaskExecutor;
  
  constructor(dataFile: string, executor: TaskExecutor) {
    this.todoManager = createTodoManager(dataFile);
    this.executor = executor;
  }
  
  async initialize(): Promise<void> {
    await this.todoManager.initialize();
  }
  
  /**
   * Create a type-safe task group with proper validation
   */
  async createWorkflow(request: CreateTaskGroupRequest): Promise<TaskGroupResponse> {
    // Validate request structure
    if (!request.mainTask?.title) {
      throw new Error('Main task must have a title');
    }
    
    if (!request.subtasks || request.subtasks.length === 0) {
      throw new Error('Workflow must have at least one subtask');
    }
    
    // Type-safe task group creation
    const result = await this.todoManager.createTaskGroup(request);
    
    console.log(`Created workflow: ${result.mainTask.title}`);
    console.log(`Task group ID: ${result.groupId}`);
    console.log(`Subtasks: ${result.subtasks.length}`);
    
    return result;
  }
  
  /**
   * Execute workflow with type safety and error handling
   */
  async executeWorkflow(groupId: string): Promise<TaskGroupStatusResponse> {
    let iteration = 1;
    
    while (true) {
      console.log(`\n--- Execution Iteration ${iteration} ---`);
      
      // Type-safe query for executable tasks
      const query: GetExecutableTasksRequest = {
        groupId,
        limit: 5 // Process up to 5 tasks at once
      };
      
      const readyTasks = await this.todoManager.getExecutableTasks(query);
      
      if (readyTasks.length === 0) {
        console.log('No more tasks ready for execution');
        break;
      }
      
      // Process tasks with type safety
      await Promise.all(readyTasks.map(task => this.executeTask(task)));
      
      iteration++;
    }
    
    // Get final status with type safety
    const statusQuery: GetTaskGroupStatusRequest = { groupId };
    return await this.todoManager.getTaskGroupStatus(statusQuery);
  }
  
  /**
   * Execute individual task with proper error handling and state management
   */
  private async executeTask(task: Todo): Promise<void> {
    try {
      // Validate task can be executed
      if (!this.executor.canExecute(task)) {
        const requiredTools = task.executionConfig?.toolsRequired || [];
        const availableTools = this.executor.getRequiredTools();
        const missingTools = requiredTools.filter(tool => !availableTools.includes(tool));
        
        const failRequest: UpdateExecutionStatusRequest = {
          todoId: task.id,
          state: 'failed' as ExecutionState,
          error: `Missing tools: ${missingTools.join(', ')}`
        };
        
        await this.todoManager.updateExecutionStatus(failRequest);
        return;
      }
      
      // Mark as running
      const runningRequest: UpdateExecutionStatusRequest = {
        todoId: task.id,
        state: 'running' as ExecutionState
      };
      await this.todoManager.updateExecutionStatus(runningRequest);
      
      // Execute task
      await this.executor.execute(task);
      
      // Mark as completed
      const completedRequest: UpdateExecutionStatusRequest = {
        todoId: task.id,
        state: 'completed' as ExecutionState
      };
      await this.todoManager.updateExecutionStatus(completedRequest);
      
      console.log(`✓ Completed: ${task.title}`);
      
    } catch (error) {
      console.error(`✗ Failed: ${task.title} - ${error.message}`);
      
      const failRequest: UpdateExecutionStatusRequest = {
        todoId: task.id,
        state: 'failed' as ExecutionState,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      await this.todoManager.updateExecutionStatus(failRequest);
      
      // Check if retry is needed
      await this.handleTaskFailure(task);
    }
  }
  
  /**
   * Handle task failures with intelligent retry logic
   */
  private async handleTaskFailure(task: Todo): Promise<void> {
    const updatedTask = await this.todoManager.getTodo(task.id);
    const attempts = updatedTask.executionStatus?.attempts || 0;
    const maxRetries = updatedTask.executionConfig?.retryOnFailure !== false ? 3 : 0;
    
    if (attempts < maxRetries) {
      console.log(`  Scheduling retry for: ${task.title} (attempt ${attempts + 1}/${maxRetries})`);
      
      // Exponential backoff
      const delay = Math.pow(2, attempts) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const retryRequest: UpdateExecutionStatusRequest = {
        todoId: task.id,
        state: 'pending' as ExecutionState
      };
      
      await this.todoManager.updateExecutionStatus(retryRequest);
    } else {
      console.log(`  Max retries exceeded for: ${task.title}`);
    }
  }
  
  /**
   * Monitor workflow execution with type-safe status updates
   */
  async monitorWorkflow(groupId: string, intervalMs: number = 5000): Promise<void> {
    const monitor = setInterval(async () => {
      try {
        const statusQuery: GetTaskGroupStatusRequest = { groupId };
        const status = await this.todoManager.getTaskGroupStatus(statusQuery);
        
        console.log('\n📊 Workflow Status:');
        console.log(`   Progress: ${status.stats.completed}/${status.stats.total} completed`);
        console.log(`   Running: ${status.stats.running}`);
        console.log(`   Failed: ${status.stats.failed}`);
        console.log(`   Pending: ${status.stats.pending}`);
        
        // Check for completion
        const isComplete = status.stats.completed + status.stats.failed === status.stats.total;
        
        if (isComplete) {
          clearInterval(monitor);
          console.log('\n✅ Workflow monitoring complete');
          
          // Report any failed tasks
          if (status.stats.failed > 0) {
            console.log('\n❌ Failed Tasks:');
            status.tasks
              .filter(task => task.executionStatus?.state === 'failed')
              .forEach(task => {
                console.log(`  - ${task.title}: ${task.executionStatus?.lastError}`);
              });
          }
        }
        
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, intervalMs);
  }
  
  /**
   * Reset failed tasks with type safety
   */
  async resetFailedTasks(groupId: string, resetDependents: boolean = false): Promise<void> {
    const statusQuery: GetTaskGroupStatusRequest = { groupId };
    const status = await this.todoManager.getTaskGroupStatus(statusQuery);
    
    const failedTasks = status.tasks.filter(task => 
      task.executionStatus?.state === 'failed'
    );
    
    if (failedTasks.length === 0) {
      console.log('No failed tasks to reset');
      return;
    }
    
    console.log(`Resetting ${failedTasks.length} failed tasks...`);
    
    for (const task of failedTasks) {
      const resetRequest: ResetTaskExecutionRequest = {
        todoId: task.id,
        resetDependents
      };
      
      const result = await this.todoManager.resetTaskExecution(resetRequest);
      console.log(`Reset: ${task.title} (${result.resetTasks.length} tasks affected)`);
    }
  }
}

// Advanced type-safe patterns
class AdvancedWorkflowPatterns {
  private workflowManager: TypeSafeWorkflowManager;
  
  constructor(workflowManager: TypeSafeWorkflowManager) {
    this.workflowManager = workflowManager;
  }
  
  /**
   * Create a conditional workflow based on verification status
   */
  async createConditionalWorkflow(): Promise<string> {
    const workflow: CreateTaskGroupRequest = {
      mainTask: {
        title: "Conditional Deployment Pipeline",
        description: "Deploy only if all quality gates pass"
      },
      subtasks: [
        {
          title: "Run unit tests",
          dependencies: [],
          executionConfig: {
            toolsRequired: ['testRunner'],
            params: { testType: 'unit' }
          }
        },
        {
          title: "Run integration tests", 
          dependencies: [0],
          executionConfig: {
            toolsRequired: ['testRunner'],
            params: { testType: 'integration' }
          }
        },
        {
          title: "Security scan",
          dependencies: [0],
          executionConfig: {
            toolsRequired: ['securityScanner'],
            params: { scanType: 'full' }
          }
        },
        {
          title: "Deploy to production",
          dependencies: [1, 2], // Requires both test types to pass
          executionConfig: {
            toolsRequired: ['deployment'],
            params: { 
              environment: 'production',
              requiresVerification: true
            }
          }
        }
      ]
    };
    
    const result = await this.workflowManager.createWorkflow(workflow);
    return result.groupId;
  }
  
  /**
   * Create a data processing pipeline with type-safe configuration
   */
  async createDataPipeline(): Promise<string> {
    interface DataProcessingConfig {
      inputFormat: 'json' | 'csv' | 'xml';
      outputFormat: 'json' | 'parquet' | 'csv';
      validationRules: string[];
      transformations: string[];
    }
    
    const pipelineConfig: DataProcessingConfig = {
      inputFormat: 'json',
      outputFormat: 'parquet',
      validationRules: ['required_fields', 'data_types', 'value_ranges'],
      transformations: ['normalize', 'aggregate', 'enrich']
    };
    
    const workflow: CreateTaskGroupRequest = {
      mainTask: {
        title: "Data Processing Pipeline",
        description: `Process ${pipelineConfig.inputFormat} to ${pipelineConfig.outputFormat}`
      },
      subtasks: [
        {
          title: "Ingest data",
          dependencies: [],
          executionConfig: {
            toolsRequired: ['dataIngestion'],
            params: { 
              format: pipelineConfig.inputFormat,
              validation: true
            }
          }
        },
        {
          title: "Validate data quality",
          dependencies: [0],
          executionConfig: {
            toolsRequired: ['dataValidator'],
            params: { 
              rules: pipelineConfig.validationRules
            }
          }
        },
        {
          title: "Transform data",
          dependencies: [1],
          executionConfig: {
            toolsRequired: ['dataTransformer'],
            params: { 
              transformations: pipelineConfig.transformations
            }
          }
        },
        {
          title: "Export processed data",
          dependencies: [2],
          executionConfig: {
            toolsRequired: ['dataExporter'],
            params: { 
              outputFormat: pipelineConfig.outputFormat
            }
          }
        }
      ]
    };
    
    const result = await this.workflowManager.createWorkflow(workflow);
    return result.groupId;
  }
  
  /**
   * Execute workflow with custom verification logic
   */
  async executeWithVerification(groupId: string): Promise<void> {
    await this.workflowManager.executeWorkflow(groupId);
    
    // Get final status
    const statusQuery: GetTaskGroupStatusRequest = { groupId };
    const status = await this.workflowManager.getTaskGroupStatus(statusQuery);
    
    // Verify all tasks completed successfully
    const allCompleted = status.stats.failed === 0 && 
                        status.stats.completed === status.stats.total;
    
    if (allCompleted) {
      // Set verification status for main task
      const mainTask = status.mainTask;
      if (mainTask) {
        const updateRequest: UpdateTodoRequest = {
          id: mainTask.id,
          verificationStatus: 'verified' as VerificationStatus,
          verificationNotes: 'All subtasks completed successfully'
        };
        
        // Note: This would require adding updateTodo to the manager interface
        // await this.workflowManager.updateTodo(updateRequest);
        console.log(`✅ Workflow verified: ${mainTask.title}`);
      }
    } else {
      console.log(`❌ Workflow failed verification: ${status.stats.failed} failed tasks`);
    }
  }
}

// Example usage demonstrating type safety
async function demonstrateTypeSafeUsage(): Promise<void> {
  console.log('🔷 TypeScript Usage Examples for aiya-todo-mcp\n');
  
  // Create type-safe executor
  const availableTools = ['testRunner', 'securityScanner', 'deployment', 'dataIngestion'];
  const executor = new TypeSafeTaskExecutor(availableTools);
  
  // Create workflow manager
  const workflowManager = new TypeSafeWorkflowManager('./typescript-todos.json', executor);
  await workflowManager.initialize();
  
  // Create advanced patterns
  const patterns = new AdvancedWorkflowPatterns(workflowManager);
  
  try {
    // Example 1: Conditional workflow
    console.log('Creating conditional deployment workflow...');
    const deploymentGroupId = await patterns.createConditionalWorkflow();
    
    // Start monitoring
    workflowManager.monitorWorkflow(deploymentGroupId, 3000);
    
    // Execute workflow
    await patterns.executeWithVerification(deploymentGroupId);
    
    console.log('\n✅ Conditional workflow completed');
    
    // Example 2: Data processing pipeline
    console.log('\nCreating data processing pipeline...');
    const pipelineGroupId = await patterns.createDataPipeline();
    
    await workflowManager.executeWorkflow(pipelineGroupId);
    
    console.log('\n✅ Data pipeline completed');
    
    // Example 3: Error recovery
    console.log('\nDemonstrating error recovery...');
    await workflowManager.resetFailedTasks(pipelineGroupId, true);
    
  } catch (error) {
    console.error('❌ TypeScript example failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Type definitions for custom extensions
interface CustomTaskMetadata {
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number; // minutes
  assignedAgent?: string;
  tags: string[];
}

interface EnhancedTodo extends Todo {
  metadata?: CustomTaskMetadata;
}

// Custom typed workflow manager
class EnhancedWorkflowManager extends TypeSafeWorkflowManager {
  /**
   * Create workflow with enhanced metadata
   */
  async createEnhancedWorkflow(
    request: CreateTaskGroupRequest,
    metadata: CustomTaskMetadata[]
  ): Promise<TaskGroupResponse> {
    // Validate metadata matches subtasks
    if (metadata.length !== request.subtasks.length) {
      throw new Error('Metadata count must match subtask count');
    }
    
    // Create base workflow
    const result = await this.createWorkflow(request);
    
    // Enhance with metadata (in a real implementation, this would extend the Todo interface)
    console.log('Enhanced workflow created with metadata:');
    metadata.forEach((meta, index) => {
      console.log(`  Task ${index + 1}: Priority ${meta.priority}, Est. ${meta.estimatedDuration}min`);
    });
    
    return result;
  }
}

// Export everything for use in other modules
export {
  TypeSafeTaskExecutor,
  TypeSafeWorkflowManager,
  AdvancedWorkflowPatterns,
  EnhancedWorkflowManager,
  demonstrateTypeSafeUsage
};

export type {
  TaskExecutor,
  CustomTaskMetadata,
  EnhancedTodo
};

// Run demonstration if this file is executed directly
if (require.main === module) {
  demonstrateTypeSafeUsage().catch(console.error);
}