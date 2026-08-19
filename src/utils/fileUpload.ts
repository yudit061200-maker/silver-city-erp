export const processFileUpload = (
  file: File,
  onSuccess: (result: string, name: string) => void,
  onError?: (err: string) => void
) => {
  if (file.size > 8 * 1024 * 1024) {
    const msg = 'Ukuran file terlalu besar (maksimal 8MB). Silakan pilih file yang lebih kecil.';
    if (onError) onError(msg);
    else alert(msg);
    return;
  }

  // If it's an image, compress/resize it using Canvas for compact base64 storage
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (!src) return;

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200; // max dimension 1200px for optimal memory
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedData = canvas.toDataURL('image/jpeg', 0.75);
            onSuccess(compressedData, file.name);
            return;
          }
        } catch {
          // fallback to raw base64 if canvas operation fails
        }
        onSuccess(src, file.name);
      };
      img.onerror = () => {
        onSuccess(src, file.name);
      };
      img.src = src;
    };
    reader.onerror = () => {
      const msg = 'Gagal membaca file. Silakan coba lagi.';
      if (onError) onError(msg);
      else alert(msg);
    };
    reader.readAsDataURL(file);
    return;
  }

  // For non-image documents (PDF, Word, Excel, ZIP, etc.)
  const reader = new FileReader();
  reader.onload = (ev) => {
    const result = ev.target?.result as string;
    if (result) {
      onSuccess(result, file.name);
    }
  };
  reader.onerror = () => {
    const msg = 'Gagal membaca file. Silakan coba lagi.';
    if (onError) onError(msg);
    else alert(msg);
  };
  reader.readAsDataURL(file);
};

