export const SRC_FILE = 'src/lib/decompose.ts';

export const SRC = {
  lu_pivot: 81,
  lu_eliminate: 99,
  qr_norm: 129,
  qr_vnormalize: 151,
  chol_diag: 180,
  chol_sqrt: 196,
  chol_offdiag: 200,
} as const;

export type SrcKey = keyof typeof SRC;
