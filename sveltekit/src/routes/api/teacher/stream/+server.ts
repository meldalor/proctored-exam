import type { RequestHandler } from './$types';
import { requireTeacher } from '$lib/server/guard';
import { addClient, removeClient } from '$lib/server/sse';

export const GET: RequestHandler = ({ locals }) => {
	requireTeacher(locals);
	const encoder = new TextEncoder();
	let controllerRef: ReadableStreamDefaultController<Uint8Array>;
	let ping: ReturnType<typeof setInterval>;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controllerRef = controller;
			addClient(controller);
			controller.enqueue(encoder.encode(':\n\n'));
			ping = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(':\n\n'));
				} catch {
					clearInterval(ping);
				}
			}, 25000);
		},
		cancel() {
			clearInterval(ping);
			removeClient(controllerRef);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
