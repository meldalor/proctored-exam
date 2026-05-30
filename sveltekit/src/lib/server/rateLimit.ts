const attempts = new Map<string, { count: number; firstAt: number }>();
const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX = 10;

export function hitLimit(key: string, max = DEFAULT_MAX, windowMs = DEFAULT_WINDOW_MS): boolean {
	const now = Date.now();
	const a = attempts.get(key);
	if (a && now - a.firstAt < windowMs && a.count >= max) return true;
	if (!a || now - a.firstAt >= windowMs) attempts.set(key, { count: 1, firstAt: now });
	else a.count++;
	return false;
}

export function resetLimit(key: string): void {
	attempts.delete(key);
}
