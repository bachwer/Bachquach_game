/* Toast Notification System */

const Toast = (() => {
	const DURATION = 4000;
	const MAX_TOASTS = 3;
	let toastCount = 0;

	function show(message, type = 'info') {
		const container = document.getElementById('toast-container');
		if (!container) return;

		if (toastCount >= MAX_TOASTS) {
			const firstToast = container.querySelector('.toast');
			if (firstToast) {
				dismiss(firstToast);
			}
		}

		const toast = document.createElement('div');
		toast.className = `toast ${type}`;

		const iconMap = {
			success: 'fa-circle-check',
			error: 'fa-circle-exclamation',
			info: 'fa-circle-info',
			warning: 'fa-triangle-exclamation',
		};

		const icon = iconMap[type] || iconMap.info;
		toast.innerHTML = `
			<i class="fa-solid ${icon}"></i>
			<span>${message}</span>
		`;

		container.appendChild(toast);
		toastCount += 1;

		if (window.anime) {
			window.anime({
				targets: toast,
				translateX: [350, 0],
				opacity: [0, 1],
				duration: 300,
				easing: 'easeOutQuad',
			});
		}

		const timer = setTimeout(() => {
			dismiss(toast);
		}, DURATION);

		toast.addEventListener('click', () => {
			clearTimeout(timer);
			dismiss(toast);
		});

		return toast;
	}

	function dismiss(toast) {
		if (!toast || !toast.parentElement) return;

		if (window.anime) {
			window.anime({
				targets: toast,
				translateX: 350,
				opacity: 0,
				duration: 300,
				easing: 'easeInQuad',
				complete: () => {
					toast.remove();
					toastCount -= 1;
				},
			});
		} else {
			toast.remove();
			toastCount -= 1;
		}
	}

	return { show };
})();

window.Toast = Toast;
