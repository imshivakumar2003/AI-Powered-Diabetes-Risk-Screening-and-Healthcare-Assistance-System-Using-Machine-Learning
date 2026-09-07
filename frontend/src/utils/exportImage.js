/**
 * Serializes an SVG DOM element and rasterizes it to a PNG for download.
 * Used for "Image Export" of chart elements (e.g. the risk gauge).
 */
export function exportSvgAsPng(svgElement, filename = "chart.png", scale = 2) {
  return new Promise((resolve, reject) => {
    if (!svgElement) {
      reject(new Error("No chart element to export."));
      return;
    }

    // A standalone SVG blob has no access to the page's CSS custom
    // properties, so var(--teal) etc. would render as black. Resolve every
    // element's actual computed stroke/fill and bake it into a clone first.
    const clone = svgElement.cloneNode(true);
    const originalEls = svgElement.querySelectorAll("*");
    const cloneEls = clone.querySelectorAll("*");
    originalEls.forEach((el, i) => {
      const computed = window.getComputedStyle(el);
      if (cloneEls[i]) {
        cloneEls[i].style.stroke = computed.stroke;
        cloneEls[i].style.fill = computed.fill;
      }
    });
    clone.style.stroke = window.getComputedStyle(svgElement).stroke;
    clone.style.fill = window.getComputedStyle(svgElement).fill;
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }

    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const width = svgElement.viewBox?.baseVal?.width || svgElement.clientWidth || 300;
      const height = svgElement.viewBox?.baseVal?.height || svgElement.clientHeight || 200;

      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not generate image."));
          return;
        }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load chart for export."));
    };
    img.src = url;
  });
}
