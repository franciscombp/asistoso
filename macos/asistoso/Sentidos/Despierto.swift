import Foundation
import IOKit.pwr_mgt

/// Que el Mac no apague la pantalla ni entre en reposo mientras Uku cuida (como `caffeinate -d`).
@MainActor
final class Despierto {
    private var asercion: IOPMAssertionID = 0
    private(set) var activo = false

    @discardableResult
    func activar() -> Bool {
        if activo { return true }
        let r = IOPMAssertionCreateWithName(kIOPMAssertionTypePreventUserIdleDisplaySleep as CFString,
                                            IOPMAssertionLevel(kIOPMAssertionLevelOn),
                                            "Uku cuida la compu" as CFString, &asercion)
        activo = r == kIOReturnSuccess
        return activo
    }

    func desactivar() {
        guard activo else { return }
        IOPMAssertionRelease(asercion)
        activo = false
    }
}
