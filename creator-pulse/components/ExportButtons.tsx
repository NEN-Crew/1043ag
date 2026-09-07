import { Download } from "./Icons";

/**
 * Two downloads, plain links: the browser handles the file, no client state.
 * "Contas" is the ranking as a spreadsheet; "Posts" is every post behind it.
 */
export default function ExportButtons({ windowDays }: { windowDays: number }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <a className="btn on-dark" href={`/api/admin/export?tipo=contas&janela=${windowDays}`} download>
        <Download size={13} />
        Exportar relatório
      </a>
      <a className="btn on-dark" href={`/api/admin/export?tipo=posts&janela=${windowDays}`} download>
        <Download size={13} />
        Exportar posts
      </a>
    </div>
  );
}
