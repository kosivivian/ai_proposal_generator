"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function PreviewDialog({ html }: { html: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Preview</DialogTrigger>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>What the client will see</DialogTitle>
        </DialogHeader>
        <iframe srcDoc={html} title="Proposal preview" className="w-full h-[75vh] border-0" />
      </DialogContent>
    </Dialog>
  );
}
