import { defineCollection, z } from "astro:content";
import { notesSchema } from "../lib/notes-schema";

const writing = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

const notes = defineCollection({
  type: "content",
  schema: notesSchema,
});

export const collections = { writing, notes };
