type Controller = ReadableStreamDefaultController<Uint8Array>;

const clients = new Set<Controller>();
const encoder = new TextEncoder();

export function addClient(c: Controller): void {
	clients.add(c);
}

export function removeClient(c: Controller): void {
	clients.delete(c);
}

export function closeAllClients(): void {
	for (const c of clients) {
		try {
			c.close();
		} catch {
			// стрим уже закрыт
		}
	}
	clients.clear();
}

export function broadcast(event: string, data: unknown): void {
	const chunk = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
	for (const c of clients) {
		try {
			c.enqueue(chunk);
		} catch {
			clients.delete(c);
		}
	}
}
