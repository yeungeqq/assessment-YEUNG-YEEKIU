import { useEffect, useRef, useState } from "react";
import { Circle, MousePointer2, Pencil, Save, Trash2, Type, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import * as API from "../../Api";
import ConfirmModal from "../common/ConfirmModal";
import type { FormatEditorProps } from "./editor.types";

type Point = { x: number; y: number };
type StrokeAnnotation = {
  id: string;
  type: "stroke";
  points: Point[];
  color: string;
  size: number;
};
type TextAnnotation = {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};
type ImageAnnotation = StrokeAnnotation | TextAnnotation;
type Tool = "select" | "pen" | "text";
type TextDraft = {
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
  original: ImageAnnotation;
};

const COLORS = ["#2563eb", "#111827", "#ef4444", "#f59e0b", "#10b981"];
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

export default function ImageEditor({ document, onCancel, onSaved }: FormatEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const currentStrokeRef = useRef<StrokeAnnotation | null>(null);
  const annotationsRef = useRef<ImageAnnotation[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const lastSavedAnnotationsRef = useRef("");

  const [annotations, setAnnotations] = useState<ImageAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(8);
  const [fontSize, setFontSize] = useState(28);
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
    renderCanvas(annotations, currentStrokeRef.current, selectedId);
  }, [annotations, selectedId]);

  useEffect(() => {
    if (textDraft) {
      requestAnimationFrame(() => {
        textInputRef.current?.focus();
      });
    }
  }, [textDraft]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [fileResult, annotationResult] = await Promise.all([
        API.fetchDocumentFileBlob(document.id),
        API.fetchDocumentAnnotations<ImageAnnotation>(document.id),
      ]);
      if (cancelled) return;

      if (fileResult.error || !fileResult.data) {
        setError(fileResult.error?.message ?? "Failed to load image.");
        setLoading(false);
        return;
      }
      if (annotationResult.error) {
        setError(annotationResult.error.message);
        setLoading(false);
        return;
      }

      const loadedAnnotations = annotationResult.data?.annotations ?? [];
      objectUrl = URL.createObjectURL(fileResult.data);
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        imageRef.current = image;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        setAnnotations(loadedAnnotations);
        annotationsRef.current = loadedAnnotations;
        lastSavedAnnotationsRef.current = JSON.stringify(loadedAnnotations);
        renderCanvas(loadedAnnotations, null, null);
        setLoading(false);
      };
      image.onerror = () => {
        setError("Failed to decode image.");
        setLoading(false);
      };
      image.src = objectUrl;
    }

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.id]);

  function renderCanvas(
    nextAnnotations = annotationsRef.current,
    currentStroke = currentStrokeRef.current,
    nextSelectedId = selectedId
  ) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const image = imageRef.current;
    if (!canvas || !ctx || !image) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    [...nextAnnotations, ...(currentStroke ? [currentStroke] : [])].forEach((annotation) => {
      if (annotation.type === "stroke") {
        if (annotation.points.length < 2) return;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = annotation.size;
        ctx.beginPath();
        ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
        annotation.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.stroke();
      } else {
        ctx.font = `700 ${annotation.fontSize}px system-ui, -apple-system, sans-serif`;
        const bounds = getAnnotationBounds(ctx, annotation);
        if (bounds) {
          ctx.save();
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.strokeStyle = annotation.id === nextSelectedId ? "#2563eb" : "rgba(100, 116, 139, 0.45)";
          ctx.lineWidth = annotation.id === nextSelectedId ? 2 : 1;
          ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
          ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
          ctx.restore();
        }
        ctx.fillStyle = annotation.color;
        ctx.fillText(annotation.text, annotation.x, annotation.y);
      }
    });

    const selected = nextAnnotations.find((annotation) => annotation.id === nextSelectedId);
    if (selected) {
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      const bounds = getAnnotationBounds(ctx, selected);
      if (bounds) ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.restore();
    }
  }

  function getAnnotationBounds(ctx: CanvasRenderingContext2D, annotation: ImageAnnotation) {
    if (annotation.type === "text") {
      ctx.font = `700 ${annotation.fontSize}px system-ui, -apple-system, sans-serif`;
      const metrics = ctx.measureText(annotation.text);
      const width = Math.max(metrics.width + 20, 96);
      return {
        x: annotation.x - 10,
        y: annotation.y - annotation.fontSize - 10,
        width,
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

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function getScreenPoint(point: Point) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      screenLeft: rect.left + (point.x / canvas.width) * rect.width,
      screenTop: rect.top + (point.y / canvas.height) * rect.height,
    };
  }

  function cloneAnnotation(annotation: ImageAnnotation): ImageAnnotation {
    if (annotation.type === "stroke") {
      return {
        ...annotation,
        points: annotation.points.map((point) => ({ ...point })),
      };
    }
    return { ...annotation };
  }

  function moveAnnotation(annotation: ImageAnnotation, dx: number, dy: number): ImageAnnotation {
    if (annotation.type === "stroke") {
      return {
        ...annotation,
        points: annotation.points.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      };
    }

    return {
      ...annotation,
      x: annotation.x + dx,
      y: annotation.y + dy,
    };
  }

  function hitTest(point: Point) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return null;

    for (const annotation of [...annotationsRef.current].reverse()) {
      if (annotation.type === "text") {
        const bounds = getAnnotationBounds(ctx, annotation);
        if (
          bounds &&
          point.x >= bounds.x &&
          point.x <= bounds.x + bounds.width &&
          point.y >= bounds.y &&
          point.y <= bounds.y + bounds.height
        ) {
          return annotation.id;
        }
      } else {
        for (let i = 1; i < annotation.points.length; i += 1) {
          if (distanceToSegment(point, annotation.points[i - 1], annotation.points[i]) <= annotation.size + 6) {
            return annotation.id;
          }
        }
      }
    }

    return null;
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);
    if (!point) return;

    if (tool === "select") {
      const hitId = hitTest(point);
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
    const stroke: StrokeAnnotation = {
      id: makeId(),
      type: "stroke",
      points: [point],
      color,
      size: brushSize,
    };
    currentStrokeRef.current = stroke;
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "select" && dragRef.current) {
      const point = getCanvasPoint(event);
      if (!point) return;
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

    if (tool !== "pen" || !currentStrokeRef.current) return;
    const point = getCanvasPoint(event);
    if (!point) return;
    currentStrokeRef.current = {
      ...currentStrokeRef.current,
      points: [...currentStrokeRef.current.points, point],
    };
    renderCanvas(annotationsRef.current, currentStrokeRef.current, selectedId);
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release errors from cancelled pointers.
      }
      return;
    }

    if (tool !== "pen" || !currentStrokeRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release errors from cancelled pointers.
    }
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke.points.length > 1) {
      setAnnotations((prev) => [...prev, stroke]);
    } else {
      renderCanvas(annotationsRef.current, null, selectedId);
    }
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

  function commitTextDraft() {
    const draft = textDraft;
    if (!draft) return;

    const cleanText = draft.value.trim();
    setTextDraft(null);
    if (!cleanText) {
      if (draft.editingId) {
        setAnnotations((prev) => prev.filter((annotation) => annotation.id !== draft.editingId));
        setSelectedId(null);
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
        x: draft.x,
        y: draft.y,
        text: cleanText,
        color: draft.color,
        fontSize: draft.fontSize,
      },
    ];
  }

  function hasUnsavedChanges() {
    return JSON.stringify(getAnnotationsWithDraft()) !== lastSavedAnnotationsRef.current;
  }

  function startEditingText(annotation: TextAnnotation) {
    const screenPoint = getScreenPoint({ x: annotation.x, y: annotation.y - annotation.fontSize });
    if (!screenPoint) return;
    setTool("text");
    setSelectedId(annotation.id);
    setTextDraft({
      x: annotation.x,
      y: annotation.y,
      screenLeft: screenPoint.screenLeft,
      screenTop: screenPoint.screenTop,
      value: annotation.text,
      color: annotation.color,
      fontSize: annotation.fontSize,
      editingId: annotation.id,
    });
  }

  function onCanvasDoubleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
    const hitId = hitTest(point);
    const annotation = annotationsRef.current.find(
      (item): item is TextAnnotation => item.id === hitId && item.type === "text"
    );
    if (annotation) {
      startEditingText(annotation);
    }
  }

  async function saveAnnotations() {
    if (saving) return true;
    setSaving(true);
    setError(null);
    const annotationsToSave = getAnnotationsWithDraft();
    annotationsRef.current = annotationsToSave;
    setAnnotations(annotationsToSave);
    setTextDraft(null);

    const { data, error } = await API.saveDocumentAnnotations(
      document.id,
      annotationsToSave
    );
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
    if (saved) {
      onCancel();
    }
  }

  function cancel() {
    if (hasUnsavedChanges()) {
      setConfirmCancelOpen(true);
      return;
    }

    onCancel();
  }

  const selectedTextAnnotation = annotations.find(
    (annotation): annotation is TextAnnotation => annotation.id === selectedId && annotation.type === "text"
  );
  const canvas = canvasRef.current;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-48 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {document.title ?? "Untitled"}
          </div>
          <div className="text-xs text-slate-500">Image annotation editor</div>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
          {[
            { value: "select", icon: MousePointer2, label: "Select" },
            { value: "pen", icon: Pencil, label: "Pen" },
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
          {COLORS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setColor(value)}
              className={[
                "flex h-6 w-6 items-center justify-center rounded",
                color === value ? "bg-white shadow-sm" : "hover:bg-white",
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
              max={32}
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
              max={72}
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
          disabled={saving}
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
        {loading && <div className="text-sm text-slate-600">Loading image...</div>}
        <div className="relative mx-auto w-fit">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            onDoubleClick={onCanvasDoubleClick}
            className={[
              "block touch-none bg-white shadow-sm",
              loading ? "hidden" : tool === "select" ? "cursor-move" : "cursor-crosshair",
            ].join(" ")}
            style={
              canvas
                ? {
                    width: canvas.width * zoom,
                    height: canvas.height * zoom,
                  }
                : undefined
            }
          />
          {textDraft && (
            <input
              ref={textInputRef}
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
      </div>

      <ConfirmModal
        open={confirmCancelOpen}
        title="Leave without saving?"
        message="Your latest annotation changes have not been saved. If you leave now, those edits will be discarded."
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
