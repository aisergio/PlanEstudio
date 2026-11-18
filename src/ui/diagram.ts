let engine: Promise<typeof import('mermaid')['default']> | undefined;
export async function renderDiagram(source: string) {
  engine ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', flowchart: { htmlLabels: false },
      themeVariables: { fontFamily: 'Arial, sans-serif', primaryColor: '#edf4ff', primaryTextColor: '#142347', primaryBorderColor: '#719be2', lineColor: '#3973ce' } });
    return mermaid;
  });
  const mermaid = await engine;
  const { svg } = await mermaid.render('mmd-' + crypto.randomUUID(), source);
  return svg;
}
