import { FileUp, Search } from "lucide-react";

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
import type { Dictionary } from "@/i18n/types";
import type { DemoDocument } from "@/lib/demo-data";

type DocumentPanelProps = {
  dictionary: Dictionary;
  documents: DemoDocument[];
};

export function DocumentPanel({ dictionary, documents }: DocumentPanelProps) {
  return (
    <section className="space-y-4 border-t p-8" id="documents">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{dictionary.documents.title}</h2>
          <p className="text-sm text-muted-foreground">
            {dictionary.documents.description}
          </p>
        </div>
        <Button>
          <FileUp className="size-4" />
          {dictionary.documents.upload}
        </Button>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={dictionary.documents.search} />
      </div>

      <div className="grid gap-3">
        {documents.map((document) => (
          <Card key={document.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{document.title}</CardTitle>
                  <CardDescription>{document.filename}</CardDescription>
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
              <p className="text-xs text-muted-foreground">{document.updatedAt}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: DemoDocument["status"] }) {
  const variant = status === "failed" ? "destructive" : "secondary";

  return <Badge variant={variant}>{status}</Badge>;
}
