/**
 * Word(.docx) 解析器
 * 输出纯文本与 HTML，按章节标题/段落切分为证据要素；不支持旧版 .doc。
 */
import mammoth from 'mammoth';

const TITLE_RE = /^\s*(第[一二三四五六七八九十百千0-9]+[章节条部分]|[一二三四五六七八九十]+、|[（(][一二三四五六七八九十0-9]+[)）]|\d+(\.\d+){0,3}\s+\S{2,30})/;

export async function parseWord(filePath: string): Promise<{
  kind: 'word'; elements: any[]; markdownText: string; html: string; warnings: string[];
}> {
  const [textRes, htmlRes] = await Promise.all([
    mammoth.extractRawText({ path: filePath }),
    mammoth.convertToHtml({ path: filePath }),
  ]);
  const text = textRes.value || '';
  const html = htmlRes.value || '';

  const elements: any[] = [];
  const paragraphs = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  let buffer: string[] = [];

  const flushText = () => {
    if (buffer.length === 0) return;
    const content = buffer.join('\n');
    elements.push({
      pageNo: 0,
      sheetName: null,
      elementType: 'text',
      content,
      anchorLabel: `正文段落（第 ${elements.length + 1} 段，约 ${content.length} 字）`,
      bbox: null,
    });
    buffer = [];
  };

  for (const para of paragraphs) {
    const isTitle = TITLE_RE.test(para) && para.length <= 40;
    if (isTitle) {
      flushText();
      elements.push({
        pageNo: 0,
        sheetName: null,
        elementType: 'title',
        content: para,
        anchorLabel: `章节标题：${para}`,
        bbox: null,
      });
    } else {
      buffer.push(para);
      if (buffer.join('\n').length > 1500) flushText();
    }
  }
  flushText();

  return {
    kind: 'word',
    elements: elements.slice(0, 1000),
    markdownText: text,
    html,
    warnings: [...new Set([...(textRes.messages || []), ...(htmlRes.messages || [])].map((m: any) => m.message))].slice(0, 20),
  };
}
