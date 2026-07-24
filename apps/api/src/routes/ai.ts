import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';

export const aiRouter = new Hono();

const chatSchema = z.object({
  model: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    }),
  ),
  stream: z.boolean().default(true),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
});

const generateSchema = chatSchema.extend({
  projectId: z.string().uuid(),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
});

// POST /ai/chat
aiRouter.post('/chat', zValidator('json', chatSchema), async (c) => {
  const data = c.req.valid('json');
  const model = data.model || 'claude-sonnet-4';

  if (data.stream) {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        send('meta', {
          requestId: crypto.randomUUID(),
          model,
          provider: 'anthropic',
          startedAt: new Date().toISOString(),
        });

        // Simulate streaming for Phase 1
        const responseChunks = [
          'Here is a sample response from the AI.',
          ' This demonstrates the streaming protocol.',
          '\n\n```typescript\nconst greeting = "Hello, World!";\n```',
        ];

        for (const [i, chunk] of responseChunks.entries()) {
          await new Promise((r) => setTimeout(r, 50));
          send('token', { content: chunk, index: i, type: i === 2 ? 'code' : 'text' });
        }

        send('finish', {
          stopReason: 'stop',
          usage: { inputTokens: 150, outputTokens: 42 },
          requestId: crypto.randomUUID(),
          latencyMs: 1500,
        });

        controller.close();
      },
    });

    return c.newResponse(stream);
  }

  return c.json({
    requestId: crypto.randomUUID(),
    model,
    content: 'Synchronous response for non-streaming request.',
    usage: { inputTokens: 150, outputTokens: 30 },
  });
});

// POST /ai/generate
aiRouter.post('/generate', zValidator('json', generateSchema), async (c) => {
  const data = c.req.valid('json');

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('X-Accel-Buffering', 'no');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send('meta', {
        requestId: crypto.randomUUID(),
        model: data.model || 'claude-sonnet-4',
        provider: 'anthropic',
        startedAt: new Date().toISOString(),
      });

      const files = [
        { path: 'src/api/users.ts', content: 'export async function getUsers() { ... }' },
        { path: 'src/components/UserList.tsx', content: 'export function UserList() { ... }' },
      ];

      for (const file of files) {
        send('diff', {
          path: file.path,
          type: 'edit',
          patch: `@@ -0,0 +1,3 @@\n+${file.content.replace(/\n/g, '\\n')}`,
        });
        await new Promise((r) => setTimeout(r, 100));
      }

      send('progress', { percentage: 100, message: 'Generation complete' });

      send('finish', {
        stopReason: 'stop',
        usage: { inputTokens: 500, outputTokens: 200 },
        requestId: crypto.randomUUID(),
        latencyMs: 2500,
      });

      controller.close();
    },
  });

  return c.newResponse(stream);
});

// GET /ai/models
aiRouter.get('/models', (c) => {
  return c.json({
    models: [
      {
        id: 'claude-sonnet-4',
        provider: 'anthropic',
        name: 'Claude Sonnet 4',
        tier: 'balanced',
        features: ['chat', 'streaming', 'vision', 'tools', 'structured-output'],
      },
      {
        id: 'gpt-4o',
        provider: 'openai',
        name: 'GPT-4o',
        tier: 'balanced',
        features: ['chat', 'streaming', 'vision', 'tools', 'structured-output'],
      },
      {
        id: 'gpt-4o-mini',
        provider: 'openai',
        name: 'GPT-4o Mini',
        tier: 'fast',
        features: ['chat', 'streaming'],
      },
    ],
  });
});
