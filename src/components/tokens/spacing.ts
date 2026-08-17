// `index.css`'s `:root` custom properties (`--space-sm`, `--radius`, etc.)
// are a byte-for-byte CSS mirror of both values below — see colors.ts's
// top comment for why the mirror exists and how to keep it in sync.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
