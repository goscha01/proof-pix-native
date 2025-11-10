import Foundation
import UIKit
import React

@objc(ImageCompositor)
class ImageCompositor: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func compositeImages(
    _ beforeUri: String,
    afterUri: String,
    layout: String,
    width: NSNumber,
    height: NSNumber,
    topHeight: NSNumber?,
    bottomHeight: NSNumber?,
    leftWidth: NSNumber?,
    rightWidth: NSNumber?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        // Load images
        guard let beforeImage = self.loadImage(from: beforeUri) else {
          reject("E_BEFORE_IMAGE", "Failed to load before image", nil)
          return
        }

        guard let afterImage = self.loadImage(from: afterUri) else {
          reject("E_AFTER_IMAGE", "Failed to load after image", nil)
          return
        }

        let canvasWidth = CGFloat(truncating: width)
        let canvasHeight = CGFloat(truncating: height)
        let canvasSize = CGSize(width: canvasWidth, height: canvasHeight)

        // Create image context
        UIGraphicsBeginImageContextWithOptions(canvasSize, false, 1.0)
        guard let context = UIGraphicsGetCurrentContext() else {
          reject("E_CONTEXT", "Failed to create graphics context", nil)
          return
        }

        // Fill background with white
        context.setFillColor(UIColor.white.cgColor)
        context.fill(CGRect(origin: .zero, size: canvasSize))

        if layout == "STACK" {
          // Stacked layout (vertical)
          let topH = CGFloat(truncating: topHeight ?? 0)
          let bottomH = CGFloat(truncating: bottomHeight ?? 0)

          // Draw before image on top
          beforeImage.draw(in: CGRect(x: 0, y: 0, width: canvasWidth, height: topH))

          // Draw after image on bottom
          afterImage.draw(in: CGRect(x: 0, y: topH, width: canvasWidth, height: bottomH))

        } else {
          // Side-by-side layout (horizontal)
          let leftW = CGFloat(truncating: leftWidth ?? 0)
          let rightW = CGFloat(truncating: rightWidth ?? 0)

          // Draw before image on left
          beforeImage.draw(in: CGRect(x: 0, y: 0, width: leftW, height: canvasHeight))

          // Draw after image on right
          afterImage.draw(in: CGRect(x: leftW, y: 0, width: rightW, height: canvasHeight))
        }

        // Get the composed image
        guard let composedImage = UIGraphicsGetImageFromCurrentImageContext() else {
          UIGraphicsEndImageContext()
          reject("E_COMPOSE", "Failed to compose image", nil)
          return
        }

        UIGraphicsEndImageContext()

        // Save to temp file
        guard let imageData = composedImage.jpegData(compressionQuality: 0.95) else {
          reject("E_JPEG", "Failed to create JPEG data", nil)
          return
        }

        let tempDir = NSTemporaryDirectory()
        let filename = "combined_\(UUID().uuidString).jpg"
        let filepath = (tempDir as NSString).appendingPathComponent(filename)
        let fileURL = URL(fileURLWithPath: filepath)

        try imageData.write(to: fileURL)

        resolve(fileURL.absoluteString)

      } catch {
        reject("E_SAVE", "Failed to save composed image: \(error.localizedDescription)", error)
      }
    }
  }

  private func loadImage(from uriString: String) -> UIImage? {
    var urlString = uriString

    // Handle file:// URLs
    if urlString.hasPrefix("file://") {
      urlString = String(urlString.dropFirst(7))
    }

    // Try to load from file path
    if let image = UIImage(contentsOfFile: urlString) {
      return image
    }

    // Try to load from URL
    if let url = URL(string: uriString), let data = try? Data(contentsOf: url) {
      return UIImage(data: data)
    }

    return nil
  }
}
