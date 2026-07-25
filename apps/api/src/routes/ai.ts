import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import { aiGateway } from '../services/ai-gateway.js';

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

aiRouter.post('/chat', zValidator('json', chatSchema), async (c) => {
  const data = c.req.valid('json');

  if (data.stream) {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, payload: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        };

        try {
          for await (const { event, data: payload } of aiGateway.streamChat({
            ...data,
            stream: true,
            skipCache: true,
          })) {
            send(event, payload);
          }
        } catch (err) {
          send('error', {
            code: 'GATEWAY_ERROR',
            message: err instanceof Error ? err.message : 'AI Gateway error',
            recoverable: false,
          });
        }

        controller.close();
      },
    });

    return c.newResponse(stream);
  }

  try {
    const result = await aiGateway.chat(data);
    return c.json({
      requestId: result.meta.requestId,
      model: result.meta.model,
      provider: result.meta.provider,
      tier: result.meta.tier,
      content: result.content,
      usage: result.usage,
      latencyMs: result.latencyMs,
      cached: result.meta.cached,
    });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'AI Gateway error' },
      502,
    );
  }
});

aiRouter.post('/generate', zValidator('json', generateSchema), async (c) => {
  const data = c.req.valid('json');

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('X-Accel-Buffering', 'no');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      };

      try {
        for await (const { event, data: payload } of aiGateway.streamChat({
          model: data.model,
          messages: data.messages,
          stream: true,
          skipCache: true,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
        })) {
          send(event, payload);
        }

        const files = data.files ?? [
          { path: 'src/api/users.ts', content: 'export async function getUsers() { ... }' },
          { path: 'src/components/UserList.tsx', content: 'export function UserList() { ... }' },
        ];

        for (const file of files) {
          send('diff', {
            path: file.path,
            type: 'edit',
            patch: `@@ -0,0 +1,3 @@\n+${file.content.replace(/\n/g, '\\n')}`,
          });
        }

        send('progress', { percentage: 100, message: 'Generation complete' });
      } catch (err) {
        send('error', {
          code: 'GENERATION_ERROR',
          message: err instanceof Error ? err.message : 'Generation failed',
          recoverable: true,
        });
      }

      controller.close();
    },
  });

  return c.newResponse(stream);
});

aiRouter.get('/models', (c) => {
  return c.json({ models: aiGateway.getModels() });
});

aiRouter.get('/gateway/providers', (c) => {
  return c.json({ providers: aiGateway.getProviderStatus() });
});

aiRouter.get('/gateway/usage', (c) => {
  return c.json(aiGateway.getUsageStats());
});
