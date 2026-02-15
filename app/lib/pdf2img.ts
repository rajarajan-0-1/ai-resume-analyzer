export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

export async function convertPdfToImage(
  file: File
): Promise<PdfConversionResult> {
  try {
    // ✅ Prevent SSR crash
    if (typeof window === "undefined") {
      return {
        imageUrl: "",
        file: null,
        error: "Cannot run PDF conversion on server",
      };
    }

    // ✅ Correct dynamic import for pdfjs v4+
    const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

    // ✅ Load matching worker automatically
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 4 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return {
        imageUrl: "",
        file: null,
        error: "Canvas context not available",
      };
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png", 1.0)
    );

    if (!blob) {
      return {
        imageUrl: "",
        file: null,
        error: "Failed to create image blob",
      };
    }

    const originalName = file.name.replace(/\.pdf$/i, "");

    const imageFile = new File([blob], `${originalName}.png`, {
      type: "image/png",
    });

    return {
      imageUrl: URL.createObjectURL(blob),
      file: imageFile,
    };
  } catch (err: any) {
    console.error("PDF conversion error:", err);
    return {
      imageUrl: "",
      file: null,
      error: `Failed to convert PDF: ${err.message}`,
    };
  }
}