
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const geminiService = {
  // 1. General Chat / Study (Flash)
  async studyVerse(prompt: string, useSearch: boolean = false): Promise<any> {
    const ai = getAI();
    const config: any = {};
    if (useSearch) config.tools = [{ googleSearch: {} }];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config
    });

    return {
      text: response.text,
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.web?.title || c.maps?.title || 'Source',
        uri: c.web?.uri || c.maps?.uri
      }))
    };
  },

  // 2. Maps Grounding for Biblical Locations
  async findBiblicalPlace(placeName: string, lat?: number, lng?: number): Promise<any> {
    const ai = getAI();
    const config: any = {
      tools: [{ googleMaps: {} }]
    };
    if (lat && lng) {
      config.toolConfig = {
        retrievalConfig: { latLng: { latitude: lat, longitude: lng } }
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Find information about the biblical location: ${placeName}`,
      config
    });

    return {
      text: response.text,
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.maps?.title || 'Location',
        uri: c.maps?.uri
      }))
    };
  },

  // 3. Thinking Mode for Complex Theology
  async deepTheology(query: string): Promise<string> {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: query,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });
    return response.text || "No deep insight found.";
  },

  // 4. Image Generation (Pro Image)
  async generateSpiritualImage(prompt: string, aspectRatio: string = "16:9", size: string = "1K"): Promise<string> {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: size as any
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  },

  // 5. Image Editing (Nano Banana)
  async editAnnotation(base64Image: string, prompt: string): Promise<string> {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } },
          { text: prompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No edited image generated");
  },

  // 6. Video Generation (Veo)
  async generateBibleVideo(prompt: string, aspect: '16:9' | '9:16' = '16:9', startImage?: string): Promise<string> {
    const ai = getAI();
    const payload: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspect
      }
    };

    if (startImage) {
      payload.image = {
        imageBytes: startImage.split(',')[1],
        mimeType: 'image/png'
      };
    }

    let operation = await ai.models.generateVideos(payload);
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  // 7. TTS
  async textToSpeech(text: string, voice: string = 'Kore'): Promise<AudioBufferSourceNode> {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio returned");

    const audioData = decode(base64Audio);
    const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    return source;
  }
};

// Utils for audio
function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
