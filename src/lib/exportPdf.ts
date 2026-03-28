import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportPdfOptions {
  title: string;
  subtitle: string;
  sections: {
    heading: string;
    columns: string[];
    rows: string[][];
  }[];
  filename: string;
}

export function exportPdf({ title, subtitle, sections, filename }: ExportPdfOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(subtitle, pageWidth / 2, 28, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  let startY = 36;

  sections.forEach((section) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(section.heading, 14, startY);
    startY += 4;

    if (section.rows.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Sem dados no período', 14, startY + 4);
      startY += 12;
    } else {
      autoTable(doc, {
        startY,
        head: [section.columns],
        body: section.rows,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [12, 91, 168] },
        margin: { left: 14, right: 14 },
      });
      startY = (doc as any).lastAutoTable.finalY + 10;
    }
  });

  doc.save(filename);
}
