"use client";

import NiceModal from "@ebay/nice-modal-react";
import { Download, FileUp, Search, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/modals/confirm-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/types";
import type { AppDocument, AppTag } from "@/lib/types";

type DocumentPanelProps = {
  dictionary: Dictionary;
  documents: AppDocument[];
  tags: AppTag[];
};

export function DocumentPanel({ dictionary, documents, tags }: DocumentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(["any"]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<AppDocument[]>([]);
  const [search, setSearch] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const allDocuments = [...uploadedDocs, ...documents].filter((d) => !deletedIds.has(d.id));
  const filtered = allDocuments.filter(
    (d) =>
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.originalFilename.toLowerCase().includes(search.toLowerCase()),
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPendingFile(file);
    if (file) setSelectedTags(["any"]);
  }

  function toggleTag(key: string) {
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key],
    );
  }

  async function handleUpload() {
    if (!pendingFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("title", pendingFile.name.replace(/\.[^.]+$/, ""));
      for (const tag of selectedTags) {
        formData.append("tagKeys", tag);
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = "Upload failed";
        try {
          const body = (await response.json()) as { error?: string };
          errorMsg = body.error ?? errorMsg;
        } catch {
          // non-JSON error body — use default message
        }
        throw new Error(errorMsg);
      }

      const body = (await response.json()) as { document: AppDocument };
      setUploadedDocs((prev) => [body.document, ...prev]);
      toast.success(`"${body.document.title}" uploaded — ingestion started.`);
      setPendingFile(null);
      setSelectedTags(["any"]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(document: AppDocument) {
    const confirmed = await NiceModal.show(ConfirmDialog, {
      title: `Delete "${document.title}"?`,
      description: "This will permanently remove the document and all its indexed content. This cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;

    setDeletingId(document.id);
    try {
      const res = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Delete failed");
      }
      setDeletedIds((prev) => new Set([...prev, document.id]));
      toast.success(`"${document.title}" deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto space-y-4 border-t p-4 sm:p-8" id="documents">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{dictionary.documents.title}</h2>
          <p className="text-sm text-muted-foreground">{dictionary.documents.description}</p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          <FileUp className="size-4" />
          {dictionary.documents.upload}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.docx"
        hidden
        onChange={handleFileSelect}
      />

      {pendingFile && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{pendingFile.name}</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
            <CardDescription>
              {(pendingFile.size / 1024).toFixed(0)} KB · {pendingFile.type || "unknown type"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {dictionary.documents.tags}
              </Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={() => toggleTag(tag.key)}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant={selectedTags.includes(tag.key) ? "default" : "outline"}
                      className="cursor-pointer"
                    >
                      {tag.label}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleUpload} disabled={isUploading} className="w-full">
              {isUploading ? "Uploading…" : "Confirm upload"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={dictionary.documents.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {filtered.map((document) => (
          <Card key={document.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{document.title}</CardTitle>
                  <CardDescription>{document.originalFilename}</CardDescription>
                </div>
                <StatusBadge status={document.status} />
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {document.tagKeys.map((tagKey) => (
                  <Badge key={tagKey} variant="outline">
                    {tagKey}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">{document.updatedAt}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                >
                  <a href={`/api/documents/${document.id}/download`} download>
                    <Download className="size-4" />
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(document)}
                  disabled={deletingId === document.id}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No documents found.</p>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: AppDocument["status"] }) {
  const variant = status === "failed" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
