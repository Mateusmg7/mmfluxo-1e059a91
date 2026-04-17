import { forwardRef } from 'react';
import { TooltipProps } from 'recharts';

interface PieTooltipProps extends TooltipProps<number, string> {
  fmt: (v: number) => string;
}

export const PieTooltip = forwardRef<HTMLDivElement, PieTooltipProps>(
  ({ active, payload, fmt }, ref) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    const color = (entry.payload as any)?.fill || entry.color || '#888';
    const name = entry.name || '';
    const value = entry.value ?? 0;
    const pct = (entry.payload as any)?.pct;

    return (
      <div
        ref={ref}
        className="rounded-lg px-3 py-2 text-xs font-medium shadow-2xl border border-white/20"
        style={{ backgroundColor: color, color: '#fff' }}
      >
        <p className="font-semibold text-sm">{name}{pct ? ` (${pct}%)` : ''}</p>
        <p className="text-white/90">{fmt(value)}</p>
      </div>
    );
  }
);
PieTooltip.displayName = 'PieTooltip';
