const TIER_ICON_COLOR_CLASS: Record<string, string> = {
    blue: 'text-blue-500',
    amber: 'text-amber-500',
};

export function getTierIconColorClass(color: string): string {
    return TIER_ICON_COLOR_CLASS[color] ?? 'text-blue-500';
}
