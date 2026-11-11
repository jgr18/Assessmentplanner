/* Assessmentplanner — eenvoudige Excel-lezer (.xlsx) zonder externe bibliotheek.
   Pakt het bestand uit (zip; gecomprimeerde delen via de ingebouwde DecompressionStream van de browser)
   en leest per tabblad de celwaarden als tekst of getal. Opmaak en formules worden genegeerd
   (van een formule wordt de laatst berekende waarde gelezen). */
(function (root) {
  'use strict';
  const AP = root.AP = root.AP || {};

  const u16 = (b, i) => b[i] | (b[i + 1] << 8);
  const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Deze browser kan geen Excel-bestanden uitpakken. Gebruik een recente versie van Chrome, Edge, Firefox of Safari.');
    const stroom = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stroom).arrayBuffer());
  }

  async function unzip(buffer) {
    const b = new Uint8Array(buffer);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Dit is geen geldig Excel-bestand (.xlsx).');
    const aantal = u16(b, eocd + 10);
    let p = u32(b, eocd + 16);
    const bestanden = {}, dec = new TextDecoder('utf-8');
    for (let n = 0; n < aantal; n++) {
      if (u32(b, p) !== 0x02014b50) throw new Error('Het Excel-bestand is beschadigd (centrale map).');
      const methode = u16(b, p + 10), compGrootte = u32(b, p + 20), naamLen = u16(b, p + 28), extraLen = u16(b, p + 30), commLen = u16(b, p + 32), lokaal = u32(b, p + 42);
      const naam = dec.decode(b.subarray(p + 46, p + 46 + naamLen));
      const start = lokaal + 30 + u16(b, lokaal + 26) + u16(b, lokaal + 28);
      const data = b.subarray(start, start + compGrootte);
      bestanden[naam] = { methode, data };
      p += 46 + naamLen + extraLen + commLen;
    }
    return {
      async tekst(naam) {
        const f = bestanden[naam] || bestanden[Object.keys(bestanden).find(k => k.toLowerCase() === naam.toLowerCase())];
        if (!f) return null;
        const ruw = f.methode === 0 ? f.data : f.methode === 8 ? await inflateRaw(f.data) : null;
        if (!ruw) throw new Error('Onbekende compressiemethode in het Excel-bestand.');
        return dec.decode(ruw);
      }
    };
  }

  const ontsnap = s => s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, c) => {
    if (c[0] === '#') return String.fromCodePoint(c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10));
    return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[c.toLowerCase()];
  });
  const attr = (tekst, naam) => { const r = new RegExp('(?:^|\\s)' + naam.replace(':', '\\:') + '="([^"]*)"').exec(tekst); return r ? ontsnap(r[1]) : null; };
  const tekstUit = xml => { let t = ''; xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (m, x) => { t += ontsnap(x); return m; }); return t; };
  const kolomNr = letters => letters.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

  /* Leest een werkmap: { bladnamen: [...], blad(naam) → [[waarde, ...], ...] } (rijen en kolommen vanaf 0). */
  async function lees(buffer) {
    const zip = await unzip(buffer);
    const werkboek = await zip.tekst('xl/workbook.xml');
    if (!werkboek) throw new Error('Dit is geen Excel-werkmap (xl/workbook.xml ontbreekt).');
    const rels = (await zip.tekst('xl/_rels/workbook.xml.rels')) || '';
    const relMap = {};
    rels.replace(/<Relationship\b([^>]*)\/?>/g, (m, a) => { relMap[attr(a, 'Id')] = attr(a, 'Target'); return m; });
    const gedeeld = [];
    const ss = await zip.tekst('xl/sharedStrings.xml');
    if (ss) ss.replace(/<si\b[^>]*>([\s\S]*?)<\/si>/g, (m, x) => { gedeeld.push(tekstUit(x)); return m; });
    const bladen = [];
    werkboek.replace(/<sheet\b([^>]*)\/?>/g, (m, a) => {
      let doel = relMap[attr(a, 'r:id')] || '';
      doel = doel.startsWith('/') ? doel.slice(1) : 'xl/' + doel.replace(/^\.\//, '');
      bladen.push({ naam: attr(a, 'name'), pad: doel });
      return m;
    });
    const cache = {};
    async function blad(naam) {
      const b = bladen.find(x => x.naam.trim().toLowerCase() === String(naam).trim().toLowerCase());
      if (!b) return null;
      if (cache[b.naam]) return cache[b.naam];
      const xml = (await zip.tekst(b.pad)) || '';
      const rijen = [];
      const data = (/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml) || [])[1] || '';
      let rijTeller = 0;
      data.replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (m, ra, inhoud) => {
        const rnr = attr(ra, 'r') ? parseInt(attr(ra, 'r'), 10) - 1 : rijTeller;
        rijTeller = rnr + 1;
        const rij = rijen[rnr] = [];
        let kolTeller = 0;
        (inhoud || '').replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (m2, ca, ci) => {
          const ref = attr(ca, 'r'), type = attr(ca, 't') || 'n';
          const k = ref ? kolomNr(ref.replace(/\d+/g, '')) : kolTeller;
          kolTeller = k + 1;
          ci = ci || '';
          const v = (/<v>([\s\S]*?)<\/v>/.exec(ci) || [])[1];
          let waarde = null;
          if (type === 's') waarde = v !== undefined ? gedeeld[parseInt(v, 10)] : null;
          else if (type === 'inlineStr') waarde = tekstUit((/<is>([\s\S]*?)<\/is>/.exec(ci) || [])[1] || '');
          else if (type === 'str' || type === 'e') waarde = v !== undefined ? ontsnap(v) : null;
          else if (type === 'b') waarde = v === '1';
          else waarde = v !== undefined && v !== '' ? Number(v) : null;
          rij[k] = waarde;
          return m2;
        });
        return m;
      });
      for (let i = 0; i < rijen.length; i++) if (!rijen[i]) rijen[i] = [];
      cache[b.naam] = rijen;
      return rijen;
    }
    return { bladnamen: bladen.map(b => b.naam), blad };
  }

  AP.xlsxLezen = { lees };
})(typeof window !== 'undefined' ? window : globalThis);
