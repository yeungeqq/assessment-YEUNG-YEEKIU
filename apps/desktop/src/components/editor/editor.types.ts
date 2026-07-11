export type EditableDocument = {
  id: string;
  title: string | null;
  file_path: string;
  mime_type?: string | null;
};

export type DocumentEditorProps = {
  document: EditableDocument;
  initialText?: string;
  onCancel: () => void;
  onSaved: (result: { chunks: number }, options?: { closeAfterSave?: boolean }) => void;
};

export type FormatEditorProps = DocumentEditorProps;
