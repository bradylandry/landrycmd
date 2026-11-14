import { z } from "astro/zod";

// Shared with the publish route's tests. Astro reads an unquoted YAML date as
// a Date, which is what this schema requires.
export const notesSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});
