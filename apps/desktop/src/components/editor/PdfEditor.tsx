import { useEffect, useRef, useState } from "react";
import { Circle, Highlighter, MousePointer2, Pencil, Save, Trash2, Type, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as API from "../../Api";
import ConfirmModal from "../common/ConfirmModal";
import type { FormatEditorProps } from "./editor.types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Point = { x: number; y: number };
type PdfPageInfo = {
  pageNumber: number;
  width: number;
  height: number;
};
type PdfStrokeAnnotation = {
  id: string;
  type: "stroke";
  page: number;
  pageWidth?: number;
  pageHeight?: number;
  points: Point[];
  color: string;
  size: number;
};
type PdfHighlightAnnotation = {
  id: string;
  type: "highlight";
  page: number;
  pageWidth?: number;
  pageHeight?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};
type PdfTextAnnotation = {
  id: string;
  type: "text";
  page: number;
  pageWidth?: number;
  pageHeight?: number;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};
type PdfAnnotation = PdfStrokeAnnotation | PdfHighlightAnnotation | PdfTextAnnotation;
type Tool = "select" | "pen" | "highlight" | "text";
type TextDraft = {
  page: number;
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  screenLeft: number;
  screenTop: number;
  value: string;
  color: string;
  fontSize: number;
  editingId?: string;
};
type DragState = {
  id: string;
  start: Point;
  original: PdfAnnotation;
};

const COLORS = ["#2563eb", "#111827", "#ef4444", "#f59e0b", "#10b981"];
const HIGHLIGHT_COLORS = ["#fde047", "#86efac", "#93c5fd", "#fca5a5", "#d8b4fe"];
const PDF_SCALE = 1.45;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeRect(start: Point, end: Point) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function annotationBounds(annotation: PdfAnnotation) {
  if (annotation.type === "highlight") {
    return {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    };
  }

  if (annotation.type === "text") {
    return {
      x: annotation.x - 10,
      y: annotation.y - annotation.fontSize - 10,
      width: Math.max(annotation.text.length * annotation.fontSize * 0.62 + 20, 96),
      height: annotation.fontSize + 18,
    };
  }

  if (annotation.points.length === 0) return null;
  const xs = annotation.points.map((point) => point.x);
  const ys = annotation.points.map((point) => point.y);
  const pad = annotation.size + 6;
  return {
    x: Math.min(...xs) - pad,
    y: Math.min(...ys) - pad,
    width: Math.max(...xs) - Math.min(...xs) + pad * 2,
    height: Math.max(...ys) - Math.min(...ys) + pad * 2,
  };
}

function cloneAnnotation(annotation: PdfAnnotation): PdfAnnotation {
  if (annotation.type === "stroke") {
    return { ...annotation, points: annotation.points.map((point) => ({ ...point })) };
  }
  return { ...annotation };
}

function moveAnnotation(annotation: PdfAnnotation, dx: number, dy: number): PdfAnnotation {
  if (annotation.type === "stroke") {
    return {
      ...annotation,
      points: annotation.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    };
  }
  return {
    ...annotation,
    x: annotation.x + dx,
    y: annotation.y + dy,
  };
}

export default function PdfEditor({ document, onCancel, onSaved }: FormatEditorProps) {
  const pageCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const annotationCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const pdfRef = useRef<any>(null);
  const annotationsRef = useRef<PdfAnnotation[]>([]);
  const currentStrokeRef = useRef<PdfStrokeAnnotation | null>(null);
  const currentHighlightRef = useRef<PdfHighlightAnnotation | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastSavedAnnotationsRef = useRef("");
  const renderTasksRef = useRef<Record<number, { cancel: () => void } | null>>({});
  const renderRunRef = useRef(0);

  const [pages, setPages] = useState<PdfPageInfo[]>([]);
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [brushSize, setBrushSize] = useState(5);
  const [fontSize, setFontSize] = useState(24);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    function preventBackNavigation(event: KeyboardEvent) {
      if (event.key !== "Backspace") return;
      const target = event.target;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (!isEditable) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", preventBackNavigation);
    return () => window.removeEventListener("keydown", preventBackNavigation);
  }, []);

  useEffect(() => {
    annotationsRef.current = annotations;
    renderAnnotationLayers(annotations, selectedId);
  }, [annotations, selectedId, pages]);

  useEffect(() => {
    async function loadPdf() {
      setLoading(true);
      setError(null);

      const [fileResult, annotationResult] = await Promise.all([
        API.fetchDocumentFileBlob(document.id),
        API.fetchDocumentAnnotations<PdfAnnotation>(document.id),
      ]);

      if (fileResult.error || !fileResult.data) {
        setError(fileResult.error?.message ?? "Failed to load PDF.");
        setLoading(false);
        return;
      }
      if (annotationResult.error) {
        setError(annotationResult.error.message);
        setLoading(false);
        return;
      }

      try {
        const bytes = new Uint8Array(await fileResult.data.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        pdfRef.current = pdf;

        const nextPages: PdfPageInfo[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: PDF_SCALE });
          nextPages.push({
            pageNumber,
            width: viewport.width,
            height: viewport.height,
          });
        }

        const loadedAnnotations = annotationResult.data?.annotations ?? [];
        setPages(nextPages);
        setAnnotations(loadedAnnotations);
        annotationsRef.current = loadedAnnotations;
        lastSavedAnnotationsRef.current = JSON.stringify(loadedAnnotations);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Failed to render PDF.");
        setLoading(false);
      }
    }

    void loadPdf();
  }, [document.id]);

  useEffect(() => {
    if (!pdfRef.current || pages.length === 0) return;

    const renderRun = renderRunRef.current + 1;
    renderRunRef.current = renderRun;
    let cancelled = false;

    async function renderPages() {
      for (const pageInfo of pages) {
        if (cancelled || renderRun !== renderRunRef.current) return;
        const canvas = pageCanvasRefs.current[pageInfo.pageNumber];
        if (!canvas) continue;

        const pdfPage = await pdfRef.current.getPage(pageInfo.pageNumber);
        const viewport = pdfPage.getViewport({ scale: PDF_SCALE });
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        renderTasksRef.current[pageInfo.pageNumber]?.cancel();
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const renderTask = pdfPage.render({ canvasContext: ctx, viewport });
        renderTasksRef.current[pageInfo.pageNumber] = renderTask;
        try {
          await renderTask.promise;
        } catch (e: any) {
          if (e?.name !== "RenderingCancelledException") {
            throw e;
          }
        } finally {
          if (renderTasksRef.current[pageInfo.pageNumber] === renderTask) {
            renderTasksRef.current[pageInfo.pageNumber] = null;
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
      if (!cancelled && renderRun === renderRunRef.current) {
        renderAnnotationLayers(annotationsRef.current, selectedId);
      }
    }

    void renderPages().catch((e: any) => {
      if (e?.name !== "RenderingCancelledException") {
        setError(e?.message ?? "Failed to render PDF.");
      }
    });
    return () => {
      cancelled = true;
      pages.forEach((pageInfo) => {
        renderTasksRef.current[pageInfo.pageNumber]?.cancel();
        renderTasksRef.current[pageInfo.pageNumber] = null;
      });
    };
  }, [pages]);

  useEffect(() => {
    if (textDraft) {
      requestAnimationFrame(() => {
        window.document.activeElement instanceof HTMLElement &&
          window.document.activeElement.blur();
        const input = window.document.querySelector<HTMLInputElement>("[data-pdf-text-draft]");
        input?.focus();
      });
    }
  }, [textDraft]);

  function renderAnnotationLayers(
    nextAnnotations = annotationsRef.current,
    nextSelectedId = selectedId
  ) {
    pages.forEach((pageInfo) => {
      const canvas = annotationCanvasRefs.current[pageInfo.pageNumber];
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      canvas.width = pageInfo.width;
      canvas.height = pageInfo.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pageAnnotations = [
        ...nextAnnotations,
        ...(currentStrokeRef.current ? [currentStrokeRef.current] : []),
        ...(currentHighlightRef.current ? [currentHighlightRef.current] : []),
      ].filter((annotation) => annotation.page === pageInfo.pageNumber);

      pageAnnotations.forEach((annotation) => {
        if (annotation.type === "stroke") {
          if (annotation.points.length < 2) return;
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = annotation.color;
          ctx.lineWidth = annotation.size;
          ctx.beginPath();
          ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
          annotation.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
          ctx.stroke();
          ctx.restore();
          return;
        }

        if (annotation.type === "highlight") {
          ctx.save();
          ctx.fillStyle = annotation.color;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
          ctx.restore();
          return;
        }

        const bounds = annotationBounds(annotation);
        if (bounds) {
          ctx.save();
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.strokeStyle = annotation.id === nextSelectedId ? "#2563eb" : "rgba(100, 116, 139, 0.45)";
          ctx.lineWidth = annotation.id === nextSelectedId ? 2 : 1;
          ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
          ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
          ctx.restore();
        }
        ctx.save();
        ctx.font = `700 ${annotation.fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = annotation.color;
        ctx.fillText(annotation.text, annotation.x, annotation.y);
        ctx.restore();
      });

      const selected = pageAnnotations.find((annotation) => annotation.id === nextSelectedId);
      const bounds = selected ? annotationBounds(selected) : null;
      if (bounds) {
        ctx.save();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.restore();
      }
    });
  }

  function getPagePoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width,
      y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height,
    };
  }

  function hitTest(pageNumber: number, point: Point) {
    for (const annotation of [...annotationsRef.current].reverse()) {
      if (annotation.page !== pageNumber) continue;

      if (annotation.type === "stroke") {
        for (let i = 1; i < annotation.points.length; i += 1) {
          if (distanceToSegment(point, annotation.points[i - 1], annotation.points[i]) <= annotation.size + 6) {
            return annotation.id;
          }
        }
        continue;
      }

      const bounds = annotationBounds(annotation);
      if (
        bounds &&
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      ) {
        return annotation.id;
      }
    }
    return null;
  }

  function onPointerDown(pageNumber: number, event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getPagePoint(event);

    if (tool === "select") {
      const hitId = hitTest(pageNumber, point);
      setSelectedId(hitId);
      const hitAnnotation = annotationsRef.current.find((annotation) => annotation.id === hitId);
      if (hitAnnotation) {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          id: hitAnnotation.id,
          start: point,
          original: cloneAnnotation(hitAnnotation),
        };
      }
      return;
    }

    if (tool === "text") {
      setSelectedId(null);
      setTextDraft({
        page: pageNumber,
        pageWidth: event.currentTarget.width,
        pageHeight: event.currentTarget.height,
        x: point.x,
        y: point.y,
        screenLeft: event.clientX,
        screenTop: event.clientY,
        value: "",
        color,
        fontSize,
      });
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "highlight") {
      currentHighlightRef.current = {
        id: makeId(),
        type: "highlight",
        page: pageNumber,
        pageWidth: event.currentTarget.width,
        pageHeight: event.currentTarget.height,
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        color: highlightColor,
      };
      dragRef.current = {
        id: currentHighlightRef.current.id,
        start: point,
        original: currentHighlightRef.current,
      };
      return;
    }

    currentStrokeRef.current = {
      id: makeId(),
      type: "stroke",
      page: pageNumber,
      pageWidth: event.currentTarget.width,
      pageHeight: event.currentTarget.height,
      points: [point],
      color,
      size: brushSize,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getPagePoint(event);

    if (tool === "select" && dragRef.current) {
      const drag = dragRef.current;
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === drag.id ? moveAnnotation(drag.original, dx, dy) : annotation
        )
      );
      return;
    }

    if (tool === "highlight" && currentHighlightRef.current && dragRef.current) {
      const rect = normalizeRect(dragRef.current.start, point);
      currentHighlightRef.current = {
        ...currentHighlightRef.current,
        ...rect,
      };
      renderAnnotationLayers(annotationsRef.current, selectedId);
      return;
    }

    if (tool !== "pen" || !currentStrokeRef.current) return;
    currentStrokeRef.current = {
      ...currentStrokeRef.current,
      points: [...currentStrokeRef.current.points, point],
    };
    renderAnnotationLayers(annotationsRef.current, selectedId);
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release errors from cancelled pointers.
    }

    if (tool === "select" && dragRef.current) {
      dragRef.current = null;
      return;
    }

    if (tool === "highlight" && currentHighlightRef.current) {
      const highlight = currentHighlightRef.current;
      currentHighlightRef.current = null;
      dragRef.current = null;
      if (highlight.width > 4 && highlight.height > 4) {
        setAnnotations((prev) => [...prev, highlight]);
      } else {
        renderAnnotationLayers(annotationsRef.current, selectedId);
      }
      return;
    }

    if (tool !== "pen" || !currentStrokeRef.current) return;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke.points.length > 1) {
      setAnnotations((prev) => [...prev, stroke]);
    } else {
      renderAnnotationLayers(annotationsRef.current, selectedId);
    }
  }

  function commitTextDraft() {
    const draft = textDraft;
    if (!draft) return;

    const cleanText = draft.value.trim();
    setTextDraft(null);
    if (!cleanText) {
      if (draft.editingId) {
        setAnnotations((prev) => prev.filter((annotation) => annotation.id !== draft.editingId));
      }
      return;
    }

    if (draft.editingId) {
      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === draft.editingId && annotation.type === "text"
            ? {
                ...annotation,
                x: draft.x,
                y: draft.y,
                pageWidth: draft.pageWidth,
                pageHeight: draft.pageHeight,
                text: cleanText,
                color: draft.color,
                fontSize: draft.fontSize,
              }
            : annotation
        )
      );
      setSelectedId(draft.editingId);
      return;
    }

    setAnnotations((prev) => [
      ...prev,
      {
        id: makeId(),
        type: "text",
        page: draft.page,
        pageWidth: draft.pageWidth,
        pageHeight: draft.pageHeight,
        x: draft.x,
        y: draft.y,
        text: cleanText,
        color: draft.color,
        fontSize: draft.fontSize,
      },
    ]);
  }

  function getAnnotationsWithDraft() {
    const draft = textDraft;
    const cleanText = draft?.value.trim();
    if (!draft || !cleanText) return annotationsRef.current;

    if (draft.editingId) {
      return annotationsRef.current.map((annotation) =>
        annotation.id === draft.editingId && annotation.type === "text"
          ? {
              ...annotation,
              x: draft.x,
              y: draft.y,
              pageWidth: draft.pageWidth,
              pageHeight: draft.pageHeight,
              text: cleanText,
              color: draft.color,
              fontSize: draft.fontSize,
            }
          : annotation
      );
    }

    return [
      ...annotationsRef.current,
      {
        id: makeId(),
        type: "text" as const,
        page: draft.page,
        pageWidth: draft.pageWidth,
        pageHeight: draft.pageHeight,
        x: draft.x,
        y: draft.y,
        text: cleanText,
        color: draft.color,
        fontSize: draft.fontSize,
      },
    ];
  }

  function withPageDimensions(annotation: PdfAnnotation): PdfAnnotation {
    const canvas = annotationCanvasRefs.current[annotation.page];
    if (!canvas) return annotation;
    if ("pageWidth" in annotation && annotation.pageWidth && annotation.pageHeight) {
      return annotation;
    }
    return {
      ...annotation,
      pageWidth: canvas.width,
      pageHeight: canvas.height,
    };
  }

  function startEditingText(annotation: PdfTextAnnotation) {
    const canvas = annotationCanvasRefs.current[annotation.page];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setTool("text");
    setSelectedId(annotation.id);
    setTextDraft({
      page: annotation.page,
      pageWidth: annotation.pageWidth ?? canvas.width,
      pageHeight: annotation.pageHeight ?? canvas.height,
      x: annotation.x,
      y: annotation.y,
      screenLeft: rect.left + (annotation.x / canvas.width) * rect.width,
      screenTop: rect.top + ((annotation.y - annotation.fontSize) / canvas.height) * rect.height,
      value: annotation.text,
      color: annotation.color,
      fontSize: annotation.fontSize,
      editingId: annotation.id,
    });
  }

  function onDoubleClick(pageNumber: number, event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width,
      y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height,
    };
    const hitId = hitTest(pageNumber, point);
    const annotation = annotationsRef.current.find(
      (item): item is PdfTextAnnotation => item.id === hitId && item.type === "text"
    );
    if (annotation) startEditingText(annotation);
  }

  function undo() {
    setAnnotations((prev) => prev.slice(0, -1));
    setSelectedId(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== selectedId));
    setSelectedId(null);
  }

  function clearAnnotations() {
    setAnnotations([]);
    setSelectedId(null);
  }

  function hasUnsavedChanges() {
    return JSON.stringify(getAnnotationsWithDraft()) !== lastSavedAnnotationsRef.current;
  }

  async function saveAnnotations() {
    if (saving) return true;
    setSaving(true);
    setError(null);
    const annotationsToSave = getAnnotationsWithDraft().map(withPageDimensions);
    annotationsRef.current = annotationsToSave;
    setAnnotations(annotationsToSave);
    setTextDraft(null);

    const { data, error } = await API.saveDocumentAnnotations(document.id, annotationsToSave);
    setSaving(false);
    if (error) {
      setError(error.message);
      return false;
    }

    lastSavedAnnotationsRef.current = JSON.stringify(annotationsToSave);
    onSaved({ chunks: data?.chunks ?? 0 }, { closeAfterSave: false });
    return true;
  }

  async function finish() {
    const saved = await saveAnnotations();
    if (saved) onCancel();
  }

  function cancel() {
    if (hasUnsavedChanges()) {
      setConfirmCancelOpen(true);
      return;
    }
    onCancel();
  }

  const selectedTextAnnotation = annotations.find(
    (annotation): annotation is PdfTextAnnotation => annotation.id === selectedId && annotation.type === "text"
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-48 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {document.title ?? "Untitled"}
          </div>
          <div className="text-xs text-slate-500">PDF annotation editor</div>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
          {[
            { value: "select", icon: MousePointer2, label: "Select" },
            { value: "pen", icon: Pencil, label: "Pen" },
            { value: "highlight", icon: Highlighter, label: "Highlight" },
            { value: "text", icon: Type, label: "Text" },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTool(value as Tool)}
              className={[
                "inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold",
                tool === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-white",
              ].join(" ")}
              title={label}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
          {(tool === "highlight" ? HIGHLIGHT_COLORS : COLORS).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => (tool === "highlight" ? setHighlightColor(value) : setColor(value))}
              className={[
                "flex h-6 w-6 items-center justify-center rounded",
                (tool === "highlight" ? highlightColor : color) === value ? "bg-white shadow-sm" : "hover:bg-white",
              ].join(" ")}
              aria-label={`Use ${value}`}
              title={value}
            >
              <Circle size={14} fill={value} color={value} />
            </button>
          ))}
        </div>

        {tool === "pen" && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            Brush
            <input
              type="range"
              min={2}
              max={24}
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
              className="w-20"
            />
          </label>
        )}

        {tool === "text" && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            Text size
            <input
              type="range"
              min={12}
              max={60}
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
              className="w-20"
            />
          </label>
        )}

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - ZOOM_STEP).toFixed(2))))}
            disabled={zoom <= MIN_ZOOM}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-white disabled:opacity-50"
            title="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <span className="w-12 text-center text-xs font-semibold text-slate-600">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + ZOOM_STEP).toFixed(2))))}
            disabled={zoom >= MAX_ZOOM}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-white disabled:opacity-50"
            title="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
        </div>

        <button
          type="button"
          onClick={undo}
          disabled={annotations.length === 0 || saving}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Undo2 size={14} />
          Undo
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={!selectedId || saving}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Trash2 size={14} />
          Delete
        </button>
        <button
          type="button"
          onClick={() => selectedTextAnnotation && startEditingText(selectedTextAnnotation)}
          disabled={!selectedTextAnnotation || saving}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Type size={14} />
          Edit Text
        </button>
        <button
          type="button"
          onClick={clearAnnotations}
          disabled={annotations.length === 0 || saving}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => void saveAnnotations()}
          disabled={saving || loading}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <Save size={14} />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void finish()}
          disabled={saving || loading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          Finish
        </button>
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-6">
        {loading && <div className="text-sm text-slate-600">Loading PDF...</div>}
        <div className="mx-auto flex w-fit flex-col gap-6">
          {pages.map((page) => (
            <div
              key={page.pageNumber}
              className="relative bg-white shadow-sm"
              style={{
                width: page.width * zoom,
                height: page.height * zoom,
              }}
            >
              <canvas
                ref={(node) => {
                  pageCanvasRefs.current[page.pageNumber] = node;
                }}
                width={page.width}
                height={page.height}
                className="block"
                style={{
                  width: page.width * zoom,
                  height: page.height * zoom,
                }}
              />
              <canvas
                ref={(node) => {
                  annotationCanvasRefs.current[page.pageNumber] = node;
                }}
                width={page.width}
                height={page.height}
                onPointerDown={(event) => onPointerDown(page.pageNumber, event)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={(event) => onDoubleClick(page.pageNumber, event)}
                className={[
                  "absolute inset-0 touch-none",
                  tool === "select" ? "cursor-move" : "cursor-crosshair",
                ].join(" ")}
                style={{
                  width: page.width * zoom,
                  height: page.height * zoom,
                }}
              />
              <div className="absolute bottom-2 right-3 rounded bg-white/80 px-2 py-0.5 text-xs text-slate-500">
                {page.pageNumber} / {pages.length}
              </div>
            </div>
          ))}
        </div>

        {textDraft && (
          <input
            data-pdf-text-draft
            value={textDraft.value}
            onChange={(event) =>
              setTextDraft((current) =>
                current ? { ...current, value: event.target.value } : current
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTextDraft();
              }
              if (event.key === "Escape") {
                setTextDraft(null);
              }
            }}
            placeholder="Type text"
            className="fixed z-50 min-w-40 rounded-md border border-blue-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900 shadow-lg outline-none ring-2 ring-blue-100"
            style={{
              left: textDraft.screenLeft,
              top: textDraft.screenTop,
              color: textDraft.color,
              fontSize: textDraft.fontSize,
            }}
          />
        )}
      </div>

      <ConfirmModal
        open={confirmCancelOpen}
        title="Leave without saving?"
        message="Your latest PDF annotation changes have not been saved. If you leave now, those edits will be discarded."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        confirmTone="danger"
        onConfirm={() => {
          setConfirmCancelOpen(false);
          onCancel();
        }}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}
