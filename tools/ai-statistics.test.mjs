import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSession } from './ai-statistics.mjs';

const at = seconds => new Date(Date.UTC(2026, 9, 20, 10, 0, seconds)).toISOString();
const row = (type, payload, seconds = 0) => JSON.stringify({ type, payload, timestamp: at(seconds) });
const context = (mode = 'default') => row('turn_context', { turn_id: 'turn', collaboration_mode: { mode } });
const registration = { id: 'session', page: 'abiturient' };
const usage = { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20, reasoning_output_tokens: 5, total_tokens: 120 };

test('unique responses and completed MCP calls; cumulative counters excluded', () => {
  const response = row('token_usage_record', { response_id: 'response', turn_id: 'turn', usage, thread_token_usage: { total_tokens: 999999 } }, 3);
  const tool = row('event_msg', { type: 'item_completed', item: { id: 'tool', type: 'McpToolCall', server: 'figma', tool: 'export', status: 'failed' } }, 4);
  const text = [context(), response, response, tool, tool, row('event_msg', { type: 'token_count', info: { total_token_usage: usage } })].join('\n');
  const first = parseSession(text, registration);
  assert.deepEqual(first, parseSession(text, registration));
  assert.equal(first.records[0].modelResponses, 1);
  assert.equal(first.records[0].mcpCalls, 1);
  assert.equal(first.records[0].mcpErrors, 1);
  assert.deepEqual(first.records[0].tokens, usage);
  assert.equal(first.records[0].phase, 'unknown');
});

test('incomplete logs and missing metrics remain unknown; no raw contents escape', () => {
  const text = [context(), row('token_usage_record', { response_id: 'r', usage: null, secret: 'private command' }), '{unfinished'].join('\n');
  const result = parseSession(text, registration);
  assert.equal(result.source.malformedLines, 1);
  assert.equal(result.records[0].tokens, null);
  assert.equal(result.records[0].durationMs, null);
  assert.ok(!JSON.stringify(result).includes('private command'));
});

test('registered working intervals exclude time between turns and split by phase markers', () => {
  const text = [context(), row('event_msg', { type: 'task_started', turn_id: 'turn' }, 1), row('event_msg', { type: 'task_complete', turn_id: 'turn', completed_at: at(11) }, 11)].join('\n');
  const result = parseSession(text, registration, [{ sessionId: 'session', turnId: 'turn', phase: 'verification', at: at(6) }], Date.parse(at(50)));
  assert.equal(result.records.reduce((sum, record) => sum + record.durationMs, 0), 10000);
  assert.equal(result.records.find(record => record.phase === 'verification').durationMs, 5000);
  const planned = parseSession(text.replace(context(), context('plan')), registration);
  assert.equal(planned.records[0].phase, 'planning');
});

test('Unix timestamps and aborted turns do not count idle time; partial metrics stay unknown', () => {
  const text = [context(), row('event_msg', { type: 'task_started', turn_id: 'turn', started_at: Date.parse(at(1)) / 1000 }, 1), row('token_usage_record', { response_id: 'r', usage: { input_tokens: 10 } }, 3), row('event_msg', { type: 'turn_aborted', turn_id: 'turn', started_at: Date.parse(at(1)) / 1000, completed_at: Date.parse(at(5)) / 1000 }, 5)].join('\n');
  const result = parseSession(text, registration, [], Date.parse(at(50)));
  assert.equal(result.records[0].durationMs, 4000);
  assert.equal(result.records[0].tokens.input_tokens, 10);
  assert.equal(result.records[0].tokens.output_tokens, null);
});

test('снимок лимитов отделён от токенов задачи; приватные поля аккаунта не передаются', () => {
  const text = [context(), row('event_msg', { type: 'token_count', rate_limits: { primary: { used_percent: 48, window_minutes: 300, resets_at: 1792499539 }, credits: { balance: 'private' }, plan_type: 'private' } }, 5)].join('\n');
  const result = parseSession(text, registration);
  assert.equal(result.accountLimits.windows[0].usedPercent, 48);
  assert.equal(result.accountLimits.capturedAt, at(5));
  assert.equal(result.records.length, 0);
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.equal(parseSession(context(), registration).accountLimits, null);
});
