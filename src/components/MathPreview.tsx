import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import { TextSegment } from '../types';

interface MathPreviewProps {
  segments: TextSegment[];
  isRichText: boolean;
}

export const MathPreview: React.FC<MathPreviewProps> = ({ segments, isRichText }) => {
  if (isRichText) {
    // In Rich Text mode, we need to reconstruct the HTML string because splitting HTML
    // into React components might break tag nesting.
    // We render math to HTML string and inject it back into the content.
    const htmlContent = segments.map(segment => {
      if (segment.type === 'text') {
        return segment.content;
      } else {
        try {
          return katex.renderToString(segment.content, {
            throwOnError: false,
            displayMode: segment.displayMode,
            output: 'html',
          });
        } catch (e) {
          return `<span class="text-red-500 font-bold">[Error: ${segment.content}]</span>`;
        }
      }
    }).join('');

    return (
      <div 
        className="prose max-w-none p-8 bg-white min-h-full leading-relaxed shadow-sm
          [&_p]:my-3 [&_h1]:text-[#2E74B5] [&_h1]:font-bold [&_h1]:text-2xl [&_h1]:mt-6 [&_h1]:mb-3
          [&_h2]:text-[#2E74B5] [&_h2]:font-bold [&_h2]:text-xl [&_h2]:mt-5 [&_h2]:mb-2
          [&_h3]:text-[#1F4D78] [&_h3]:font-bold [&_h3]:text-lg [&_h3]:mt-4 [&_h3]:mb-2
          [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-6
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
          [&_td]:border [&_td]:border-black [&_td]:p-2 [&_td]:align-top
          [&_th]:border [&_th]:border-black [&_th]:p-2 [&_th]:bg-slate-100 [&_th]:font-bold"
        style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  }

  // Original Text Mode rendering
  return (
    <div 
      className="prose max-w-none p-8 bg-white min-h-full leading-relaxed shadow-sm"
      style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}
    >
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
             <HighlightedText key={index} content={segment.content} />
          );
        } else {
          return (
            <LatexSegment 
                key={index} 
                content={segment.content} 
                displayMode={segment.displayMode} 
            />
          );
        }
      })}
    </div>
  );
};

// Component to handle highlighting of "Câu/Bài" in Preview
const HighlightedText: React.FC<{ content: string }> = ({ content }) => {
    // We need to split the text to wrap the specific keywords in spans
    // Split by (Câu/Bài + Number) OR (a)/b) + space)
    const regex = /((?:^|\n)(?:Câu|Bài)\s+[\dIVX]+[.:]?)|((?:^|\n)[a-z]\)\s)/gi;
    const parts = content.split(regex);

    return (
        <span className="whitespace-pre-wrap">
            {parts.map((part, i) => {
                if (!part) return null;
                
                // Match "Câu X" or "Bài X"
                if (/^(?:\n)?(Câu|Bài)\s+[\dIVX]+[.:]?/i.test(part)) {
                    return <span key={i} className="font-bold text-brand-600">{part}</span>;
                }
                // Match "a) ", "b) "
                if (/^(?:\n)?[a-z]\)\s/i.test(part)) {
                     return <span key={i} className="font-bold text-brand-700">{part}</span>;
                }
                
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};

const LatexSegment: React.FC<{ content: string; displayMode?: boolean }> = ({ content, displayMode }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(content, containerRef.current, {
          throwOnError: false,
          displayMode: displayMode,
          output: 'html', // For screen preview we want HTML/CSS
        });
      } catch (e) {
        containerRef.current.innerText = "Error";
      }
    }
  }, [content, displayMode]);

  return <span ref={containerRef} className={displayMode ? "block my-4 text-center" : "inline-block"} />;
};