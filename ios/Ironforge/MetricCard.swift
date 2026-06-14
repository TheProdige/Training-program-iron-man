//  MetricCard.swift
//  Tuile de métrique façon Strava/Whoop : icône, libellé en capitales, grande valeur.

import SwiftUI

struct MetricCard: View {
    let metric: Metric

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: metric.icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(metric.accent ? Color.ifAccent : Color.ifMuted)

            Text(metric.title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.ifMuted)

            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(metric.value)
                    .font(.system(size: 28, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.ifText)
                if !metric.unit.isEmpty {
                    Text(metric.unit)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.ifMuted)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.ifSurface, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.white.opacity(0.06), lineWidth: 1))
    }
}
