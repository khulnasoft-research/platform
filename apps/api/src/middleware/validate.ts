import { zValidator as honoZValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';

export function zValidator(
  target: 'json' | 'query' | 'param',
  schema: ZodSchema,
) {
  return honoZValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        400,
      );
    }
  });
}
