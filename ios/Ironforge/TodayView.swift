//  TodayView.swift
//  Écran d'accueil : tes vraies données du jour, lues depuis Apple Santé.

import SwiftUI

struct TodayView: View {
    @EnvironmentObject var health: HealthManager

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    private var metrics: [Metric] {
        [
            Metric(icon: "bed.double.fill",     title: "Sommeil",        value: fmt(health.sleepHours, "%.1f"),   unit: "h"),
            Metric(icon: "waveform.path.ecg",   title: "HRV (SDNN)",     value: fmt(health.hrv, "%.0f"),          unit: "ms", accent: true),
            Metric(icon: "heart.fill",          title: "FC repos",       value: fmt(health.restingHR, "%.0f"),    unit: "bpm"),
            Metric(icon: "heart.circle",        title: "FC actuelle",    value: fmt(health.latestHR, "%.0f"),     unit: "bpm"),
            Metric(icon: "figure.walk",         title: "Pas",            value: fmt(health.steps, "%.0f"),        unit: ""),
            Metric(icon: "flame.fill",          title: "Énergie active", value: fmt(health.activeEnergy, "%.0f"), unit: "kcal")
        ]
    }

    var body: some View {
        ZStack {
            Color.ifBG.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header

                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(metrics) { MetricCard(metric: $0) }
                    }

                    if !health.authorized {
                        connectButton
                    } else {
                        refreshButton
                    }

                    if let e = health.errorMessage {
                        Text(e).font(.footnote).foregroundStyle(.red)
                    }
                }
                .padding(16)
            }
        }
        .task {
            // À l'ouverture : demande l'accès (silencieux si déjà accordé) puis lit.
            await health.requestAuthorization()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("IRONFORGE")
                .font(.system(size: 13, weight: .heavy)).tracking(2)
                .foregroundStyle(Color.ifAccent)
            Text(greeting)
                .font(.system(size: 27, weight: .heavy))
                .foregroundStyle(Color.ifText)
            Text(dateLabel)
                .font(.subheadline)
                .foregroundStyle(Color.ifMuted)
        }
        .padding(.top, 8)
    }

    private var connectButton: some View {
        Button { Task { await health.requestAuthorization() } } label: {
            Text("Connecter Apple Santé").frame(maxWidth: .infinity)
        }
        .buttonStyle(AccentButton())
    }

    private var refreshButton: some View {
        Button { Task { await health.refresh() } } label: {
            HStack {
                Image(systemName: "arrow.clockwise")
                Text(health.loading ? "Lecture…" : "Rafraîchir")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(SurfaceButton())
        .disabled(health.loading)
    }

    private func fmt(_ v: Double?, _ f: String) -> String {
        guard let v else { return "—" }
        return String(format: f, v)
    }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        return h < 12 ? "Bon matin" : (h < 18 ? "Bon après-midi" : "Bonsoir")
    }

    private var dateLabel: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_CA")
        f.dateFormat = "EEEE d MMMM"
        return f.string(from: Date()).capitalized
    }
}
