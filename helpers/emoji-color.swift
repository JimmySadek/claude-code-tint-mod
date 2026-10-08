// Measures the main color of one emoji as macOS draws it (Apple Color Emoji).
// Usage: emoji-color <emoji>
// Prints JSON: {"color":"#RRGGBB","share":0.99,"saturation":0.76,"brightness":0.63}
// or {"color":null} when the emoji has no colored pixels (⚽ is black and white).
import AppKit

let emoji = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""
let size = 128
guard !emoji.isEmpty,
      let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
                                 bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                 colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
      let context = NSGraphicsContext(bitmapImageRep: rep)
else {
  print("{\"color\":null}")
  exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
let font = NSFont(name: "Apple Color Emoji", size: 96) ?? NSFont.systemFont(ofSize: 96)
(emoji as NSString).draw(at: NSPoint(x: 8, y: 8), withAttributes: [.font: font])
NSGraphicsContext.restoreGraphicsState()

// Visible, saturated, not-too-dark pixels, grouped into 12 hue buckets; the
// biggest bucket's average is the emoji's color.
var visible = 0
var count = [Int](repeating: 0, count: 12)
var sums = [[Double]](repeating: [0, 0, 0], count: 12)
for y in 0..<size {
  for x in 0..<size {
    guard let pixel = rep.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB), pixel.alphaComponent >= 0.5 else { continue }
    visible += 1
    if pixel.saturationComponent < 0.25 || pixel.brightnessComponent < 0.2 { continue }
    let bucket = min(11, Int(pixel.hueComponent * 12))
    count[bucket] += 1
    sums[bucket][0] += Double(pixel.redComponent)
    sums[bucket][1] += Double(pixel.greenComponent)
    sums[bucket][2] += Double(pixel.blueComponent)
  }
}

guard let best = count.indices.max(by: { count[$0] < count[$1] }), count[best] > 0, visible > 0 else {
  print("{\"color\":null}")
  exit(0)
}
let n = Double(count[best])
let rgb = sums[best].map { $0 / n }
let average = NSColor(deviceRed: rgb[0], green: rgb[1], blue: rgb[2], alpha: 1)
let hex = String(format: "#%02X%02X%02X", Int(round(rgb[0] * 255)), Int(round(rgb[1] * 255)), Int(round(rgb[2] * 255)))
let share = n / Double(count.reduce(0, +))
print(String(format: "{\"color\":\"%@\",\"share\":%.2f,\"saturation\":%.2f,\"brightness\":%.2f}",
             hex, share, average.saturationComponent, average.brightnessComponent))
