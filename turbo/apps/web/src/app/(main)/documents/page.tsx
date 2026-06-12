import { DocumentPanel } from "@/components/documents/document-panel";
import { getDictionary } from "@/i18n/locale";
import { getCurrentUser } from "@/lib/auth";
import { getAllTags, getDocumentsForRole } from "@/lib/queries";

export default async function DocumentsPage() {
  const [dictionary, { role }, tags] = await Promise.all([
    getDictionary(),
    getCurrentUser(),
    getAllTags(),
  ]);
  const documents = await getDocumentsForRole(role);
  return <DocumentPanel dictionary={dictionary} documents={documents} tags={tags} />;
}
