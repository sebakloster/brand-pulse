import { notFound, redirect } from "next/navigation";
import { getThread } from "@/lib/queries";

// Old links (e.g. in emails) point at /m/:id; send them to the brand-scoped page.
export default async function LegacyMention({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getThread(id);
  if (!t) notFound();
  redirect(`/b/${t.brandId}/m/${id}`);
}
