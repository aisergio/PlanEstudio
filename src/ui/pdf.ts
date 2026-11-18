import type { Guide } from '../core/guides.ts';
import { blockTypes, tracks, weekKey } from '../core/curriculum.ts';
import type { Week } from '../core/curriculum.ts';
import type { Suggestion } from '../core/resources.ts';

function vectorDiagram(source: string) {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = parsed.documentElement;
  const view = root.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  if (root.localName !== 'svg' || !view?.[2] || !view[3]) throw new Error('El diagrama no tiene dimensiones válidas.');
  root.setAttribute('width', String(view[2]));
  root.setAttribute('height', String(view[3]));
  root.removeAttribute('style');
  for (const element of root.querySelectorAll('text, tspan')) {
    element.setAttribute('font-family', 'Roboto');
  }
  return { svg: new XMLSerializer().serializeToString(root), width: view[2], height: view[3] };
}

const point = (millimeters: number) => millimeters * 72 / 25.4;
export async function downloadGuide(week: Week, guide: Guide, svg: string, suggestions: Suggestion[], profile: 'mobile' | 'a4') {
  const [{ default: pdf }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')
  ]);
  pdf.addVirtualFileSystem(fonts);
  const mobile = profile === 'mobile';
  const [width, height] = week.track === 'ia' ? [108, 234] : [90, 195];
  const bodyWidth = mobile ? point(width) - 34 : 490;
  const diagram = vectorDiagram(svg);
  const scale = Math.min(bodyWidth / diagram.width, (mobile ? 145 : 210) / diagram.height);
  const header = (text: string) => ({ text, style: 'section', headlineLevel: 1 });
  const content = [
    { text: tracks[week.track].name + ' / SEMANA ' + week.number, style: 'eyebrow' },
    { text: week.title, style: 'title' },
    { text: guide.outcome, style: 'intro' },
    header('Plan de 5 horas'),
    { ul: blockTypes.map(block => block.title + ' · ' + block.minutes + ' min'), margin: [0, 0, 0, 8] },
    header('Conceptos'),
    ...guide.theory.flatMap(([title, body]) => [{ text: title, style: 'topic' }, { text: body, style: 'paragraph' }]),
    { svg: diagram.svg, width: diagram.width * scale, height: diagram.height * scale, alignment: 'center', margin: [0, 4, 0, 8] },
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
