//  HealthManager.swift
//  Accès HealthKit. On DEMANDE l'autorisation, puis on LIT les métriques du jour.
//  Tout reste sur l'appareil : rien n'est envoyé nulle part (sauf, plus tard, au coach IA).

import Foundation
import HealthKit

@MainActor
final class HealthManager: ObservableObject {
    private let store = HKHealthStore()

    @Published var authorized = false
    @Published var loading = false
    @Published var errorMessage: String?

    // Valeurs du jour (nil = pas encore de donnée).
    @Published var sleepHours: Double?      // h de sommeil la nuit dernière
    @Published var restingHR: Double?       // bpm
    @Published var hrv: Double?             // SDNN en ms (marqueur de récup)
    @Published var steps: Double?           // pas du jour
    @Published var activeEnergy: Double?    // kcal actives du jour
    @Published var latestHR: Double?        // dernière FC mesurée

    var healthAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    // Types qu'on veut LIRE.
    private var readTypes: Set<HKObjectType> {
        var s = Set<HKObjectType>()
        let q: [HKQuantityTypeIdentifier] = [
            .restingHeartRate, .heartRateVariabilitySDNN,
            .stepCount, .activeEnergyBurned, .heartRate
        ]
        for id in q { if let t = HKObjectType.quantityType(forIdentifier: id) { s.insert(t) } }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { s.insert(sleep) }
        return s
    }

    /// Demande l'autorisation (la 1re fois iOS affiche la feuille système), puis lit.
    func requestAuthorization() async {
        guard healthAvailable else {
            errorMessage = "Apple Santé n'est pas disponible sur cet appareil."
            return
        }
        do {
            try await store.requestAuthorization(toShare: [], read: readTypes)
            authorized = true
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Recharge toutes les métriques du jour en parallèle.
    func refresh() async {
        loading = true
        defer { loading = false }

        async let rhr  = mostRecent(.restingHeartRate, unit: bpm)
        async let v    = mostRecent(.heartRateVariabilitySDNN, unit: .secondUnit(with: .milli))
        async let st   = sumToday(.stepCount, unit: .count())
        async let en   = sumToday(.activeEnergyBurned, unit: .kilocalorie())
        async let hr   = mostRecent(.heartRate, unit: bpm)
        async let sl   = sleepLastNight()

        restingHR    = await rhr
        hrv          = await v
        steps        = await st
        activeEnergy = await en
        latestHR     = await hr
        sleepHours   = await sl
    }

    private var bpm: HKUnit { HKUnit.count().unitDivided(by: .minute()) }

    /// Dernier échantillon (pour les mesures ponctuelles : FC repos, HRV, FC).
    private func mostRecent(_ id: HKQuantityTypeIdentifier, unit: HKUnit) async -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: id) else { return nil }
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        return await withCheckedContinuation { cont in
            let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
                let value = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit)
                cont.resume(returning: value)
            }
            store.execute(query)
        }
    }

    /// Somme depuis minuit (pour les cumuls : pas, énergie).
    private func sumToday(_ id: HKQuantityTypeIdentifier, unit: HKUnit) async -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: id) else { return nil }
        let start = Calendar.current.startOfDay(for: Date())
        let pred = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
        return await withCheckedContinuation { cont in
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: pred, options: .cumulativeSum) { _, stats, _ in
                cont.resume(returning: stats?.sumQuantity()?.doubleValue(for: unit))
            }
            store.execute(query)
        }
    }

    /// Heures de sommeil de la nuit (somme des phases « asleep » des dernières 18 h).
    private func sleepLastNight() async -> Double? {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return nil }
        let end = Date()
        let start = Calendar.current.date(byAdding: .hour, value: -18, to: end) ?? end
        let pred = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let asleep: Set<Int> = [
            HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
            HKCategoryValueSleepAnalysis.asleepCore.rawValue,
            HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
            HKCategoryValueSleepAnalysis.asleepREM.rawValue
        ]
        return await withCheckedContinuation { cont in
            let query = HKSampleQuery(sampleType: type, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                let seconds = (samples as? [HKCategorySample] ?? [])
                    .filter { asleep.contains($0.value) }
                    .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
                cont.resume(returning: seconds > 0 ? seconds / 3600.0 : nil)
            }
            store.execute(query)
        }
    }
}
