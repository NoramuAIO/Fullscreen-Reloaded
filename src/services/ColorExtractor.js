/**
 * Extracts dominant and accent colors from album artwork using canvas quantization.
 */

export const ColorExtractor = {
  cache: new Map(),
  MAX_CACHE: 30,

  async extract(imageUrl) {
    if (!imageUrl) return this.fallback();
    if (this.cache.has(imageUrl)) return this.cache.get(imageUrl);

    try {
      const img = await this.loadImage(imageUrl);
      const result = this.quantize(img);
      if (this.cache.size >= this.MAX_CACHE) {
        this.cache.delete(this.cache.keys().next().value);
      }
      this.cache.set(imageUrl, result);
      return result;
    } catch (e) {
      return this.fallback();
    }
  },

  fallback() {
    return { dominant: [16, 16, 20], accent: [255, 255, 255], dark: [8, 8, 10] };
  },

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  },

  quantize(img) {
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return this.fallback();

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      if (a < 128) continue;
      const key = [r >> 4, g >> 4, b >> 4].join(",");
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
      buckets.set(key, bucket);
    }

    const colors = [...buckets.values()]
      .map((b) => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n }))
      .sort((a, b) => b.n - a.n);

    if (!colors.length) return this.fallback();

    const dominant = colors[0];
    const bySaturation = [...colors].sort((a, b) => this.saturation(b) - this.saturation(a));
    const rawAccent = bySaturation[0] || dominant;
    const accent = this.ensureLegible(rawAccent);

    return {
      dominant: [dominant.r, dominant.g, dominant.b],
      accent: accent,
      dark: this.darken(dominant, 0.35),
    };
  },

  ensureLegible(c) {
    if (!c) return [255, 255, 255];
    let r = c.r !== undefined ? c.r : c[0];
    let g = c.g !== undefined ? c.g : c[1];
    let b = c.b !== undefined ? c.b : c[2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 165) {
      const boost = Math.max(1.6, 175 / Math.max(lum, 1));
      r = Math.min(255, Math.round(r * boost + 50));
      g = Math.min(255, Math.round(g * boost + 50));
      b = Math.min(255, Math.round(b * boost + 50));
    }
    return [r, g, b];
  },

  saturation(c) {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    return max === 0 ? 0 : (max - min) / max;
  },

  darken(c, factor) {
    return [c.r * factor, c.g * factor, c.b * factor];
  },
};
