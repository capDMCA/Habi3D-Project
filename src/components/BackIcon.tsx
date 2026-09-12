import type { CSSProperties } from 'react';

interface BackIconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}

export function BackIcon({
  size = 20,
  color = 'currentColor',
  style,
  className,
}: BackIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', ...style }}
      className={className}
      aria-hidden="true"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export default BackIcon;
