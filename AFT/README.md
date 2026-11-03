# Air File Transfer (AFT) — Airgapped QR Code Transfer

Air File Transfer (AFT) is an industrial-grade, client-side, web-based tool to transfer files and documents between completely isolated (airgapped) devices using dynamic QR codes and optical camera scanning.

It enables true airgapped file transfer with **zero network connectivity** — no Wi-Fi, no Bluetooth, no USB cables, and no cellular connection required. Data travels exclusively as optical light signals.

Based on open-source work by [Mohankumar Ramachandran](https://github.com/mohankumarelec/airgapped-qr-code-transfer).

---

## 🚀 Key Features

- **Data Sender Mode (`generator.html`)**:
  - Select any file from device storage (PDFs, images, configs, log files, text, ZIPs).
  - Maximum compression using gzip (`pako` level 9).
  - Intelligent chunking (customizable chunk sizes from 150B to 400B).
  - Animated high-contrast QR stream with variable transmission speed (50ms - 250ms).
  - Loop mode and step-by-step navigation for robust optical reception.

- **Data Receiver Mode (`scanner.html`)**:
  - Uses device camera with auto environmental lens detection.
  - Multi-engine QR scanner: Hardware-accelerated `BarcodeDetector` + `@undecaf/zbar-wasm` + fallback canvas decoding.
  - Real-time chunk reconstruction matrix showing received vs missing chunks.
  - Automatic reassembly, gzip decompression, and instant file download upon 100% receipt.

- **Unified Dashboard (`index.html`)**:
  - Complete all-in-one interface with Tabreed Industrial Automation theme and styling.
  - Quick toggle between Send and Receive modes.
  - Full PWA offline capability and responsive design for tablets, desktops, and mobile phones.

---

## 🛠️ How It Works

### Sender Architecture
1. **File Selection**: User selects or drops any file.
2. **Compression**: The file is compressed using gzip (`pako.gzip`).
3. **Chunking**: The binary stream is split into sequential chunks.
4. **Encoding**: Initial metadata `{ name, chunks }` is displayed, followed by sequentially indexed chunks `${index},${base64}`.
5. **Display**: Fast animated QR stream presented on screen.

### Receiver Architecture
1. **Scanning**: Camera captures the QR frames continuously.
2. **Decoding**: Extracts chunk indices and binary payload.
3. **Buffer Management**: Chunks are stored in memory and tracked until all chunks are collected.
4. **Decompression**: Reassembled bytes are decompressed via `pako.inflate`.
5. **Download**: Instant browser download triggered as a Blob object.

---

## 🔒 Security & Privacy

- **100% Client-Side**: No data is ever transmitted to any remote server or cloud.
- **Airgap Compliant**: Operates safely in isolated OT/ICS plant environments, SCADA networks, and high-security zones.
- **Auditable & Open-Source**: Transparent protocol based on RFC 1952 (GZIP) and ISO/IEC 18004 (QR Code).
