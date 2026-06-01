<script lang="ts">
	let username = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function login() {
		if (!password) return;
		loading = true;
		error = '';
		try {
			const r = await fetch('/api/auth/teacher', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: username.trim() || 'admin', password })
			});
			const data = await r.json();
			if (!r.ok) {
				error = data.error || 'Неверный пароль';
				loading = false;
				return;
			}
			window.location.href = data.role === 'admin' ? '/teacher/admin' : '/teacher';
		} catch {
			error = 'Ошибка соединения';
			loading = false;
		}
	}
</script>

<div class="login-wrapper">
	<div class="login-card card">
		<h1>Панель преподавателя</h1>
		<p class="login-subtitle">// система контроля экзаменов</p>

		{#if error}<div class="alert alert-error">{error}</div>{/if}

		<div class="form-group">
			<label for="usr">Логин</label>
			<input
				id="usr"
				type="text"
				autocomplete="username"
				bind:value={username}
				onkeydown={(e) => {
					if (e.key === 'Enter') login();
				}}
				placeholder="Имя пользователя"
				disabled={loading}
			/>
		</div>

		<div class="form-group">
			<label for="pwd">Пароль</label>
			<input
				id="pwd"
				type="password"
				autocomplete="current-password"
				bind:value={password}
				onkeydown={(e) => {
					if (e.key === 'Enter') login();
				}}
				placeholder="••••••••"
				disabled={loading}
			/>
		</div>

		<button class="btn btn-primary w-full" onclick={login} disabled={loading || !password}>
			{loading ? 'Проверка…' : 'Войти'}
		</button>

		<div class="mt-4 text-center">
			<a href="/" class="text-sm text-muted">← Вход для студентов</a>
		</div>
	</div>
</div>
