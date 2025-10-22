import { useCallback } from "react";
import { Upload, X, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  label: string;
  helpText: string;
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
  maxSize?: number;
}

export const FileUpload = ({
  label,
  helpText,
  accept,
  file,
  onFileChange,
  error,
  maxSize = 50 * 1024 * 1024, // 50MB default
}: FileUploadProps) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      
      if (droppedFile) {
        // Validate file type
        const fileExtension = droppedFile.name.split('.').pop()?.toLowerCase();
        const acceptedExtensions = accept.split(',').map(ext => ext.trim().replace('.', ''));
        
        if (!acceptedExtensions.includes(fileExtension || '')) {
          onFileChange(null);
          return;
        }
        
        // Validate file size
        if (droppedFile.size > maxSize) {
          onFileChange(null);
          return;
        }
        
        onFileChange(droppedFile);
      }
    },
    [accept, maxSize, onFileChange]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > maxSize) {
        onFileChange(null);
        return;
      }
      onFileChange(selectedFile);
    }
  };

  const removeFile = () => {
    onFileChange(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={cn(
          "relative rounded-lg border-2 border-dashed p-6 transition-all",
          file
            ? "border-primary bg-accent/50"
            : error
            ? "border-destructive bg-destructive/5"
            : "border-input bg-card hover:border-primary/50 hover:bg-accent/20",
          "cursor-pointer"
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileInput}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        
        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFile();
              }}
              className="rounded-md p-1 hover:bg-destructive/10 text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground mb-1">
              Arraste e solte ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">{helpText}</p>
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};
