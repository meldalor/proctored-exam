export type StartReason = 'insecure' | 'denied' | 'not_monitor';

export interface StartResult {
	ok: boolean;
	reason?: StartReason;
}

const INTERVAL_MS = 10_000;
const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.6;

/**
 * Периодические скриншоты экрана студента из потока getDisplayMedia().
 * Требует secure context (HTTPS/localhost) и шаринга всего монитора.
 */
export class ScreenCapture {
	onStopped?: () => void;

	private stream?: MediaStream;
	private video?: HTMLVideoElement;
	private canvas?: HTMLCanvasElement;
	private timer?: ReturnType<typeof setInterval>;
	private active = false;

	async start(intervalMs: number = INTERVAL_MS): Promise<StartResult> {
		const md = navigator.mediaDevices;
		// По http navigator.mediaDevices отсутствует — захват экрана недоступен.
		if (!md?.getDisplayMedia) return { ok: false, reason: 'insecure' };

		let stream: MediaStream;
		try {
			stream = await md.getDisplayMedia({
				video: { displaySurface: 'monitor' } as MediaTrackConstraints,
				audio: false
			});
		} catch {
			return { ok: false, reason: 'denied' };
		}

		const track = stream.getVideoTracks()[0];
		const surface = (track?.getSettings() as MediaTrackSettings & { displaySurface?: string })
			?.displaySurface;
		// Требуем весь монитор: окно/вкладка не подходят.
		if (surface && surface !== 'monitor') {
			stream.getTracks().forEach((t) => t.stop());
			return { ok: false, reason: 'not_monitor' };
		}

		this.stream = stream;
		const video = document.createElement('video');
		video.muted = true;
		video.autoplay = true;
		video.playsInline = true;
		video.srcObject = stream;
		video.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
		document.body.appendChild(video);
		try {
			await video.play();
		} catch {
			// autoplay muted обычно разрешён; кадр всё равно снимется, когда появятся данные.
		}
		this.video = video;
		this.canvas = document.createElement('canvas');
		this.active = true;

		if (track) track.onended = () => this.handleEnded();

		void this.shoot();
		this.timer = setInterval(() => void this.shoot(), Math.max(1000, intervalMs));
		return { ok: true };
	}

	private handleEnded(): void {
		if (!this.active) return;
		this.stop();
		this.onStopped?.();
	}

	private async shoot(): Promise<void> {
		const video = this.video;
		const canvas = this.canvas;
		if (!this.active || !video || !canvas) return;
		const vw = video.videoWidth;
		const vh = video.videoHeight;
		if (!vw || !vh) return;
		const scale = Math.min(1, MAX_WIDTH / vw);
		canvas.width = Math.round(vw * scale);
		canvas.height = Math.round(vh * scale);
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
		);
		if (!blob) return;
		try {
			await fetch('/api/exam/screenshot?ts=' + Date.now(), {
				method: 'POST',
				headers: { 'Content-Type': 'image/jpeg' },
				body: blob
			});
		} catch {
			// пропускаем — попробуем на следующем тике
		}
	}

	stop(): void {
		this.active = false;
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = undefined;
		if (this.video) {
			this.video.srcObject = null;
			this.video.remove();
			this.video = undefined;
		}
		this.canvas = undefined;
	}
}
