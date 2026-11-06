import Foundation
import Security

/// Guarda secretos (la key de Groq) en el Llavero del Mac, nunca en UserDefaults ni en el repo.
nonisolated enum Llavero {
    static let groq = "groq-api-key"
    private static let servicio = Bundle.main.bundleIdentifier ?? "asistoso"

    static func leer(_ cuenta: String) -> String? {
        let consulta: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servicio,
            kSecAttrAccount as String: cuenta,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var resultado: CFTypeRef?
        guard SecItemCopyMatching(consulta as CFDictionary, &resultado) == errSecSuccess,
              let datos = resultado as? Data else { return nil }
        return String(data: datos, encoding: .utf8)
    }

    /// Guarda el valor; vacío lo borra.
    @discardableResult
    static func guardar(_ valor: String, en cuenta: String) -> Bool {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servicio,
            kSecAttrAccount as String: cuenta
        ]
        SecItemDelete(base as CFDictionary)
        let limpio = valor.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !limpio.isEmpty else { return true }
        var nuevo = base
        nuevo[kSecValueData as String] = Data(limpio.utf8)
        return SecItemAdd(nuevo as CFDictionary, nil) == errSecSuccess
    }
}
