import * as ImageManipulator from "expo-image-manipulator";

const MAX_BASE64_BYTES = 2_500_000;
const STEPS: { width: number; quality: number }[] = [
  { width: 1600, quality: 0.7 },
  { width: 1280, quality: 0.6 },
  { width: 1024, quality: 0.5 },
  { width: 800, quality: 0.45 },
  { width: 640, quality: 0.4 },
];

export type CompressedImage = {
  uri: string;
  base64: string;
  width: number;
  height: number;
  approxBytes: number;
};

export async function compressForUpload(uri: string): Promise<CompressedImage> {
  let lastError: unknown = null;

  for (const step of STEPS) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: step.width } }],
        {
          compress: step.quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      if (!result.base64) continue;
      const approxBytes = Math.floor((result.base64.length * 3) / 4);
      if (approxBytes <= MAX_BASE64_BYTES) {
        return {
          uri: result.uri,
          base64: result.base64,
          width: result.width,
          height: result.height,
          approxBytes,
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  try {
    const fallback = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 480 } }],
      { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (fallback.base64) {
      return {
        uri: fallback.uri,
        base64: fallback.base64,
        width: fallback.width,
        height: fallback.height,
        approxBytes: Math.floor((fallback.base64.length * 3) / 4),
      };
    }
  } catch (err) {
    lastError = err;
  }

  const message =
    lastError instanceof Error ? lastError.message : "Image compression failed";
  throw new Error(message);
}
