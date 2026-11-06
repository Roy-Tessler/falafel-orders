const MAX_SIDE = 320;
const JPEG_QUALITY = 0.8;

function loadImage(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new TypeError('Not an image'));
		};
		img.src = url;
	});
}

export async function photoToDataUrl(file) {
	const img = await loadImage(file);
	const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(img.width * scale);
	canvas.height = Math.round(img.height * scale);
	canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
