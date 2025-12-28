import { GoogleGenAI, Chat } from "@google/genai";

// Initialize Gemini Client
// Note: process.env.API_KEY is injected by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const createChatSession = (): Chat => {
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      temperature: 0.7,
      systemInstruction: `You are MathDoc AI, an expert assistant for a LaTeX to Word conversion tool. 
      Your goal is to help users format their LaTeX math expressions, debug syntax errors, or generate LaTeX code for complex equations.
      You can also answer general questions about mathematics and document formatting.
      Keep your answers concise and helpful. When providing LaTeX code, wrap it in code blocks.`,
    },
  });
};

export const sendMessageToGemini = async (
  chat: Chat, 
  message: string
): Promise<AsyncIterable<string>> => {
  try {
    const responseStream = await chat.sendMessageStream({ message });
    
    // Create an async generator to yield text chunks
    async function* streamGenerator() {
      for await (const chunk of responseStream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
    }
    
    return streamGenerator();
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * Analyzes images (single or multiple pages) using Gemini Vision to extract text and LaTeX.
 */
export const analyzeImagesToLatex = async (
    images: { mimeType: string; data: string }[]
): Promise<string> => {
    try {
        // Limit the number of pages processed in one go to avoid payload limits if necessary
        // Gemini 3 Flash has a large context window.
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: {
                parts: [
                    ...images.map(img => ({
                        inlineData: {
                            mimeType: img.mimeType,
                            data: img.data
                        }
                    })),
                    {
                        text: `
                        You are an advanced Math OCR engine. Your task is to transcribe the content of these images into a single continuous text document.
                        
                        RULES:
                        1. **Mathematics**: Detect ALL mathematical formulas, symbols, and expressions. Convert them STRICTLY into standard LaTeX format.
                           - Use $...$ for inline math.
                           - Use $$...$$ for display math (equations on their own line).
                        2. **Language**: Preserve the original language (Vietnamese/English). Fix minor OCR typos if the context is obvious.
                        3. **Formatting & Structure (IMPORTANT)**: 
                           - **Headings**: Start every new "Câu" (Question) or "Bài" (Problem) on a NEW LINE with a blank line before it to separate sections clearly.
                           - **Sub-items**: Start every sub-part (e.g., "a)", "b)", "c)", or "1.", "2.") on a NEW LINE. Do NOT write them inline.
                        4. **Output**: Return ONLY the transcribed content. Do not add "Here is the transcription" or any conversational filler.
                        5. **Accuracy**: Pay special attention to fractions, integrals, sum, limits, and matrices.
                        `
                    }
                ]
            }
        });

        let text = response.text || "";

        // --- POST-PROCESSING FOR PROFESSIONAL VIETNAMESE MATH FORMATTING ---
        
        // 1. Remove all Markdown bold markers (**) as requested to keep text clean
        text = text.replace(/\*\*/g, '');

        // 2. Ensure "Câu X" or "Bài X" starts on a new double line for visual separation.
        //    Matches: "Câu 1", "Bài 1", "Câu I", "Bài IV" not already preceded by double newline.
        text = text.replace(/([^\n])\n*(Câu|Bài|Và)\s+([\dIVX]+[.:]?)/gi, '$1\n\n$2 $3');
        
        // 3. Ensure sub-questions like a), b), c) start on a new line.
        //    Example conversion: "Câu 1. Tính: a) x+1 b) x-1" -> "... \na) x+1 \nb) x-1"
        //    Regex looks for a letter followed by ) or . preceded by whitespace, comma, or semicolon.
        text = text.replace(/([,;.]|\s)(\s*)([a-z]\))(\s)/g, '\n$3$4');
        text = text.replace(/([,;.]|\s)(\s*)([1-9]\.)(\s)/g, '\n$3$4');

        // 4. Clean up multiple blank lines to max 2
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();

    } catch (error) {
        console.error("Gemini Image Transcription Error:", error);
        throw error;
    }
};