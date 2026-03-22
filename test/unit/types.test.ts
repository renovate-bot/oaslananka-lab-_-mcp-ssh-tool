import { describe, expect, test } from '@jest/globals';
import {
  ConnectionParamsSchema,
  EnsureLinesSchema,
  EnsurePackageSchema,
  EnsureServiceSchema,
  PatchApplySchema
} from '../../src/types.js';

describe('Schema contracts', () => {
  test('ConnectionParamsSchema applies expected defaults', () => {
    const result = ConnectionParamsSchema.parse({
      host: 'example.com',
      username: 'deployer'
    });

    expect(result.auth).toBe('auto');
    expect(result.readyTimeoutMs).toBe(20000);
    expect(result.ttlMs).toBe(900000);
    expect(result.strictHostKeyChecking).toBe(false);
  });

  test('PatchApplySchema accepts diff instead of patch', () => {
    const parsed = PatchApplySchema.parse({
      sessionId: 'session-1',
      path: '/tmp/file.txt',
      diff: '@@ -1 +1 @@\n-old\n+new'
    });

    expect(parsed.diff).toContain('+new');
    expect(() => PatchApplySchema.parse({
      sessionId: 'session-1',
      path: '/tmp/file.txt',
      patch: 'legacy-field'
    })).toThrow();
  });

  test('EnsurePackageSchema defaults to present and supports absent', () => {
    expect(EnsurePackageSchema.parse({
      sessionId: 'session-1',
      name: 'htop'
    }).state).toBe('present');

    expect(EnsurePackageSchema.parse({
      sessionId: 'session-1',
      name: 'htop',
      state: 'absent'
    }).state).toBe('absent');
  });

  test('EnsureLinesSchema defaults to present and supports absent', () => {
    expect(EnsureLinesSchema.parse({
      sessionId: 'session-1',
      path: '/etc/hosts',
      lines: ['127.0.0.1 localhost']
    }).state).toBe('present');

    expect(EnsureLinesSchema.parse({
      sessionId: 'session-1',
      path: '/etc/hosts',
      lines: ['127.0.0.1 localhost'],
      state: 'absent'
    }).state).toBe('absent');
  });

  test('EnsureServiceSchema supports restarted state', () => {
    const parsed = EnsureServiceSchema.parse({
      sessionId: 'session-1',
      name: 'nginx',
      state: 'restarted'
    });

    expect(parsed.state).toBe('restarted');
  });
});
