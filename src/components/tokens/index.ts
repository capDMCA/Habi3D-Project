// The single source of colour, type, and typeface for the whole app —
// split by concern across this directory (colors / type / spacing / marks),
// re-exported here so every screen and component can import from one path:
// `import { color, radius } from '../components/tokens'`.
//
// `index.css`'s `:root` custom properties (`--text-primary`, `--success`,
// `--radius`, `--space-sm`, etc.) are a byte-for-byte CSS mirror of the
// colour and spacing values — see colors.ts's top comment for the full
// reasoning. Change a value here first, then carry it into `index.css`'s
// `:root` block by hand; nothing auto-syncs the two.
export * from './colors';
export * from './type';
export * from './spacing';
export * from './marks';
