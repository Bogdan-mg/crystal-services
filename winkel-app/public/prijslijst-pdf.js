// Maakt de prijslijst als PDF, in dezelfde opmaak als de afgedrukte lijst (Prijslijsten > Afdrukken).
// Gebruikt door de winkel-app en door de openbare pagina /prijslijst/ (link voor klanten).
// Afgesproken klantprijzen (Sportclubs, Vaste klanten) komen er nooit in.
(function () {
  const GEHEIM = ['Sportclubs', 'Vaste klanten'];
  const datum = () => new Date().toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

  // Strijken & wassen moet op één A4: begin op de gewone grootte en maak kleiner tot het past.
  window.maakPrijslijstPdf = function (soort, data) {
    if (soort === 'droog') return maak(soort, data, 9).output('blob');
    for (let grootte = 8.5; grootte > 5.5; grootte -= 0.3) {
      const doc = maak(soort, data, grootte);
      if (doc.getNumberOfPages() === 1) return doc.output('blob');
    }
    return maak(soort, data, 5.5).output('blob');
  };

  function maak(soort, { naam, groepen, droogkuis }, grootte) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const rand = 12;
    const lijn = { lineColor: 0, lineWidth: 0.25, textColor: 0 };

    if (soort === 'droog') {
      const pr = (v) => (v == null ? '' : Number(v).toFixed(2).replace('.', ','));
      const lijst = (droogkuis || []).map((d) => (typeof d === 'string' ? { naam: d } : d));
      const kop = () => {
        doc.setFont('courier', 'normal'); doc.setFontSize(11); doc.setTextColor(0);
        doc.text('Prijslijst Eur', rand, 16);
        doc.setFont('courier', 'bold'); doc.text(naam.toUpperCase(), 105, 16, { align: 'center' });
        doc.setFont('courier', 'normal'); doc.text(datum(), 210 - rand, 16, { align: 'right' });
        doc.setLineWidth(0.3); doc.line(rand, 18, 210 - rand, 18); doc.line(rand, 18.8, 210 - rand, 18.8);
      };
      kop();
      doc.setFontSize(10); doc.text('Nieuwkuis', 105, 25, { align: 'center' });
      doc.line(105 - 9, 25.6, 105 + 9, 25.6);
      doc.autoTable({
        startY: 28, margin: { left: rand, right: rand, top: 24 }, theme: 'grid',
        styles: { font: 'courier', fontSize: 9, cellPadding: { top: 0.7, bottom: 0.7, left: 2, right: 2 }, halign: 'right', ...lijn },
        headStyles: { fillColor: false, fontStyle: 'bold', valign: 'middle' },
        columnStyles: { 0: { halign: 'left' }, 1: { cellWidth: 21 }, 2: { cellWidth: 21 }, 3: { cellWidth: 21 }, 4: { cellWidth: 21 }, 5: { cellWidth: 21 } },
        head: [['', 'Luxe\nvanaf', 'Zijde\nvanaf', 'Linnen\nvanaf', 'Verv.', 'Strijk']],
        body: lijst.map((d) => [d.naam.toUpperCase(), pr(d.luxe), pr(d.zijde), pr(d.linne), '', '']),
        didDrawPage: (data) => { if (data.pageNumber > 1) kop(); },
      });
      let y = doc.lastAutoTable.finalY + 6;
      if (y > 280) { doc.addPage(); kop(); y = 28; }
      doc.setFont('courier', 'normal'); doc.setFontSize(10);
      doc.text(`Aantal : ${lijst.length}`, rand, y);
      doc.setFont('courier', 'bold'); doc.text('Alle prijzen zijn vanafprijzen.', rand, y + 5.5);
      doc.setFont('courier', 'normal'); doc.text('De juiste prijs krijgt u na het bekijken van het stuk.', rand, y + 10);
      return doc;
    }

    // Strijken & wassen: in de opmaak van de papieren lijst V43, compact op één A4.
    const pr = (v) => (v == null ? '' : '€ ' + Number(v).toFixed(2).replace('.', ','));
    const [eerste, ...rest] = (groepen || []).filter((g) => !GEHEIM.includes(g.titel) && !/schoen|motor/i.test(g.titel));
    const rijenVan = (g) => [
      { kop: true, cellen: [g.titel, 'Prijs strijken', 'Aantal', 'Prijs ' + (g.wassenLabel || 'wassen'), 'Aantal'] },
      ...g.stukken.filter((st) => st.strijken != null || st.wassen != null || st.prijs != null).map((st) => {
        const tweede = st.wassen ?? st.prijs ?? null;
        return { cellen: [st.naam, st.strijken != null ? pr(st.strijken) : (tweede == null ? '' : '/'), '', pr(tweede), ''] };
      }),
    ];
    const tabel = (rijen, startY, totaal) => doc.autoTable({
      startY, margin: { left: rand, right: rand, top: 14 }, theme: 'grid', showHead: 'never',
      styles: { font: 'helvetica', fontSize: grootte, cellPadding: { top: grootte * 0.04, bottom: grootte * 0.04, left: 1.5, right: 1.5 }, halign: 'center', ...lijn },
      columnStyles: { 1: { cellWidth: 38 }, 2: { cellWidth: 20 }, 3: { cellWidth: 38 }, 4: { cellWidth: 20 } },
      body: [...rijen.map((r) => r.leeg ? ['', '', '', '', ''].map(() => ({ content: '', styles: { minCellHeight: 2.2, cellPadding: 0 } })) : r.cellen), ...(totaal ? [['', '', '', 'Totaal:', '']] : [])],
      didParseCell: (d) => {
        const r = rijen[d.row.index];
        if (r?.kop) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.cellPadding = { top: 0.5, bottom: 0.5, left: 1.5, right: 1.5 }; }
        if (totaal && d.row.index === rijen.length && d.column.index === 3) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.halign = 'right'; }
      },
      didDrawCell: (d) => {
        // Koppen onderlijnd, zoals op de afgedrukte lijst.
        if (rijen[d.row.index]?.kop && d.cell.text?.[0]) {
          const w = doc.getTextWidth(d.cell.text[0]); const x = d.cell.x + d.cell.width / 2;
          doc.setLineWidth(0.2); doc.line(x - w / 2, d.cell.y + d.cell.height - 0.6, x + w / 2, d.cell.y + d.cell.height - 0.6);
        }
      },
    });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(0);
    doc.text(`${naam} · Prijslijst`, rand, 11);
    doc.setFont('helvetica', 'normal'); doc.text(datum(), 210 - rand, 11, { align: 'right' });
    // Alles op één blad: de groepen na elkaar, met een smalle lege rij ertussen.
    const rijen = [];
    [eerste, ...rest].filter(Boolean).forEach((g, i) => { if (i) rijen.push({ leeg: true }); rijen.push(...rijenVan(g)); });
    tabel(rijen, 14, false);
    return doc;
  }
})();
