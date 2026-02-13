export function chunkText(text: string, chunkSize = 1200, overlap = 200) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    const chunks: string[] = [];
  
    let i = 0;
    while (i < cleaned.length) {
      chunks.push(cleaned.slice(i, i + chunkSize));
      i += chunkSize - overlap;
    }
  
    return chunks.map(c => c.trim()).filter(Boolean);
  }