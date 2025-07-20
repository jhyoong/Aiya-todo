#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TodoManager } from "./lib/TodoManager.js";
import {
  CreateTodoSchema,
  UpdateTodoSchema,
  DeleteTodoSchema,
  GetTodoSchema,
  ListTodosSchema,
  SetVerificationMethodSchema,
  UpdateVerificationStatusSchema,
  GetTodosNeedingVerificationSchema,
} from "./lib/schemas.js";
import { UpdateTodoRequest, ListTodosRequest, SetVerificationMethodRequest, UpdateVerificationStatusRequest, GetTodosNeedingVerificationRequest } from "./types.js";

const todoManager = new TodoManager();


const server = new Server(
  {
    name: "aiya-todo-mcp",
    version: "0.2.1",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "createTodo",
        description: "Create a new todo item with optional verification settings",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the todo item",
              minLength: 1,
            },
            description: {
              type: "string",
              description: "Optional detailed description of the todo item",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional array of tags for categorization",
            },
            groupId: {
              type: "string",
              description: "Optional group ID for organizing related todos",
            },
            verificationMethod: {
              type: "string",
              description: "Optional method for verifying task completion",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "listTodos",
        description: "List all todo items with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            completed: {
              type: "boolean",
              description: "Filter by completion status (optional)",
            },
          },
        },
      },
      {
        name: "getTodo",
        description: "Get a specific todo item by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The ID of the todo item",
              minLength: 1,
            },
          },
          required: ["id"],
        },
      },
      {
        name: "updateTodo",
        description: "Update a todo item's properties including verification settings",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The ID of the todo item to update",
              minLength: 1,
            },
            title: {
              type: "string",
              description: "New title for the todo item (optional)",
              minLength: 1,
            },
            description: {
              type: "string",
              description: "New description for the todo item (optional)",
            },
            completed: {
              type: "boolean",
              description: "New completion status (optional)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "New tags array (optional)",
            },
            groupId: {
              type: "string",
              description: "New group ID (optional)",
            },
            verificationMethod: {
              type: "string",
              description: "New verification method (optional)",
            },
            verificationStatus: {
              type: "string",
              enum: ["pending", "verified", "failed"],
              description: "New verification status (optional)",
            },
            verificationNotes: {
              type: "string",
              description: "New verification notes (optional)",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "deleteTodo",
        description: "Delete a todo item by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The ID of the todo item to delete",
              minLength: 1,
            },
          },
          required: ["id"],
        },
      },
      {
        name: "setVerificationMethod",
        description: "Set how a todo should be verified by the LLM",
        inputSchema: {
          type: "object",
          properties: {
            todoId: {
              type: "string",
              description: "The ID of the todo item",
              minLength: 1,
            },
            method: {
              type: "string",
              description: "How the todo should be verified (LLM decides this)",
              minLength: 1,
            },
            notes: {
              type: "string",
              description: "Optional notes about the verification method",
            },
          },
          required: ["todoId", "method"],
        },
      },
      {
        name: "updateVerificationStatus",
        description: "Update the verification status of a todo",
        inputSchema: {
          type: "object",
          properties: {
            todoId: {
              type: "string",
              description: "The ID of the todo item",
              minLength: 1,
            },
            status: {
              type: "string",
              enum: ["pending", "verified", "failed"],
              description: "The verification status",
            },
            notes: {
              type: "string",
              description: "Optional notes about the verification result",
            },
          },
          required: ["todoId", "status"],
        },
      },
      {
        name: "getTodosNeedingVerification",
        description: "List all todos that need verification",
        inputSchema: {
          type: "object",
          properties: {
            groupId: {
              type: "string",
              description: "Optional group ID to filter by",
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "createTodo": {
        const validatedArgs = CreateTodoSchema.parse(args);
        const todo = await todoManager.createTodo(validatedArgs as any);
        
        return {
          content: [
            {
              type: "text",
              text: `Todo created successfully: "${todo.title}" (ID: ${todo.id})`,
            },
          ],
        };
      }

      case "listTodos": {
        const validatedArgs = ListTodosSchema.parse(args);
        const todos = todoManager.listTodos(validatedArgs as ListTodosRequest);
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${todos.length} todos:\n${todos.map(todo => 
                `[${todo.completed ? '✓' : ' '}] ${todo.id}: ${todo.title}`
              ).join('\n')}`,
            },
          ],
        };
      }

      case "getTodo": {
        const validatedArgs = GetTodoSchema.parse(args);
        const todo = todoManager.getTodo(validatedArgs.id);
        
        if (!todo) {
          throw new Error(`Todo with ID ${validatedArgs.id} not found`);
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Todo: [${todo.completed ? '✓' : ' '}] ${todo.title}\nID: ${todo.id}\nCreated: ${todo.createdAt.toISOString()}`,
            },
          ],
        };
      }

      case "updateTodo": {
        const validatedArgs = UpdateTodoSchema.parse(args);
        const todo = await todoManager.updateTodo(validatedArgs as UpdateTodoRequest);
        
        return {
          content: [
            {
              type: "text",
              text: `Todo updated successfully: [${todo.completed ? '✓' : ' '}] "${todo.title}" (ID: ${todo.id})`,
            },
          ],
        };
      }

      case "deleteTodo": {
        const validatedArgs = DeleteTodoSchema.parse(args);
        await todoManager.deleteTodo(validatedArgs);
        
        return {
          content: [
            {
              type: "text",
              text: `Todo with ID ${validatedArgs.id} deleted successfully`,
            },
          ],
        };
      }

      case "setVerificationMethod": {
        const validatedArgs = SetVerificationMethodSchema.parse(args);
        const todo = await todoManager.setVerificationMethod(validatedArgs as SetVerificationMethodRequest);
        
        return {
          content: [
            {
              type: "text",
              text: `Verification method set for todo "${todo.title}" (ID: ${todo.id})\nMethod: ${todo.verificationMethod}\nStatus: ${todo.verificationStatus}${todo.verificationNotes ? `\nNotes: ${todo.verificationNotes}` : ''}`,
            },
          ],
        };
      }

      case "updateVerificationStatus": {
        const validatedArgs = UpdateVerificationStatusSchema.parse(args);
        const todo = await todoManager.updateVerificationStatus(validatedArgs as UpdateVerificationStatusRequest);
        
        return {
          content: [
            {
              type: "text",
              text: `Verification status updated for todo "${todo.title}" (ID: ${todo.id})\nStatus: ${todo.verificationStatus}${todo.verificationNotes ? `\nNotes: ${todo.verificationNotes}` : ''}`,
            },
          ],
        };
      }

      case "getTodosNeedingVerification": {
        const validatedArgs = GetTodosNeedingVerificationSchema.parse(args);
        const todos = todoManager.getTodosNeedingVerification(validatedArgs as GetTodosNeedingVerificationRequest);
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${todos.length} todos needing verification:\n${todos.map(todo => 
                `${todo.id}: ${todo.title}\n  Method: ${todo.verificationMethod}\n  Status: ${todo.verificationStatus || 'pending'}${todo.verificationNotes ? `\n  Notes: ${todo.verificationNotes}` : ''}`
              ).join('\n\n')}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "todo://list",
        name: "All todos",
        description: "List of all todo items",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    if (uri === "todo://list") {
      const todos = todoManager.getAllTodos();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(todos, null, 2),
          },
        ],
      };
    }

    const todoItemMatch = uri.match(/^todo:\/\/item\/(.+)$/);
    if (todoItemMatch) {
      const todoId = todoItemMatch[1];
      const todo = todoManager.getTodo(todoId);
      
      if (!todo) {
        throw new Error(`Todo with ID ${todoId} not found`);
      }
      
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(todo, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Error reading resource: ${errorMessage}`);
  }
});

async function main() {
  await todoManager.initialize();
  console.error("TodoManager initialized and todos loaded");
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Todo Server running on stdio");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Server failed to start:", error);
    process.exit(1);
  });
}