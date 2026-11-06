import SwiftUI
import WebKit

/// El mundo 3D de Uku (three.js) en un WKWebView, servido desde la app y conectado al puente nativo.
struct MundoView: NSViewRepresentable {
    let url: URL
    let puente: Puente

    func makeCoordinator() -> Coordinador { Coordinador() }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // localStorage persistente: memoria, visitas, diario
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.isElementFullscreenEnabled = true
        config.userContentController.addScriptMessageHandler(puente, contentWorld: .page, name: "uku")

        let web = WKWebView(frame: .zero, configuration: config)
        web.uiDelegate = context.coordinator
        web.navigationDelegate = context.coordinator
        web.setValue(false, forKey: "drawsBackground") // el cielo lo pinta la web
        #if DEBUG
        web.isInspectable = true // Safari › Desarrollo › asistoso
        #endif
        puente.webView = web
        web.load(URLRequest(url: url))
        return web
    }

    func updateNSView(_ web: WKWebView, context: Context) {}

    final class Coordinador: NSObject, WKUIDelegate, WKNavigationDelegate {
        /// La cámara de la web (MediaPipe y face-api): solo para el mundo local; el permiso de macOS lo pide el sistema.
        func webView(_ webView: WKWebView, decideMediaCapturePermissionsFor origin: WKSecurityOrigin,
                     initiatedBy frame: WKFrameInfo, type: WKMediaCaptureType) async -> WKPermissionDecision {
            origin.host == "127.0.0.1" ? .grant : .deny
        }

        /// Los enlaces de fuera se abren en el navegador.
        func webView(_ webView: WKWebView, decidePolicyFor accion: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = accion.request.url, accion.navigationType == .linkActivated, url.host != "127.0.0.1" else { return .allow }
            NSWorkspace.shared.open(url)
            return .cancel
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
    }
}
