declare module 'pdfmake/build/pdfmake' {
  const pdf: { addVirtualFileSystem(files: Record<string, string>): void; createPdf(definition: object): { download(name: string): Promise<void> } };
  export default pdf;
}
declare module 'pdfmake/build/vfs_fonts' {
  const files: Record<string, string>;
  export default files;
}
