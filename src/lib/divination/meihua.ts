import {
  calculateMeihua,
  toMeihuaJson,
  toMeihuaText,
  type MeihuaCanonicalJSON,
  type MeihuaInput,
  type MeihuaOutput,
} from 'taibu-core/meihua';

export type { MeihuaCanonicalJSON, MeihuaInput, MeihuaOutput };

export const WEB_MEIHUA_METHODS = ['time', 'text_split', 'number_pair', 'number_triplet'] as const;
export type WebMeihuaMethod = typeof WEB_MEIHUA_METHODS[number];

export type MeihuaWebBundle = {
  input: MeihuaInput;
  result: MeihuaOutput;
  canonicalJson: MeihuaCanonicalJSON;
  canonicalText: string;
};

export function isWebMeihuaMethod(value: unknown): value is WebMeihuaMethod {
  return typeof value === 'string' && WEB_MEIHUA_METHODS.includes(value as WebMeihuaMethod);
}

export function calculateMeihuaBundle(input: MeihuaInput): MeihuaWebBundle {
  if (!isWebMeihuaMethod(input.method ?? 'time')) {
    throw new Error('网页版暂不支持该梅花起卦方式');
  }
  const result = calculateMeihua(input);
  return {
    input,
    result,
    canonicalJson: toMeihuaJson(result, { detailLevel: 'full' }),
    canonicalText: toMeihuaText(result, { detailLevel: 'full' }),
  };
}

export function buildMeihuaCanonicalJson(result: MeihuaOutput): MeihuaCanonicalJSON {
  return toMeihuaJson(result, { detailLevel: 'full' });
}

export function buildMeihuaCanonicalText(result: MeihuaOutput): string {
  return toMeihuaText(result, { detailLevel: 'full' });
}
