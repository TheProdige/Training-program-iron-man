//  Theme.swift
//  Couleurs & styles repris du design IRONFORGE (sombre, accent orange).

import SwiftUI

extension Color {
    static let ifBG       = Color(red: 0.027, green: 0.039, blue: 0.063) // #070a10
    static let ifSurface  = Color(red: 0.063, green: 0.082, blue: 0.122) // #10151f
    static let ifSurface2 = Color(red: 0.086, green: 0.114, blue: 0.165) // #161d2a
    static let ifText     = Color(red: 0.953, green: 0.961, blue: 0.984) // #f3f5fb
    static let ifMuted    = Color(red: 0.604, green: 0.643, blue: 0.729) // #9aa4ba
    static let ifAccent   = Color(red: 1.0,   green: 0.353, blue: 0.173) // #ff5a2c
    static let ifOk       = Color(red: 0.137, green: 0.827, blue: 0.604) // #23d39a
}

let ifAccentGradient = LinearGradient(
    colors: [Color(red: 1, green: 0.48, blue: 0.24), Color(red: 1, green: 0.18, blue: 0.42)],
    startPoint: .topLeading, endPoint: .bottomTrailing
)

struct AccentButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .bold))
            .padding(.vertical, 15)
            .foregroundStyle(.white)
            .background(ifAccentGradient, in: RoundedRectangle(cornerRadius: 13))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
    }
}

struct SurfaceButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .bold))
            .padding(.vertical, 14)
            .foregroundStyle(Color.ifText)
            .background(Color.ifSurface2, in: RoundedRectangle(cornerRadius: 13))
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(Color.white.opacity(0.10), lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }
}
