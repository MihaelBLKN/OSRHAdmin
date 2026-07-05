import type { z } from "zod";

import type {
  exampleRecordInputSchema,
  exampleRecordSchema,
  exampleRecordUpdateInputSchema,
} from "./schemas";

export type ExampleRecord = z.infer<typeof exampleRecordSchema>;
export type ExampleRecordInput = z.input<typeof exampleRecordInputSchema>;
export type ExampleRecordUpdateInput = z.input<typeof exampleRecordUpdateInputSchema>;
