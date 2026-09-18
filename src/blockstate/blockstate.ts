import type { MultipartCase } from './multipart_case.ts';
import type { VariantValue } from './variant_value.ts';

export interface Blockstate {
  variants? : Record<string, VariantValue>;
  multipart? : MultipartCase[];
}
