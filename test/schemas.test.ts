import {
  CreateTodoSchema,
  UpdateTodoSchema,
  SetVerificationMethodSchema,
  UpdateVerificationStatusSchema,
  GetTodosNeedingVerificationSchema,
} from '../src/lib/schemas.js';

describe('Schema Validation', () => {
  describe('CreateTodoSchema', () => {
    it('should validate basic todo creation', () => {
      const validData = { title: 'Test task' };
      const result = CreateTodoSchema.parse(validData);
      expect(result.title).toBe('Test task');
    });

    it('should validate todo creation with all optional fields', () => {
      const validData = {
        title: 'Complete task',
        description: 'A detailed description',
        tags: ['urgent', 'work'],
        groupId: 'project-1',
        verificationMethod: 'Run tests and check output'
      };

      const result = CreateTodoSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should reject empty title', () => {
      const invalidData = { title: '' };
      expect(() => CreateTodoSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing title', () => {
      const invalidData = { description: 'No title' };
      expect(() => CreateTodoSchema.parse(invalidData)).toThrow();
    });

    it('should validate with empty optional arrays', () => {
      const validData = { title: 'Test', tags: [] };
      const result = CreateTodoSchema.parse(validData);
      expect(result.tags).toEqual([]);
    });
  });

  describe('UpdateTodoSchema', () => {
    it('should validate basic update', () => {
      const validData = { id: '1', title: 'Updated title' };
      const result = UpdateTodoSchema.parse(validData);
      expect(result.id).toBe('1');
      expect(result.title).toBe('Updated title');
    });

    it('should validate update with verification fields', () => {
      const validData = {
        id: '1',
        verificationMethod: 'New verification method',
        verificationStatus: 'verified' as const,
        verificationNotes: 'All tests passed'
      };

      const result = UpdateTodoSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid verification status', () => {
      const invalidData = {
        id: '1',
        verificationStatus: 'invalid_status'
      };

      expect(() => UpdateTodoSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty ID', () => {
      const invalidData = { id: '', title: 'Test' };
      expect(() => UpdateTodoSchema.parse(invalidData)).toThrow();
    });

    it('should reject update with no fields to update', () => {
      const invalidData = { id: '1' };
      expect(() => UpdateTodoSchema.parse(invalidData)).toThrow();
    });

    it('should accept update with only completion status', () => {
      const validData = { id: '1', completed: true };
      const result = UpdateTodoSchema.parse(validData);
      expect(result.completed).toBe(true);
    });
  });

  describe('SetVerificationMethodSchema', () => {
    it('should validate basic verification method setting', () => {
      const validData = {
        todoId: '1',
        method: 'Run integration tests'
      };

      const result = SetVerificationMethodSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should validate with notes', () => {
      const validData = {
        todoId: '1',
        method: 'Manual testing',
        notes: 'Focus on edge cases'
      };

      const result = SetVerificationMethodSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should reject empty todoId', () => {
      const invalidData = {
        todoId: '',
        method: 'Test method'
      };

      expect(() => SetVerificationMethodSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty method', () => {
      const invalidData = {
        todoId: '1',
        method: ''
      };

      expect(() => SetVerificationMethodSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing required fields', () => {
      const invalidData = { todoId: '1' };
      expect(() => SetVerificationMethodSchema.parse(invalidData)).toThrow();
    });
  });

  describe('UpdateVerificationStatusSchema', () => {
    it('should validate status update to verified', () => {
      const validData = {
        todoId: '1',
        status: 'verified' as const
      };

      const result = UpdateVerificationStatusSchema.parse(validData);
      expect(result.status).toBe('verified');
    });

    it('should validate status update to failed with notes', () => {
      const validData = {
        todoId: '1',
        status: 'failed' as const,
        notes: 'Tests failed due to network timeout'
      };

      const result = UpdateVerificationStatusSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should validate all valid status values', () => {
      const validStatuses = ['pending', 'verified', 'failed'] as const;
      
      validStatuses.forEach(status => {
        const validData = { todoId: '1', status };
        const result = UpdateVerificationStatusSchema.parse(validData);
        expect(result.status).toBe(status);
      });
    });

    it('should reject invalid status', () => {
      const invalidData = {
        todoId: '1',
        status: 'invalid_status'
      };

      expect(() => UpdateVerificationStatusSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty todoId', () => {
      const invalidData = {
        todoId: '',
        status: 'verified' as const
      };

      expect(() => UpdateVerificationStatusSchema.parse(invalidData)).toThrow();
    });
  });

  describe('GetTodosNeedingVerificationSchema', () => {
    it('should validate empty request', () => {
      const validData = {};
      const result = GetTodosNeedingVerificationSchema.parse(validData);
      expect(result).toEqual({});
    });

    it('should validate with groupId', () => {
      const validData = { groupId: 'project-1' };
      const result = GetTodosNeedingVerificationSchema.parse(validData);
      expect(result.groupId).toBe('project-1');
    });

    it('should allow undefined groupId', () => {
      const validData = { groupId: undefined };
      const result = GetTodosNeedingVerificationSchema.parse(validData);
      expect(result.groupId).toBeUndefined();
    });
  });
});