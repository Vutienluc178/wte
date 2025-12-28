import katex from 'katex';
import { asBlob } from 'html-docx-js-typescript';
import { TextSegment, ExportStyle } from '../types';

/**
 * Splits a raw string into text and LaTeX segments.
 * Supports $...$, $$...$$, \(...\), \[...\]
 */
export const parseContent = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  // Regex to match LaTeX patterns. 
  
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$[^$]*?\$)/g;
  
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Push preceding text
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    const fullMatch = match[0];
    let content = fullMatch;
    let displayMode = false;

    // Strip delimiters and determine mode
    if (fullMatch.startsWith('$$')) {
      content = fullMatch.slice(2, -2);
      displayMode = true;
    } else if (fullMatch.startsWith('\\[')) {
      content = fullMatch.slice(2, -2);
      displayMode = true;
    } else if (fullMatch.startsWith('\\(')) {
      content = fullMatch.slice(2, -2);
      displayMode = false;
    } else if (fullMatch.startsWith('$')) {
      content = fullMatch.slice(1, -1);
      displayMode = false;
    }

    segments.push({
      type: 'math',
      content: content,
      displayMode,
    });

    lastIndex = regex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
};

/**
 * Generates a Standard .docx file (Office Open XML) using html-docx-js.
 * Supports different styles: Standard, Minimal, Worksheet, Notes, Two-Column, Landscape, Large Print, Draft, Flashcards.
 */
export const generateWordCompatibleFile = (segments: TextSegment[], isRichText: boolean = false, style: ExportStyle = 'standard'): Promise<Blob> | Blob => {
  let bodyContent = '';

  // Helper: Dotted lines for Worksheet
  const writingLines = `
    <div style="margin-top: 10pt; margin-bottom: 20pt; color: #999;">
        <p style="border-bottom: 1px dotted #999; line-height: 24pt;">&nbsp;</p>
        <p style="border-bottom: 1px dotted #999; line-height: 24pt;">&nbsp;</p>
        <p style="border-bottom: 1px dotted #999; line-height: 24pt;">&nbsp;</p>
    </div>
  `;

  // Start wrapping for Flashcards mode
  const isFlashcard = style === 'flashcards';

  segments.forEach((segment, index) => {
    let segmentHtml = '';

    if (segment.type === 'text') {
      let htmlText = '';
      if (isRichText) {
        htmlText = segment.content;
      } else {
        // Plain text processing
        let safeText = segment.content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
            
        // --- COLOR HIGHLIGHTING LOGIC FOR WORD EXPORT ---
        // 1. Highlight "Câu X:", "Bài X:" (Blue + Bold)
        // Regex: (Start of line OR newline)(Câu/Bài)(space)(Number/Roman)(dot/colon optional)
        safeText = safeText.replace(
            /(^|\n)(Câu|Bài)\s+([\dIVX]+[.:]?)/gi, 
            '$1<span style="color: #0284c7; font-weight: bold;">$2 $3</span>'
        );

        // 2. Highlight sub-items "a)", "b)" (Darker Blue/Bold)
        // Regex: (Start of line OR newline)(letter)(close parenthesis)(space)
        safeText = safeText.replace(
            /(^|\n)([a-z]\))(\s)/g,
            '$1<span style="color: #0369a1; font-weight: bold;">$2</span>$3'
        );

        // Convert newlines to breaks
        htmlText = `<span class="text-run">${safeText.replace(/\n/g, "<br/>")}</span>`;
      }
      segmentHtml += htmlText;

      // Worksheet Mode: Add lines logic
      if (style === 'worksheet' && !isRichText) {
          if (segment.content.includes("Câu") || segment.content.includes("Bài") || segment.content.length > 50) {
              segmentHtml += writingLines;
          }
      }

    } else {
      try {
        const mathML = katex.renderToString(segment.content, {
          throwOnError: false,
          output: 'mathml',
          displayMode: segment.displayMode,
        });

        const mathMatch = mathML.match(/<math[\s\S]*?<\/math>/);
        if (mathMatch) {
            let cleanMath = mathMatch[0];
            cleanMath = cleanMath.replace(/<annotation encoding="application\/x-tex">[\s\S]*?<\/annotation>/, '');
            
            // For docx generation, we rely on Word's ability to interpret MathML embedded in the HTML chunk.
            if (segment.displayMode) {
                segmentHtml += `<p class="equation" style="text-align: center; margin: 12pt 0;">${cleanMath}</p>`;
                if (style === 'worksheet') {
                    segmentHtml += '<p style="margin-bottom: 30pt;">&nbsp;</p>';
                }
            } else {
                segmentHtml += `${cleanMath}`;
            }
        } else {
            segmentHtml += `[Equation Error]`;
        }
      } catch (e) {
        segmentHtml += `[LaTeX Error]`;
      }
    }

    // Accumulate content
    if (isFlashcard && segment.type === 'text' && segmentHtml.trim().length > 0) {
        // In flashcard mode, wrap significant text chunks in a card div
        bodyContent += `<div class="flashcard">${segmentHtml}</div>`;
    } else if (isFlashcard && segment.type === 'math' && segment.displayMode) {
        // Wrap display math in its own card
        bodyContent += `<div class="flashcard">${segmentHtml}</div>`;
    } else {
        bodyContent += segmentHtml;
    }
  });

  // --- Dynamic CSS based on Style ---
  
  let pageMargin = '1in'; // Standard 1 inch
  let orientation = 'portrait';
  let fontSize = '12pt';
  let fontFamily = "'Times New Roman', serif";
  let lineHeight = '1.5';
  let extraCss = '';

  switch (style) {
      case 'notes':
          // Cornell notes style simulation via CSS not fully supported by simple HTML-DOCX, 
          // but we can adjust margins.
          pageMargin = '1in 1in 1in 2.5in'; // Top Right Bottom Left
          break;
      case 'minimal':
          pageMargin = '0.5in';
          lineHeight = '1.2';
          break;
      case 'two-column':
          pageMargin = '0.5in';
          // CSS columns don't always translate perfectly to Docx via HTML, 
          // but we include the instruction.
          extraCss = `
            .Section1 { 
                column-count: 2; 
                column-gap: 36pt; 
            }
          `;
          break;
      case 'landscape':
          orientation = 'landscape';
          break;
      case 'large-print':
          fontSize = '16pt';
          fontFamily = "Arial, sans-serif"; // Easier to read
          lineHeight = '1.6';
          break;
      case 'draft':
          lineHeight = '2.0'; // Double spacing
          pageMargin = '1.5in'; // Wide margins for corrections
          break;
      case 'flashcards':
          extraCss = `
            .flashcard {
                border: 2px solid #000;
                padding: 15pt;
                margin: 15pt 0;
                page-break-inside: avoid;
                background-color: #ffffff;
            }
          `;
          break;
  }

  // Colors
  const isPlain = style === 'minimal' || style === 'draft';
  const headingColor1 = isPlain ? '#000000' : '#2E74B5';
  const headingColor2 = isPlain ? '#000000' : '#1F4D78';
  const tableHeaderBg = isPlain ? '#ffffff' : '#f2f2f2';

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Export</title>
        <style>
            @page {
                margin: ${pageMargin};
                size: ${orientation};
            }
            
            body { 
                font-family: ${fontFamily}; 
                font-size: ${fontSize}; 
                line-height: ${lineHeight}; 
                color: #000000;
            }
            
            /* Heading Styles */
            h1 { font-size: 1.4em; color: ${headingColor1}; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; }
            h2 { font-size: 1.2em; color: ${headingColor1}; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
            h3 { font-size: 1.1em; color: ${headingColor2}; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
            
            /* Text Runs */
            .text-run { white-space: pre-wrap; }
            
            /* Equations */
            p.equation { margin: 12pt 0; text-align: center; }
            
            /* Tables */
            table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 12pt 0; 
                border: 1px solid black;
            }
            td, th { 
                border: 1px solid black; 
                padding: 6px 8px; 
                vertical-align: top;
            }
            th {
                background-color: ${tableHeaderBg};
                font-weight: bold;
            }

            /* Custom Style CSS */
            ${extraCss}
        </style>
    </head>
    <body>
        <div class="Section1">
            ${bodyContent}
            
            <br/>
            <hr/>
            <p style="text-align: center; color: #2E74B5; font-size: 10pt; font-weight: bold; margin-top: 20pt;">
                Thầy Vũ Tiến Lực - Trường THPT Nguyễn Hữu Cảnh
            </p>
        </div>
    </body>
    </html>
  `;

  // Generate standard .docx blob using html-docx-js-typescript
  // This wraps the HTML in a valid OpenXML Zip container.
  return asBlob(fullHtml, {
      orientation: orientation as 'portrait' | 'landscape',
      margins: { top: 720, bottom: 720, left: 720, right: 720 } // Twips (approximate)
  });
};