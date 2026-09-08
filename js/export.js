/* LuvGallery — export a month to PNG / PDF */
window.LuvExport = (() => {
  async function buildStage(entries, title, subtitle) {
    const stage = document.getElementById('export-stage');
    stage.innerHTML = '';
    const page = document.createElement('div');
    page.className = 'export-page';
    const urls = [];

    let bodyHtml = `<h1 class="ep-title">${title}</h1><p class="ep-sub">${subtitle}</p>`;
    entries.forEach((entry) => {
      const d = new Date(entry.dateTime);
      const time = LuvApp.formatTime(d);
      const weekday = LuvApp.formatWeekday(d);
      const day = LuvApp.formatDay(d);
      const photosHtml = (entry.images || []).filter((img) => img.blob).slice(0, 4).map((img) => {
        const url = URL.createObjectURL(img.blob);
        urls.push(url);
        return `<img src="${url}" alt="" />`;
      }).join('');
      bodyHtml += `
        <div class="export-entry">
          <div class="ep-photos">${photosHtml}</div>
          <div class="ep-body">
            <div class="ep-time">${time} &middot; ${weekday} ${day}</div>
            <div class="ep-note">${LuvApp.escapeHtml(entry.note || '')}</div>
          </div>
        </div>`;
    });
    page.innerHTML = bodyHtml;
    stage.appendChild(page);

    await Promise.all(Array.from(page.querySelectorAll('img')).map((img) => (
      img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; })
    )));
    return { page, urls };
  }

  function download(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function canvasToPdf(canvas, filename) {
    const { jsPDF } = window.jspdf;
    const pageWidth = canvas.width;
    const pageHeight = Math.round(pageWidth * 1.4142); // A4 aspect ratio

    const slices = [];
    let y = 0;
    while (y < canvas.height) {
      const h = Math.min(pageHeight, canvas.height - y);
      slices.push({ y, h });
      y += h;
    }
    if (!slices.length) return;

    let pdf = null;
    slices.forEach((slice, i) => {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = pageWidth;
      sliceCanvas.height = slice.h;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, slice.y, pageWidth, slice.h, 0, 0, pageWidth, slice.h);
      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);

      if (i === 0) {
        pdf = new jsPDF({ unit: 'px', format: [pageWidth, slice.h], hotfixes: ['px_scaling'] });
      } else {
        pdf.addPage([pageWidth, slice.h]);
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, slice.h);
    });
    pdf.save(filename);
  }

  async function exportMonth(monthKey, type) {
    const entries = LuvApp.state.entries
      .filter((e) => LuvApp.monthKey(new Date(e.dateTime)) === monthKey)
      .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    if (!entries.length) return;

    const { page, urls } = await buildStage(entries, 'LuvGallery', LuvApp.monthLabel(monthKey));
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-alt').trim() || '#ffffff';

    try {
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: bg, useCORS: true });
      if (type === 'png') {
        download(canvas.toDataURL('image/png'), `LuvGallery-${monthKey}.png`);
      } else {
        await canvasToPdf(canvas, `LuvGallery-${monthKey}.pdf`);
      }
    } finally {
      urls.forEach((u) => URL.revokeObjectURL(u));
      document.getElementById('export-stage').innerHTML = '';
    }
  }

  return { exportMonth };
})();
