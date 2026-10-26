import Phaser from 'phaser';

/**
 * Уменьшенная копия текстуры под точный экранный размер. WebGL без мипмапов
 * при сильном уменьшении даёт рябь по контуру — поэтому уменьшаем заранее,
 * пополам за шаг, на canvas. Возвращает ключ новой текстуры.
 */
export function scaledTexture(scene: Phaser.Scene, key: string, scale: number): string {
  const dstKey = `${key}@${scale.toFixed(3)}`;
  if (scene.textures.exists(dstKey)) return dstKey;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const tw = Math.max(1, Math.round(src.width * scale));
  const th = Math.max(1, Math.round(src.height * scale));

  let cur: HTMLImageElement | HTMLCanvasElement = src;
  let cw = src.width;
  let ch = src.height;
  while (cw / 2 >= tw && ch / 2 >= th) {
    const c = document.createElement('canvas');
    c.width = Math.round(cw / 2);
    c.height = Math.round(ch / 2);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
    cw = c.width;
    ch = c.height;
  }
  const tex = scene.textures.createCanvas(dstKey, tw, th)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, tw, th);
  tex.refresh();
  return dstKey;
}

/** Картинка в нужном экранном масштабе: при уменьшении — из заранее уменьшенной копии. */
export function addScaledImage(scene: Phaser.Scene, x: number, y: number, key: string, scale: number) {
  return scale < 1
    ? scene.add.image(x, y, scaledTexture(scene, key, scale))
    : scene.add.image(x, y, key).setScale(scale);
}

/**
 * Плитка из обычных картинок вместо TileSprite: у TileSprite с текстурой не степени двойки
 * повтор считается в шейдере на каждый пиксель — на телефоне это заметно дороже обычного спрайта.
 * Текстура заранее уменьшается до нужного масштаба, крайние плитки обрезаются.
 */
export function addTiled(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  key: string,
  scale: number,
  depth = 0,
  tint?: number,
) {
  const tex = scaledTexture(scene, key, scale);
  const src = scene.textures.get(tex).getSourceImage();
  const tw = src.width;
  const th = src.height;
  const tiles: Phaser.GameObjects.Image[] = [];
  for (let ty = 0; ty < h; ty += th) {
    for (let tx = 0; tx < w; tx += tw) {
      const img = scene.add
        .image(x + tx, y + ty, tex)
        .setOrigin(0, 0)
        .setCrop(0, 0, Math.min(tw, w - tx), Math.min(th, h - ty))
        .setDepth(depth);
      if (tint !== undefined) img.setTint(tint);
      tiles.push(img);
    }
  }
  return tiles;
}
