declare module 'pdfmake/build/pdfmake' {
  const pdf: { addVirtualFileSystem(files: Record<string, string>): void; createPdf(definition: object): { getBlob(): Promise<Blob> } };
  export default pdf;
}
declare module 'pdfmake/build/vfs_fonts' {
  const files: Record<string, string>;
  export default files;
}
