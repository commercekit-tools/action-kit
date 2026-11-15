import { describe, expect, it } from 'vitest';
import { getNotificationStyle, renderActionSummary, type NotificationStatus } from '../src/index.js';

const states = [
  ['success', '✅', 'success', 'Succeeded'],
  ['failure', '❌', 'danger', 'Failed'],
  ['warning', '⚠️', 'warning', 'Completed with warnings'],
  ['started', 'ℹ️', 'info', 'Started'],
  ['cancelled', '⏹️', 'neutral', 'Cancelled'],
  ['internal-error', '❌', 'danger', 'CommerceKit error'],
  ['action-required', '⚠️', 'warning', 'Action required'],
] as const;
describe('common status and summary presentation', () => {
  for (const [status, icon, tone, label] of states)
    it(`shares the ${status} display contract`, () => {
      expect(getNotificationStyle(status)).toMatchObject({ icon, tone, label });
      expect(Object.isFrozen(getNotificationStyle(status))).toBe(true);
      expect(renderActionSummary({ title: 'CommerceKit · Action', status })).toBe(
        `## ${icon} CommerceKit · Action — ${label}\n\n`,
      );
    });
  it('rejects invented and prototype statuses', () => {
    for (const status of ['unknown', 'constructor', '__proto__'])
      expect(() => getNotificationStyle(status as NotificationStatus)).toThrow('Invalid notification status');
  });
  it('provides ordered result, input, issue, detail and workflow sections', () => {
    const summary = renderActionSummary({
      title: 'CommerceKit · Build',
      status: 'failure',
      description: 'Build could not complete.',
      facts: [
        { label: 'Build code', value: 'build-1' },
        { label: 'Retries', value: 0 },
        { label: 'Wait', value: false },
      ],
      inputContext: {
        inputs: { branch: 'main', 'client-secret': '[REDACTED]' },
        inputsValidated: true,
        inputsTruncated: false,
      },
      error: { code: 'authorization-failure', message: 'Authorization failed. HTTP 403.' },
      issues: [{ message: 'Review the configured permissions.' }],
      sections: [{ title: 'Safety', headers: ['Check', 'State'], rows: [['Inventory', true]] }],
      links: [{ label: 'Workflow run', url: 'https://github.example/org/repo/actions/runs/42' }],
    });
    expect(summary).toContain('| Retries | 0 |');
    expect(summary).toContain('| Wait | false |');
    expect(summary).toContain('| authorization-failure | Authorization failed. HTTP 403. |');
    expect(summary).toContain('| unreported | Review the configured permissions. |');
    expect(summary).toContain('Validated: true; truncated: false.');
    expect(summary.match(/^### .+$/gm)).toEqual([
      '### Result',
      '### Inputs',
      '### Issues',
      '### Safety',
      '### Workflow',
    ]);
  });
  it('always explains rejected/truncated input context and preserves all input names', () => {
    const inputs = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`input-${i}`, `value-${i}`]));
    const summary = renderActionSummary({
      title: 'Deploy',
      status: 'warning',
      inputContext: { inputs, inputsValidated: false, inputsTruncated: true },
    });
    for (const [name, value] of Object.entries(inputs)) expect(summary).toContain(`| ${name} | ${value} |`);
    expect(summary).toContain('Validated: false; truncated: true.');
    expect(summary).toContain('Input validation did not complete');
    expect(summary).toContain('Some input values were truncated');
  });
  it('masks forged authentication snapshots across title, facts, issues and links', () => {
    const secret = 'sensitive-marker';
    const summary = renderActionSummary({
      title: secret,
      status: 'failure',
      secrets: ['received-marker'],
      facts: [{ label: secret, value: `${secret} received-marker eyJheader.payload.signature` }],
      inputContext: {
        inputs: { 'client-secret': secret, resource: secret, branch: secret },
        inputsValidated: true,
        inputsTruncated: false,
      },
      issues: [{ code: secret, message: `failure: ${secret}` }],
      links: [{ label: secret, url: `https://github.example/${secret}/actions/runs/42` }],
    });
    expect(summary).not.toContain(secret);
    expect(summary).not.toContain('received-marker');
    expect(summary).not.toContain('eyJheader');
    expect(summary).toContain('| client-secret | \\[REDACTED\\] |');
    expect(summary).not.toContain('### Workflow');
  });
  it('escapes hostile Markdown, HTML, mentions and line breaks', () => {
    const unsafe = '<script>bad</script> | [link](javascript:bad) @team\n# forged';
    const summary = renderActionSummary({
      title: unsafe,
      status: 'success',
      facts: [{ label: unsafe, value: unsafe }],
    });
    expect(summary).not.toContain('<script>');
    expect(summary).not.toContain('@team');
    expect(summary).toContain('&lt;script&gt;');
    expect(summary).toContain('\\|');
    expect(summary).toContain('\\[link\\]');
    expect(summary).not.toContain('\n# forged');
  });
  it('redacts mixed-case encoded secrets and canonical webhook hostnames in facts and links', () => {
    const secret = 'Synthetic/Private+Value';
    const encoded = encodeURIComponent(secret).replace(/%[0-9A-F]{2}/g, (escape) => escape.toLowerCase());
    const url = 'https://' + 'hooks.slack.com./services/synthetic/private/value';
    const summary = renderActionSummary({
      title: 'Notify',
      status: 'failure',
      secrets: [secret],
      facts: [{ label: 'Detail', value: `${encoded} ${url}` }],
      links: [
        { label: 'Encoded secret', url: `https://example.test/${encoded}` },
        { label: 'Webhook', url },
      ],
    });
    expect(summary).not.toContain(encoded);
    expect(summary).not.toContain('/services/synthetic/private/value');
    expect(summary).not.toContain('### Workflow');
    expect(summary).toContain('REDACTED');
  });
  it('omits unsafe or confidential links while encoding parentheses once in safe enterprise links', () => {
    const url =
      'https://github.enterprise.example/org/repo/actions/runs/42?target=(one)(two)&nested=((three))&encoded=%28four%29';
    const summary = renderActionSummary({
      title: 'Build',
      status: 'success',
      links: [
        { label: 'Workflow', url },
        { label: 'Bad', url: 'javascript:alert(1)' },
        { label: 'Secret', url: 'https://example.test?token=private' },
      ],
    });
    expect(summary).toContain('?target=%28one%29%28two%29&nested=%28%28three%29%29&encoded=%28four%29');
    expect(summary).not.toContain('javascript:');
    expect(summary).not.toContain('token=private');
    for (const privateUrl of [
      'https://user:pass@example.test',
      'https://' + 'hooks.slack.com/services/a/b/c',
      'https://example.test/eyJheader.payload.signature',
      'https://example.test?access_token=opaque',
      'https://example.test?return=https%3A%2F%2Fuser%3Apass%40private.test',
      'https://example.test?value=eyJheader.payload.signature',
    ])
      expect(
        renderActionSummary({
          title: 'Build',
          status: 'success',
          links: [{ label: 'Unsafe', url: privateUrl }],
        }),
      ).not.toContain('### Workflow');
  });
  it('keeps result/decision rows and sections bounded, with explicit truncation', () => {
    const summary = renderActionSummary({
      title: 'Cleanup',
      status: 'warning',
      facts: Array.from({ length: 51 }, (_, n) => ({ label: `detail-${n}`, value: n })),
      sections: Array.from({ length: 9 }, (_, n) => ({
        title: `Section ${n}`,
        headers: Array.from({ length: 9 }, (_, i) => `Header ${i}`),
        rows: [Array.from({ length: 9 }, (_, i) => i)],
      })),
      links: Array.from({ length: 4 }, (_, n) => ({ label: `Run ${n}`, url: `https://example.test/${n}` })),
    });
    expect(summary).not.toContain('detail-50');
    expect(summary).not.toContain('### Section 8');
    expect(summary).not.toContain('Header 8');
    expect(summary).not.toContain('[Run 3]');
    expect(summary).toContain('Some details were omitted due to summary limits');
  });
  it('bounds long text after redaction and preserves complete multibyte rows under 64 KiB', () => {
    const summary = renderActionSummary({
      title: '✅'.repeat(201),
      status: 'success',
      description: 'safe'.repeat(1000),
      sections: [
        {
          title: 'Large',
          headers: ['A', 'B'],
          rows: Array.from({ length: 50 }, () => ['✅'.repeat(256), '✅'.repeat(256)]),
        },
      ],
    });
    expect(Buffer.byteLength(summary)).toBeLessThanOrEqual(65536);
    expect(summary).toContain('… \\[truncated\\]');
    expect(summary).toContain('Some details were omitted due to summary limits');
    expect(summary).not.toContain('\ufffd');
  });
});
