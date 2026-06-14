//  IronforgeApp.swift
//  IRONFORGE — point d'entrée de l'app native iOS.
//  M0 : on lit tes vraies données Apple Santé et on les affiche.

import SwiftUI

@main
struct IronforgeApp: App {
    @StateObject private var health = HealthManager()

    var body: some Scene {
        WindowGroup {
            TodayView()
                .environmentObject(health)
                .preferredColorScheme(.dark)   // l'app est pensée sombre
        }
    }
}
