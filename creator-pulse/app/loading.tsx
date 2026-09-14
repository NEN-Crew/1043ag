import { Spinner } from "@/components/ui";

/** The Figma "Carregamento" frame: a cobalt field with the dotted spinner. */
export default function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite" aria-label="Carregando">
      <Spinner />
    </div>
  );
}
