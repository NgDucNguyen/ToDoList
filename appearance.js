(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const dialog = $("appearance-dialog");
  const defaults = { overlay: 35, blur: 0, position: "center" };
  const urls = new Map();
  let saved = null;
  let draft = null;
  let generation = 0;
  let busy = false;
  let saving = false;
  let ready;

  // A separate IndexedDB record keeps photo bytes out of task localStorage quotas.
  function backgroundStorage(write, value) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("planner_appearance", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("settings");
      open.onerror = () => reject(new Error("Không mở được bộ nhớ ảnh nền. Hãy thử lại."));
      open.onblocked = () => reject(new Error("Bộ nhớ ảnh đang được dùng ở cửa sổ khác. Hãy đóng cửa sổ đó và thử lại."));
      open.onsuccess = () => {
        const db = open.result;
        db.onversionchange = () => db.close();
        const transaction = db.transaction("settings", write ? "readwrite" : "readonly");
        const settings = transaction.objectStore("settings");
        let record = null;
        const request = write ? (value ? settings.put(value, "background") : settings.delete("background")) : settings.get("background");
        request.onsuccess = () => { record = request.result || null; };
        transaction.oncomplete = () => { db.close(); resolve(record); };
        transaction.onabort = transaction.onerror = () => {
          db.close();
          reject(new Error("Không lưu được ảnh nền. Ảnh trước đó vẫn được giữ; hãy thử ảnh nhỏ hơn."));
        };
      };
    });
  }

  function normalize(record) {
    if (!record || !(record.blob instanceof Blob) || !/^image\/(webp|jpeg|png)$/.test(record.blob.type)) return null;
    const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
    return { blob: record.blob, name: String(record.name || "Ảnh nền"), overlay: clamp(record.overlay, 10, 85, 35), blur: clamp(record.blur, 0, 12, 0), position: ["center", "top", "bottom"].includes(record.position) ? record.position : "center" };
  }
  function urlFor(blob) {
    if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
    return urls.get(blob);
  }
  function cleanURLs() {
    for (const [blob, url] of urls) {
      if (blob !== saved?.blob && blob !== draft?.blob) { URL.revokeObjectURL(url); urls.delete(blob); }
    }
  }
  function apply(record) {
    document.body.classList.toggle("has-background", Boolean(record));
    const layer = $("app-background");
    layer.style.setProperty("--background-image", record ? `url("${urlFor(record.blob)}")` : "none");
    layer.style.setProperty("--background-veil", record ? record.overlay / 100 : 0);
    layer.style.setProperty("--background-blur", `${record?.blur || 0}px`);
    layer.style.setProperty("--background-position", record?.position || "center");
  }
  function error(message = "") {
    $("background-error").textContent = message;
    $("background-error").classList.toggle("hidden", !message);
  }
  function updateEditor() {
    const settings = draft || defaults;
    $("background-controls").disabled = !draft || busy || saving;
    $("choose-background-btn").disabled = busy || saving;
    $("reset-background-btn").disabled = busy || saving || !draft;
    $("save-background-btn").disabled = busy || saving;
    $("save-background-btn").textContent = saving ? "Đang lưu..." : "Áp dụng";
    $("choose-background-btn").textContent = busy ? "Đang xử lý ảnh..." : "Chọn ảnh từ máy";
    $("background-file-name").textContent = draft?.name || "Chưa chọn ảnh";
    $("background-file-name").title = draft?.name || "";
    $("background-overlay").value = settings.overlay;
    $("background-overlay-value").textContent = `${settings.overlay}%`;
    $("background-blur").value = settings.blur;
    $("background-blur-value").textContent = `${settings.blur} px`;
    $("background-position").value = settings.position;
    const image = $("background-preview-image");
    image.hidden = !draft;
    $("background-preview-veil").hidden = !draft;
    $("background-preview-empty").hidden = Boolean(draft);
    if (draft) {
      image.src = urlFor(draft.blob);
      image.style.objectPosition = draft.position;
      image.style.filter = `blur(${draft.blur}px)`;
      $("background-preview-veil").style.opacity = draft.overlay / 100;
    } else image.removeAttribute("src");
    apply(draft);
    cleanURLs();
  }

  async function preparePhoto(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Hãy chọn ảnh JPG, PNG hoặc WebP.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Ảnh vượt quá 20 MB. Hãy chọn ảnh nhỏ hơn.");
    const sourceURL = URL.createObjectURL(file);
    const image = new Image();
    try {
      image.src = sourceURL;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("Ảnh không hợp lệ.");
      const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Không xử lý được ảnh trên trình duyệt này.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type: "image/webp", quality: 0.85 }) : await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
      if (!blob || blob.size > 5 * 1024 * 1024) throw new Error("Không tối ưu được ảnh này. Hãy thử một ảnh nhỏ hơn.");
      return blob;
    } catch (failure) {
      throw new Error(failure.name === "EncodingError" ? "Không đọc được ảnh này. Hãy chọn một ảnh khác." : failure.message);
    } finally { URL.revokeObjectURL(sourceURL); }
  }

  ready = backgroundStorage(false).then((record) => {
    saved = normalize(record); apply(saved);
  }).catch((failure) => { error(failure.message); }).finally(() => { document.body.dataset.appearanceReady = "true"; });

  $("open-appearance-btn").addEventListener("click", async () => {
    await ready;
    if (dialog.open) return;
    draft = saved ? { ...saved } : null;
    updateEditor();
    dialog.showModal();
    $("choose-background-btn").focus();
  });
  $("choose-background-btn").addEventListener("click", () => $("background-file-input").click());
  $("background-file-input").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || saving || !dialog.open) return;
    const current = ++generation;
    busy = true; error(); updateEditor();
    try {
      const blob = await preparePhoto(file);
      if (current !== generation || !dialog.open) return;
      draft = { ...(draft || defaults), blob, name: file.name };
    } catch (failure) { if (current === generation && dialog.open) error(failure.message); }
    finally { if (current === generation) { busy = false; updateEditor(); } }
  });
  for (const [control, key] of [["background-overlay", "overlay"], ["background-blur", "blur"], ["background-position", "position"]]) {
    $(control).addEventListener("input", () => {
      if (!draft) return;
      draft[key] = key === "position" ? $(control).value : Number($(control).value);
      updateEditor();
    });
  }
  $("reset-background-btn").addEventListener("click", () => { draft = null; error(); updateEditor(); });
  $("save-background-btn").addEventListener("click", async () => {
    if (busy || saving) return;
    saving = true; error(); updateEditor();
    const next = draft ? { ...draft } : null;
    try {
      await backgroundStorage(true, next);
      saved = next; dialog.close();
    } catch (failure) { error(failure.message); }
    finally { saving = false; updateEditorAfterSave(); }
  });
  function updateEditorAfterSave() {
    if (dialog.open) updateEditor();
    else { draft = null; apply(saved); cleanURLs(); }
  }
  function restoreSaved() {
    ++generation; busy = false; draft = null; error();
    apply(saved); cleanURLs();
  }
  function close() { if (!saving) { restoreSaved(); dialog.close(); } }
  $("close-appearance-btn").addEventListener("click", close);
  $("cancel-appearance-btn").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("close", () => {
    if (!dialog.open) restoreSaved();
  });
})();
