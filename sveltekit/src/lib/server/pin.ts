import crypto from 'node:crypto';

export function randomPin(): string {
	return String(crypto.randomInt(100000, 1000000));
}
