//  Metric.swift
//  Petit modèle d'affichage pour une tuile de métrique.

import Foundation

struct Metric: Identifiable {
    let id = UUID()
    let icon: String      // nom SF Symbol
    let title: String
    let value: String
    let unit: String
    var accent: Bool = false
}
