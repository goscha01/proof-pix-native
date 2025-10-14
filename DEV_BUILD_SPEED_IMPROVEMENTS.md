# Post Dev-Build Speed Improvements Plan

Goal: move combined photo generation to a native pipeline for 2–3x faster saves and fully background processing, while keeping output identical (no crop, no padding).

## 1) Add Skia Composer (native path)
- Install: `@shopify/react-native-skia`
- Create a `skiaComposer.ts` with two functions:
  - `composeSideBySide(beforeUri, afterUri, targetWidthPx)` → returns file URI
  - `composeStacked(beforeUri, afterUri, targetWidthPx)` → returns file URI
- Implementation notes:
  - Load both images via `Skia.Image.MakeImageFromEncoded`
  - Compute sizes using aspect ratios (no crop, no padding)
  - Draw on a `Skia.Canvas` with exact output dimensions
  - Encode JPEG with quality 0.9; write to documents dir; save to media library

## 2) Replace ViewShot calls
- In `CameraScreen` background tasks, switch from `captureRef` to Skia pipeline
- Keep current logic for orientation → (side vs stack)
- Remove onLoad waits and mount delays; Skia draws directly from decoded bitmaps

## 3) Preload + cache images
- As soon as a BEFORE is selected, preload its bitmap via Skia (and keep handle)
- After AFTER save, reuse the preloaded BEFORE bitmap; decode AFTER once

## 4) Memory and large assets
- Cap longest dimension to 2160 px for speed/memory; make cap configurable
- Stream encode if needed; recycle Skia images after write

## 5) Labels (optional)
- Use Skia text for BEFORE/AFTER; register a font (e.g., Inter)
- Conditionally draw label layer when `showLabels` is true

## 6) Testing
- Validate no crop/padding using side-by-side and stacked test pairs
- Compare sizes vs ViewShot output; confirm faster timings (~200–400ms typical)

## 7) Rollout
- Feature flag `useSkiaComposer`
- Fallback to ViewShot if Skia fails or not available


