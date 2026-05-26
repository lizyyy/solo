const COLORS = {
  bg: 'transparent',
  dropzoneBg: 'rgba(255,255,255,0.04)',
  dropzoneBorder: 'rgba(255,255,255,0.12)',
  dropzoneActive: 'rgba(244,200,106,0.18)',
  dropzoneActiveBorder: '#f4c86a',
  text: '#e6e9f2',
  muted: '#8a93a8',
  bookShadow: 'rgba(0,0,0,0.45)',
  slipBg: 'rgba(255,255,255,0.03)',
  slipBorder: 'rgba(255,255,255,0.1)',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBook(ctx, book, scale = 1, alpha = 1, highlight = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const { x, y, width, height, color, title, tag, isbn } = book;

  ctx.shadowColor = COLORS.bookShadow;
  ctx.shadowBlur = highlight ? 14 : 8;
  ctx.shadowOffsetY = highlight ? 6 : 3;

  roundRect(ctx, x, y, width * scale, height * scale, 8);
  const grad = ctx.createLinearGradient(x, y, x, y + height * scale);
  grad.addColorStop(0, lighten(color, 12));
  grad.addColorStop(1, darken(color, 18));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  roundRect(ctx, x, y, width * scale, height * scale, 8);
  ctx.strokeStyle = highlight ? '#fff' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = highlight ? 2 : 1;
  ctx.stroke();

  ctx.fillStyle = '#1a1200';
  ctx.fillRect(x, y, 20 * scale, height * scale);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(14 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(x + 10 * scale, y + height * scale / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(truncate(title, 10), 0, 0);
  ctx.restore();

  roundRect(ctx, x + width * scale - 24, y + 8, 18, 18, 4);
  ctx.fillStyle = darken(color, 30);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tag, x + width * scale - 15, y + 17);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(isbn, x + 26 * scale, y + height * scale - 8);

  if (book.damageNote) {
    ctx.fillStyle = '#ffb8b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(book.damageNote, x + 26 * scale, y + height * scale - 22);
  }
  if (book.reservedBy) {
    ctx.fillStyle = '#b8e0ff';
    ctx.font = '10px sans-serif';
    ctx.fillText(book.reservedBy, x + 26 * scale, y + height * scale - 22);
  }

  ctx.restore();
}

function drawDropzone(ctx, zone, active = false, hover = false) {
  const { x, y, width, height, label, kind, color } = zone;
  ctx.save();

  const bg = hover ? COLORS.dropzoneActive : COLORS.dropzoneBg;
  const border = hover ? COLORS.dropzoneActiveBorder : COLORS.dropzoneBorder;

  roundRect(ctx, x, y, width, height, 10);
  ctx.fillStyle = bg;
  ctx.fill();

  roundRect(ctx, x, y, width, height, 10);
  ctx.strokeStyle = active ? color : border;
  ctx.lineWidth = active ? 2 : 1;
  ctx.setLineDash(active ? [] : [6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = color;
  roundRect(ctx, x + 12, y + 12, 10, 10, 3);
  ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 30, y + 10);

  if (zone.subLabel) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px sans-serif';
    ctx.fillText(zone.subLabel, x + 30, y + 28);
  }

  ctx.restore();
}

function drawShelf(ctx, shelf, active = false, hover = false) {
  const { x, y, width, height, label, isbnPrefix } = shelf;
  ctx.save();

  const bg = hover ? 'rgba(123,216,143,0.12)' : COLORS.dropzoneBg;
  const border = hover ? '#7bd88f' : COLORS.dropzoneBorder;

  roundRect(ctx, x, y, width, height, 10);
  ctx.fillStyle = bg;
  ctx.fill();

  roundRect(ctx, x, y, width, height, 10);
  ctx.strokeStyle = active ? '#7bd88f' : border;
  ctx.lineWidth = active ? 2 : 1;
  ctx.stroke();

  ctx.fillStyle = '#7bd88f';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 14, y + 10);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '11px monospace';
  ctx.fillText(isbnPrefix, x + 14, y + 36);

  ctx.restore();
}

function drawReturnSlip(ctx, slip, hover = false, matched = false) {
  const { x, y, width, height } = slip;
  ctx.save();

  const bg = hover ? 'rgba(244,200,106,0.15)' : COLORS.slipBg;
  const border = matched ? '#7bd88f' : hover ? '#f4c86a' : COLORS.slipBorder;

  roundRect(ctx, x, y, width, height, 8);
  ctx.fillStyle = bg;
  ctx.fill();

  roundRect(ctx, x, y, width, height, 8);
  ctx.strokeStyle = border;
  ctx.lineWidth = matched ? 2 : 1;
  ctx.stroke();

  ctx.fillStyle = matched ? '#7bd88f' : '#f4c86a';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(slip.id, x + 10, y + 8);

  ctx.fillStyle = COLORS.text;
  ctx.font = '12px sans-serif';
  ctx.fillText(truncate(slip.title, 8), x + 10, y + 26);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '10px monospace';
  ctx.fillText(slip.isbn, x + 10, y + 42);
  ctx.fillText(`${slip.date} · ${slip.customer}`, x + 10, y + 56);

  if (matched) {
    ctx.fillStyle = '#7bd88f';
    ctx.font = '10px sans-serif';
    ctx.fillText('✓ 已匹配', x + width - 60, y + 8);
  }

  ctx.restore();
}

function lighten(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (n >> 16) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function darken(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `rgb(${r},${g},${b})`;
}

function truncate(str, maxLen) {
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…';
}

export const Renderer = {
  COLORS,
  roundRect,
  drawBook,
  drawDropzone,
  drawShelf,
  drawReturnSlip,
  lighten,
  darken,
  truncate,
};
