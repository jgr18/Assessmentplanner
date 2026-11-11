/* Assessmentplanner — eenvoudige Excel-schrijver (.xlsx) zonder externe bibliotheek.
   Ondersteunt: meerdere tabbladen, tekst en getallen, vet, tekstkleur, vulkleur, centreren,
   dunne randen, dikke bovenrand, kolombreedtes en vastgezette rijen/kolommen. */
(function (root) {
  'use strict';
  const AP = root.AP = root.AP || {};

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const kolom = n => { let s = ''; n++; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

  function stijlRegister() {
    const fonts = ['<font><sz val="11"/><name val="Calibri"/></font>'], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'], xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    const fIdx = {}, flIdx = {}, bIdx = {}, xIdx = {};
    function font(vet, kleur) {
      const k = (vet ? 'b' : '') + (kleur || ''); if (!k) return 0;
      if (fIdx[k] === undefined) { fIdx[k] = fonts.length; fonts.push('<font>' + (vet ? '<b/>' : '') + '<sz val="11"/>' + (kleur ? '<color rgb="FF' + kleur + '"/>' : '') + '<name val="Calibri"/></font>'); }
      return fIdx[k];
    }
    function fill(kleur) {
      if (!kleur) return 0;
      if (flIdx[kleur] === undefined) { flIdx[kleur] = fills.length; fills.push('<fill><patternFill patternType="solid"><fgColor rgb="FF' + kleur + '"/><bgColor indexed="64"/></patternFill></fill>'); }
      return flIdx[kleur];
    }
    function border(rand, boven) {
      const k = (rand ? 'r' : '') + (boven || ''); if (!k) return 0;
      const dun = rand ? '<color rgb="FFC9C9C4"/>' : '';
      const z = rand ? ' style="thin"' : '';
      if (bIdx[k] === undefined) {
        bIdx[k] = borders.length;
        borders.push('<border><left' + z + '>' + dun + '</left><right' + z + '>' + dun + '</right>' +
          (boven === 'dik' ? '<top style="medium"><color rgb="FF1F2328"/></top>' : '<top' + z + '>' + dun + '</top>') +
          '<bottom' + z + '>' + dun + '</bottom><diagonal/></border>');
      }
      return bIdx[k];
    }
    function index(st) {
      if (!st) return 0;
      const key = JSON.stringify(st);
      if (xIdx[key] !== undefined) return xIdx[key];
      const f = font(st.vet, st.kleur), fl = fill(st.vulling), b = border(st.rand, st.randBoven);
      const uitlijn = st.midden || st.terugloop ? '<alignment' + (st.midden ? ' horizontal="center"' : '') + ' vertical="center"' + (st.terugloop ? ' wrapText="1"' : '') + '/>' : '';
      xIdx[key] = xfs.length;
      xfs.push('<xf numFmtId="' + (st.getal || 0) + '" fontId="' + f + '" fillId="' + fl + '" borderId="' + b + '" xfId="0"' + (f ? ' applyFont="1"' : '') + (fl ? ' applyFill="1"' : '') + (b ? ' applyBorder="1"' : '') + (st.getal ? ' applyNumberFormat="1"' : '') + (uitlijn ? ' applyAlignment="1">' + uitlijn + '</xf>' : '/>'));
      return xIdx[key];
    }
    function xml() {
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts><fills count="' + fills.length + '">' + fills.join('') + '</fills>' +
        '<borders count="' + borders.length + '">' + borders.join('') + '</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '<dxfs count="1"><dxf><font><b/><color rgb="FFFFFFFF"/></font><fill><patternFill patternType="solid"><fgColor rgb="FF1D9E75"/><bgColor rgb="FF1D9E75"/></patternFill></fill><alignment horizontal="center"/></dxf></dxfs></styleSheet>';
    }
    return { index, xml };
  }

  function bladXml(blad, stijl) {
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    if (blad.liggend) x += '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
    if (blad.bevries) {
      const { x: bx = 0, y: by = 0 } = blad.bevries;
      x += '<sheetViews><sheetView workbookViewId="0"><pane' + (bx ? ' xSplit="' + bx + '"' : '') + (by ? ' ySplit="' + by + '"' : '') + ' topLeftCell="' + kolom(bx) + (by + 1) + '" activePane="' + (bx && by ? 'bottomRight' : by ? 'bottomLeft' : 'topRight') + '" state="frozen"/></sheetView></sheetViews>';
    }
    if (blad.kolommen && blad.kolommen.length) x += '<cols>' + blad.kolommen.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>';
    x += '<sheetData>';
    blad.rijen.forEach((rij, ri) => {
      x += '<row r="' + (ri + 1) + '"' + (blad.rijhoogte ? ' ht="' + blad.rijhoogte + '" customHeight="1"' : '') + '>';
      rij.forEach((cel, ci) => {
        if (cel === null || cel === undefined) return;
        const c = typeof cel === 'object' ? cel : { v: cel };
        const ref = kolom(ci) + (ri + 1), s = stijl.index(c.stijl);
        const sAttr = s ? ' s="' + s + '"' : '';
        if (c.v === null || c.v === undefined || c.v === '') x += '<c r="' + ref + '"' + sAttr + '/>';
        else if (typeof c.v === 'number' && isFinite(c.v)) x += '<c r="' + ref + '"' + sAttr + '><v>' + c.v + '</v></c>';
        else x += '<c r="' + ref + '"' + sAttr + ' t="inlineStr"><is><t xml:space="preserve">' + esc(c.v) + '</t></is></c>';
      });
      x += '</row>';
    });
    x += '</sheetData>';
    if (blad.samenvoegen && blad.samenvoegen.length) x += '<mergeCells count="' + blad.samenvoegen.length + '">' + blad.samenvoegen.map(r => '<mergeCell ref="' + r + '"/>').join('') + '</mergeCells>';
    /* groen maken: [{ bereik: 'B2:K200', waarden: ['+', 'x'] }] — voorwaardelijke opmaak, ook voor later ingetypte waarden */
    if (blad.groen && blad.groen.length) blad.groen.forEach((g, gi) => {
      x += '<conditionalFormatting sqref="' + g.bereik + '">' + g.waarden.map((w, wi) => '<cfRule type="cellIs" dxfId="0" priority="' + (gi * 10 + wi + 1) + '" operator="equal"><formula>"' + esc(w) + '"</formula></cfRule>').join('') + '</conditionalFormatting>';
    });
    /* keuzelijsten: [{ bereik: 'B2:K200', lijst: ['ja', 'nee'] }] */
    if (blad.keuzelijsten && blad.keuzelijsten.length) x += '<dataValidations count="' + blad.keuzelijsten.length + '">' + blad.keuzelijsten.map(k => '<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Ongeldige waarde" error="Kies een waarde uit de lijst." sqref="' + k.bereik + '"><formula1>"' + esc(k.lijst.join(',')) + '"</formula1></dataValidation>').join('') + '</dataValidations>';
    x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
    if (blad.liggend) x += '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
    return x + '</worksheet>';
  }

  /* --- zip (zonder compressie) --- */
  const crcTabel = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcTabel[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(bestanden) {
    const enc = new TextEncoder(), delen = [], centraal = []; let positie = 0;
    const u16 = v => [v & 0xFF, (v >>> 8) & 0xFF], u32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
    const nu = new Date(), dosTijd = (nu.getHours() << 11) | (nu.getMinutes() << 5) | Math.floor(nu.getSeconds() / 2), dosDatum = ((nu.getFullYear() - 1980) << 9) | ((nu.getMonth() + 1) << 5) | nu.getDate();
    bestanden.forEach(([naam, inhoud]) => {
      const n = enc.encode(naam), d = typeof inhoud === 'string' ? enc.encode(inhoud) : inhoud, crc = crc32(d);
      const kop = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTijd), u16(dosDatum), u32(crc), u32(d.length), u32(d.length), u16(n.length), u16(0));
      delen.push(new Uint8Array(kop), n, d);
      centraal.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTijd), u16(dosDatum), u32(crc), u32(d.length), u32(d.length), u16(n.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(positie))), n);
      positie += kop.length + n.length + d.length;
    });
    const cGrootte = centraal.reduce((s, x) => s + x.length, 0);
    const eind = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(bestanden.length), u16(bestanden.length), u32(cGrootte), u32(positie), u16(0)));
    const alles = delen.concat(centraal, [eind]), totaal = alles.reduce((s, x) => s + x.length, 0), uit = new Uint8Array(totaal);
    let p = 0; alles.forEach(x => { uit.set(x, p); p += x.length; });
    return uit;
  }

  function maak(bladen) {
    const stijl = stijlRegister();
    const bladXmls = bladen.map(b => bladXml(b, stijl));
    const veiligeNaam = s => String(s).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31);
    const bestanden = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        bladen.map((b, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
        bladen.map((b, i) => '<sheet name="' + esc(veiligeNaam(b.naam)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        bladen.map((b, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
        '<Relationship Id="rId' + (bladen.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']
    ];
    bladXmls.forEach((x, i) => bestanden.push(['xl/worksheets/sheet' + (i + 1) + '.xml', x]));
    bestanden.push(['xl/styles.xml', stijl.xml()]);
    return zip(bestanden);
  }

  AP.xlsx = { maak, kolom };
})(typeof window !== 'undefined' ? window : globalThis);
