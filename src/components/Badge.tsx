interface BadgeProps {
  label: string;
  color?: string;
  variant?: 'default' | 'outline';
}

export default function Badge({ label, color = '#337da8', variant = 'default' }: BadgeProps) {
  if (variant === 'outline') {
    return (
      <span
        className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium border-2 whitespace-nowrap"
        style={{ borderColor: color, color }}
      >
        {label}
      </span>
    );
  }
  // MD3 tonal chip: 10% opacity background with text matching color
  return (
    <span
      className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{
        backgroundColor: color + '22',
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </span>
  );
}
