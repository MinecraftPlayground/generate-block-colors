import type { VariantValue } from './variant_value.ts';

export function firstModel(value : VariantValue): string | undefined {
  const variant = Array.isArray(value) ? value[0] : value;
  return variant?.model;
}
