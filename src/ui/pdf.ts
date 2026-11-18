import type { Guide } from '../core/guides.ts';
import { blockTypes, tracks, weekKey } from '../core/curriculum.ts';
import type { Week } from '../core/curriculum.ts';
import type { Suggestion } from '../core/resources.ts';

function rasterDiagram(svg: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = parsed.documentElement;
    const view = root.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
    const w = view?.[2] || 500;
    const h = view?.[3] || 250;
    root.setAttribute('width', String(w)); root.setAttribute('height', String(h));
    root.removeAttribute('style');
    const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' }));
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(w * 2); canvas.height = Math.ceil(h * 2);
        const context = canvas.getContext('2d')!;
        context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) { reject(error); } finally { URL.revokeObjectURL(source); }
    };
    image.onerror = error => { URL.revokeObjectURL(source); reject(error); };
    image.src = source;
  });
}

const point = (millimeters: number) => millimeters * 72 / 25.4;
export async function downloadGuide(week: Week, guide: Guide, svg: string, suggestions: Suggestion[], profile: 'mobile' | 'a4') {
  const [{ default: pdf }, { default: fonts }, image] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'), rasterDiagram(svg)
  ]);
  pdf.addVirtualFileSystem(fonts);
  const mobile = profile === 'mobile';
  const [width, height] = week.track === 'ia' ? [108, 234] : [90, 195];
  const bodyWidth = mobile ? point(width) - 34 : 490;
  const header = (text: string) => ({ text, style: 'section', headlineLevel: 1 });
  const content = [
    { text: tracks[week.track].name + ' / SEMANA ' + week.number, style: 'eyebrow' },
    { text: week.title, style: 'title' },
    { text: guide.outcome, style: 'intro' },
    header('Plan de 5 horas'),
    { ul: blockTypes.map(block => block.title + ' · ' + block.minutes + ' min'), margin: [0, 0, 0, 8] },
    header('Conceptos'),
    ...guide.theory.flatMap(([title, body]) => [{ text: title, style: 'topic' }, { text: body, style: 'paragraph' }]),
    { image, fit: [bodyWidth, mobile ? 145 : 210], alignment: 'center', margin: [0, 4, 0, 8] },
    header('Ejemplo trabajado'), { text: guide.example, style: 'paragraph' },
    ...(guide.code ? [{ text: guide.code, style: 'code' }] : []),
    header('Laboratorio y proyecto'), { ol: guide.lab, style: 'paragraph' },
    header('Modo celular'), { text: guide.mobile, style: 'paragraph' },
    header('Autoevaluación'), ...guide.quiz.map(([question]) => ({ text: question, style: 'topic' })),
    header('Respuestas de comprobación'),
    ...guide.quiz.map(([, answer], index) => ({ text: (index + 1) + '. ' + answer, style: 'paragraph' })),
    header('Criterio de avance'), { text: guide.exit, style: 'paragraph' },
    ...(suggestions.length ? [header('Para profundizar'), ...suggestions.map(item => ({
      text: [{ text: item.title, bold: true, color: '#2159bd', ...(item.url ? { link: item.url } : {}) }, '\n' + item.why], style: 'paragraph'
    }))] : [])
  ];
  const definition = {
    pageSize: mobile ? { width: point(width), height: point(height) } : 'A4',
    pageMargins: mobile ? [17, 22, 17, 28] : [48, 40, 48, 45],
    info: { title: week.title, author: 'PlanEstudio', subject: tracks[week.track].name + ' · Guía ' + guide.version },
    content,
    defaultStyle: { fontSize: mobile ? 10.5 : 11, lineHeight: 1.14, color: '#1d3154' },
    styles: {
      eyebrow: { fontSize: 9, color: '#255dcc', bold: true, margin: [0, 0, 0, 7] },
      title: { fontSize: mobile ? 20 : 27, bold: true, margin: [0, 0, 0, 9] },
      intro: { color: '#365b96', margin: [0, 0, 0, 8] },
      section: { fontSize: mobile ? 13 : 15, bold: true, color: '#17468f', margin: [0, 10, 0, 5] },
      topic: { bold: true, margin: [0, 4, 0, 2] },
      paragraph: { margin: [0, 0, 0, 6] },
      code: { color: '#143875', fontSize: mobile ? 8.5 : 9.5, margin: [0, 2, 0, 8] }
    },
    pageBreakBefore: (node: { headlineLevel?: number }, container: { getFollowingNodesOnPage(): unknown[] }) =>
      node.headlineLevel === 1 && container.getFollowingNodesOnPage().length === 0,
    footer: (page: number, pages: number) => ({ text: 'PlanEstudio  ·  v' + guide.version + '  ·  ' + page + ' / ' + pages,
      alignment: 'center', color: '#526885', fontSize: 8, margin: [0, 7, 0, 0] })
  };
  await pdf.createPdf(definition).download('PlanEstudio-' + weekKey(week.track, week.number) + '-' + profile + '.pdf');
}
