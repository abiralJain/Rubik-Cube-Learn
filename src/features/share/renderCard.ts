/** Compose a 1080×1350 share card: the live cube canvas framed on the app ground with the solve stats. */
export async function renderCard(cubeCanvas: HTMLCanvasElement, stats: { ms: number; moves: number }): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  // ground + soft glow blobs
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  const blobs: Array<[string, number, number]> = [['#FFD54A', 180, 220], ['#F0574A', 900, 260], ['#3E7BE0', 860, 1000], ['#3DBE72', 160, 980], ['#FF9440', 540, 1250]];
  for (const [col, x, y] of blobs) {
    const rg = g.createRadialGradient(x, y, 0, x, y, 520);
    rg.addColorStop(0, col + '44'); rg.addColorStop(1, col + '00');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
  // cube
  const size = 820;
  const cw = cubeCanvas.width, ch = cubeCanvas.height;
  const s = Math.min(cw, ch);
  g.drawImage(cubeCanvas, (cw - s) / 2, (ch - s) / 2, s, s, (W - size) / 2, 150, size, size);
  // copy
  g.fillStyle = '#1B1830'; g.textAlign = 'center';
  g.font = '600 88px "Fredoka Variable", system-ui, sans-serif';
  g.fillText('I solved it!', W / 2, 1075);
  g.font = '600 40px "Nunito Variable", system-ui, sans-serif'; g.fillStyle = 'rgba(27,24,48,.62)';
  const mm = Math.floor(stats.ms / 60000), ss = Math.floor((stats.ms % 60000) / 1000);
  g.fillText(`${mm} min ${ss} sec  ·  ${stats.moves} turns  ·  beginner's method`, W / 2, 1140);
  g.font = '600 30px "Fredoka Variable", system-ui, sans-serif'; g.fillStyle = 'rgba(27,24,48,.35)';
  g.fillText('Cube', W / 2, 1270);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

export async function shareBlob(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text }); return 'shared'; } catch { /* cancelled */ }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
