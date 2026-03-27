import { signal } from "../core/signals/signal";
import { batch } from "../reactivity/batch";

export interface FileUploadOptions {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  onFiles?: (files: File[]) => void;
}

export function fileUpload(options?: FileUploadOptions): {
  files: () => File[];
  addFiles: (fileList: FileList | File[]) => void;
  removeFile: (index: number) => void;
  clear: () => void;
  errors: () => string[];
  isDragOver: () => boolean;
  setDragOver: (v: boolean) => void;
} {
  const accept = options?.accept;
  const multiple = options?.multiple ?? false;
  const maxSize = options?.maxSize;
  const onFiles = options?.onFiles;

  const [files, setFiles] = signal<File[]>([]);
  const [errors, setErrors] = signal<string[]>([]);
  const [isDragOver, setDragOver] = signal<boolean>(false);

  /**
   * Parse the accept string into an array of allowed types/extensions.
   * Supports patterns like ".jpg,.png", "image/*", "application/pdf"
   */
  function isAccepted(file: File): boolean {
    if (!accept) return true;

    const acceptedTypes = accept.split(",").map((t) => t.trim().toLowerCase());
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    return acceptedTypes.some((pattern) => {
      if (pattern.startsWith(".")) {
        // Extension match
        return fileName.endsWith(pattern);
      }
      if (pattern.endsWith("/*")) {
        // Wildcard type match, e.g., "image/*"
        const prefix = pattern.slice(0, pattern.indexOf("/"));
        return fileType.startsWith(`${prefix}/`);
      }
      // Exact MIME type match
      return fileType === pattern;
    });
  }

  function addFiles(fileList: FileList | File[]): void {
    const incoming = Array.from(fileList);
    const validFiles: File[] = [];
    const newErrors: string[] = [];

    for (const file of incoming) {
      if (!isAccepted(file)) {
        newErrors.push(`File "${file.name}" is not an accepted type`);
        continue;
      }
      if (maxSize !== undefined && file.size > maxSize) {
        newErrors.push(`File "${file.name}" exceeds maximum size of ${maxSize} bytes`);
        continue;
      }
      validFiles.push(file);
    }

    batch(() => {
      setErrors(newErrors);
      if (validFiles.length > 0) {
        if (multiple) {
          setFiles((prev) => [...prev, ...validFiles]);
        } else {
          // Single mode: replace with the last valid file
          setFiles([validFiles[validFiles.length - 1]]);
        }
        if (onFiles) {
          onFiles(validFiles);
        }
      }
    });
  }

  function removeFile(index: number): void {
    setFiles((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }

  function clear(): void {
    batch(() => {
      setFiles([]);
      setErrors([]);
    });
  }

  return {
    files,
    addFiles,
    removeFile,
    clear,
    errors,
    isDragOver,
    setDragOver,
  };
}
