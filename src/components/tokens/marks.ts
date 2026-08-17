import { color } from './colors';

/**
 * Plan mark treatments. The draggable block and the ghost target share the
 * accent hue but read as two different things: the block is a SOLID fill with a
 * thick stroke ("this object"), the ghost is a HOLLOW dashed outline ("put it
 * here"). That distinction survives a small screen in daylight because it's a
 * shape/fill difference, not only a colour one.
 */
export const planMark = {
  room: { fill: color.surface, stroke: color.roomStroke, strokeWidth: 4 },
  item: { fill: color.itemFill, stroke: color.itemStroke, strokeWidth: 3 },
  draggable: { fill: color.accentFill, stroke: color.accent, strokeWidth: 5, dash: undefined as string | undefined },
  ghost: { fill: 'none', stroke: color.accent, strokeWidth: 3, dash: '10 8' },
  infeasible: { fill: color.attentionBg, stroke: color.attentionFg, strokeWidth: 5, dash: undefined as string | undefined },
} as const;
